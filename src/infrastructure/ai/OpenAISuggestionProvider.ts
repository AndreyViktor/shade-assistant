import { DEFAULT_CONTEXT_LIMITS } from '../../core/meeting/ContextManager';
import type {
  SuggestionProvider,
  SuggestionRequest,
  SuggestionResult,
} from '../../core/suggestions/SuggestionProvider';
import { isValidSecret } from '../settings/SecretStore';
import { parseSuggestionResponse } from './parseSuggestionResponse';
import { suggestionFormat, suggestionInstructions } from './suggestionFormat';

type Options = {
  /** Required: host validates account access/support before authorized real use. */
  model: string;
  getApiKey: () => Promise<string | null>;
  /** Host must check text consent, active session and cost authorization. */
  isAuthorized: () => boolean;
  fetch?: typeof fetch;
  timeoutMs?: number;
  maxOutputTokens?: number;
};
const MAX_RESPONSE_BYTES = 65_536;

async function readResponse(
  response: Response,
  signal: AbortSignal,
): Promise<unknown> {
  if (!response.body) throw new Error('Invalid response');
  const reader = response.body.getReader();
  const cancel = () => {
    void reader.cancel().catch(() => undefined);
  };
  signal.addEventListener('abort', cancel, { once: true });
  const chunks: Uint8Array[] = [];
  let size = 0;
  try {
    if (signal.aborted) throw new Error('Cancelled');
    while (true) {
      const chunk = await reader.read();
      if (chunk.done) break;
      size += chunk.value.byteLength;
      if (size > MAX_RESPONSE_BYTES) throw new Error('Invalid response');
      chunks.push(chunk.value);
    }
    const bytes = new Uint8Array(size);
    let offset = 0;
    for (const chunk of chunks) {
      bytes.set(chunk, offset);
      offset += chunk.byteLength;
    }
    return JSON.parse(
      new TextDecoder('utf-8', { fatal: true }).decode(bytes),
    ) as unknown;
  } finally {
    signal.removeEventListener('abort', cancel);
    await reader.cancel().catch(() => undefined);
    reader.releaseLock();
  }
}

/** Main-only adapter. No auto-wiring, credential persistence, retries or logs. */
export class OpenAISuggestionProvider implements SuggestionProvider {
  private readonly options: Options;
  constructor(options: Options) {
    this.options = { ...options };
  }

  async generate(request: SuggestionRequest): Promise<SuggestionResult> {
    const controller = new AbortController();
    const timeoutMs = this.options.timeoutMs ?? 15_000;
    let timedOut = false;
    let timer: ReturnType<typeof setTimeout> | undefined;
    const cancel = () => controller.abort();
    let onAbort = () => {};
    try {
      if (request.signal.aborted) return { ok: false, code: 'cancelled' };
      if (
        !Number.isSafeInteger(timeoutMs) ||
        timeoutMs < 1 ||
        timeoutMs > 60_000
      )
        return { ok: false, code: 'invalid-request' };
      const aborted = new Promise<SuggestionResult>((resolve) => {
        onAbort = () =>
          resolve({ ok: false, code: timedOut ? 'timeout' : 'cancelled' });
        controller.signal.addEventListener('abort', onAbort, { once: true });
      });
      request.signal.addEventListener('abort', cancel, { once: true });
      timer = setTimeout(() => {
        timedOut = true;
        controller.abort();
      }, timeoutMs);
      // The race also bounds slow credential reads and non-cooperative test transports.
      return await Promise.race([
        this.perform(request, controller.signal),
        aborted,
      ]);
    } catch {
      return { ok: false, code: 'invalid-request' };
    } finally {
      clearTimeout(timer);
      request.signal.removeEventListener('abort', cancel);
      controller.signal.removeEventListener('abort', onAbort);
    }
  }

  private async perform(
    request: SuggestionRequest,
    signal: AbortSignal,
  ): Promise<SuggestionResult> {
    try {
      if (!this.options.isAuthorized())
        return { ok: false, code: 'not-authorized' };
      const { model } = this.options;
      const maxOutputTokens = this.options.maxOutputTokens ?? 2048;
      if (
        typeof model !== 'string' ||
        !/^[a-zA-Z0-9][a-zA-Z0-9._:-]{0,199}$/.test(model) ||
        !Number.isSafeInteger(maxOutputTokens) ||
        maxOutputTokens < 128 ||
        maxOutputTokens > 4096 ||
        (request.language !== 'pt-BR' && request.language !== 'en-US')
      )
        return { ok: false, code: 'invalid-request' };
      const context = {
        recent: request.context.recent
          .filter((item) => item.type === 'final')
          .map(({ source, locale, startMs, endMs, text }) => ({
            source,
            locale,
            startMs,
            endMs,
            text,
          })),
        summary: request.context.summary.map(
          ({ source, locale, startMs, endMs, text, truncated }) => ({
            source,
            locale,
            startMs,
            endMs,
            text,
            truncated,
          }),
        ),
      };
      const input = JSON.stringify(context);
      if (
        new TextEncoder().encode(input).byteLength >
        DEFAULT_CONTEXT_LIMITS.maxEstimatedTokens
      )
        return { ok: false, code: 'invalid-request' };
      if (context.recent.length === 0 && context.summary.length === 0)
        return { ok: true, suggestions: [] };
      let key: string | null;
      try {
        key = await this.options.getApiKey();
      } catch {
        return { ok: false, code: 'credentials-unavailable' };
      }
      if (signal.aborted) return { ok: false, code: 'cancelled' };
      if (!this.options.isAuthorized())
        return { ok: false, code: 'not-authorized' };
      if (!isValidSecret(key))
        return { ok: false, code: 'credentials-unavailable' };
      const response = await (this.options.fetch ?? globalThis.fetch)(
        'https://api.openai.com/v1/responses',
        {
          method: 'POST',
          redirect: 'error',
          signal,
          headers: {
            Authorization: `Bearer ${key}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            model,
            store: false,
            stream: false,
            max_output_tokens: maxOutputTokens,
            instructions: `${suggestionInstructions}\nRequested language: ${request.language}.`,
            input: [
              { role: 'user', content: [{ type: 'input_text', text: input }] },
            ],
            text: { format: suggestionFormat },
          }),
        },
      );
      if (signal.aborted) {
        await response.body?.cancel();
        return { ok: false, code: 'cancelled' };
      }
      if (!response.ok) {
        await response.body?.cancel();
        const code =
          response.status === 401 || response.status === 403
            ? 'authentication'
            : response.status === 429
              ? 'rate-limited'
              : response.status >= 500
                ? 'unavailable'
                : 'rejected';
        return { ok: false, code };
      }
      let result: SuggestionResult;
      try {
        result = parseSuggestionResponse(await readResponse(response, signal));
      } catch {
        result = { ok: false, code: 'invalid-response' };
      }
      if (signal.aborted) return { ok: false, code: 'cancelled' };
      if (!this.options.isAuthorized())
        return { ok: false, code: 'not-authorized' };
      return result;
    } catch {
      return { ok: false, code: 'network' };
    }
  }
}
