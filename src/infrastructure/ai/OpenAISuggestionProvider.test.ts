// @vitest-environment node
import { afterEach, describe, expect, it, vi } from 'vitest';
import { OpenAISuggestionProvider } from './OpenAISuggestionProvider';
import { MockSuggestionProvider } from './MockSuggestionProvider';
import { suggestionFormat } from './suggestionFormat';
import type { SuggestionRequest } from '../../core/suggestions/SuggestionProvider';

const card = {
  category: 'question',
  title: 'Confirme',
  body: 'Qual é o prazo?',
  groundedIn: 'inference',
};
const request = (): SuggestionRequest => ({
  language: 'pt-BR',
  signal: new AbortController().signal,
  context: {
    summary: [],
    recent: [
      {
        version: 1,
        type: 'final',
        sessionId: 'private-session',
        source: 'system',
        locale: 'pt-BR',
        seq: 1,
        timestampMs: 1000,
        startMs: 0,
        endMs: 1000,
        segmentId: 'private-id',
        text: 'Qual é o prazo?',
      },
    ],
  },
});
const envelope = (suggestions: unknown = [card]) => ({
  status: 'completed',
  output: [
    {
      type: 'message',
      role: 'assistant',
      status: 'completed',
      content: [{ type: 'output_text', text: JSON.stringify({ suggestions }) }],
    },
  ],
});
function setup(response: unknown = envelope()) {
  const transport = vi
    .fn<typeof fetch>()
    .mockResolvedValue(Response.json(response));
  const getApiKey = vi.fn().mockResolvedValue('synthetic-key');
  const isAuthorized = vi.fn().mockReturnValue(true);
  const options = {
    model: 'account-configured-model',
    getApiKey,
    isAuthorized,
    fetch: transport,
    timeoutMs: 1000,
  };
  return {
    transport,
    getApiKey,
    isAuthorized,
    options,
    provider: new OpenAISuggestionProvider(options),
  };
}
afterEach(() => {
  vi.useRealTimers();
  vi.restoreAllMocks();
});

describe('OpenAI suggestion adapter with synthetic HTTP only', () => {
  it.each([0, 1, 2])('returns %i validated suggestions', async (count) => {
    const suggestions = Array.from({ length: count }, () => card);
    const { provider } = setup(envelope(suggestions));
    expect(await provider.generate(request())).toEqual({
      ok: true,
      suggestions,
    });
  });
  it('uses Responses strict schema, configured model, final-only bounded data and no storage/tools', async () => {
    const { provider, transport } = setup();
    const input = request();
    const first = input.context.recent[0];
    if (!first) throw new Error('fixture');
    input.context.recent.push({
      ...first,
      type: 'partial',
      text: 'draft-only',
    });
    input.context.summary.push({
      source: 'mic',
      locale: 'pt-BR',
      segmentId: 'summary-id',
      startMs: 0,
      endMs: 100,
      text: 'Resumo sintético',
      truncated: true,
    });
    await provider.generate(input);
    const call = transport.mock.calls[0];
    expect(call?.[0]).toBe('https://api.openai.com/v1/responses');
    const init = call?.[1];
    expect(init).toMatchObject({
      method: 'POST',
      redirect: 'error',
      headers: { Authorization: 'Bearer synthetic-key' },
    });
    if (typeof init?.body !== 'string') throw new Error('body absent');
    const body: unknown = JSON.parse(init.body);
    expect(body).toMatchObject({
      model: 'account-configured-model',
      store: false,
      stream: false,
      max_output_tokens: 2048,
      text: { format: suggestionFormat },
      input: [{ role: 'user' }],
    });
    expect(init.body).not.toMatch(
      /private-session|private-id|summary-id|draft-only|synthetic-key/,
    );
    expect(body).not.toHaveProperty('tools');
    expect(body).not.toHaveProperty('previous_response_id');
    expect(init.body).toContain('Resumo sintético');
    expect(init.body).toContain('untrusted meeting data');
  });
  it('supports distinct configured models, output limits and English without fixed defaults', async () => {
    const { options, transport } = setup();
    const provider = new OpenAISuggestionProvider({
      ...options,
      model: 'another-account-model',
      maxOutputTokens: 512,
    });
    await provider.generate({ ...request(), language: 'en-US' });
    expect(transport.mock.calls[0]?.[1]?.body).toContain(
      'another-account-model',
    );
    expect(transport.mock.calls[0]?.[1]?.body).toContain(
      '"max_output_tokens":512',
    );
    expect(transport.mock.calls[0]?.[1]?.body).toContain(
      'Requested language: en-US',
    );
  });
  it('requires authorization before credential access or transport', async () => {
    const { provider, transport, getApiKey, isAuthorized } = setup();
    isAuthorized.mockReturnValue(false);
    expect(await provider.generate(request())).toEqual({
      ok: false,
      code: 'not-authorized',
    });
    expect(getApiKey).not.toHaveBeenCalled();
    expect(transport).not.toHaveBeenCalled();
  });
  it('rechecks authorization after credentials and after HTTP response', async () => {
    for (const answers of [
      [true, false],
      [true, true, false],
    ]) {
      const { provider, isAuthorized, transport } = setup();
      isAuthorized.mockReset();
      for (const answer of answers) isAuthorized.mockReturnValueOnce(answer);
      expect(await provider.generate(request())).toEqual({
        ok: false,
        code: 'not-authorized',
      });
      expect(transport).toHaveBeenCalledTimes(answers.length === 2 ? 0 : 1);
    }
  });
  it('returns silence without credentials/network for no finalized context', async () => {
    const { provider, transport, getApiKey } = setup();
    const input = request();
    input.context.recent = input.context.recent.map((s) => ({
      ...s,
      type: 'partial',
    }));
    expect(await provider.generate(input)).toEqual({
      ok: true,
      suggestions: [],
    });
    expect(transport).not.toHaveBeenCalled();
    expect(getApiKey).not.toHaveBeenCalled();
  });
  it.each([null, '', 'bad key'])(
    'rejects missing/malformed credentials %# safely',
    async (key) => {
      const { provider, getApiKey, transport } = setup();
      getApiKey.mockResolvedValue(key);
      expect(await provider.generate(request())).toEqual({
        ok: false,
        code: 'credentials-unavailable',
      });
      expect(transport).not.toHaveBeenCalled();
    },
  );
  it('sanitizes credential/transport exceptions without logging content', async () => {
    const log = vi.spyOn(console, 'error');
    const { provider, getApiKey, transport } = setup();
    getApiKey.mockRejectedValueOnce(
      new Error('synthetic-secret private transcript'),
    );
    expect(await provider.generate(request())).toEqual({
      ok: false,
      code: 'credentials-unavailable',
    });
    transport.mockRejectedValue(
      new Error('synthetic-secret private transcript'),
    );
    expect(await provider.generate(request())).toEqual({
      ok: false,
      code: 'network',
    });
    expect(log).not.toHaveBeenCalled();
  });
  it.each([
    [401, 'authentication'],
    [403, 'authentication'],
    [429, 'rate-limited'],
    [503, 'unavailable'],
    [400, 'rejected'],
    [404, 'rejected'],
    [302, 'rejected'],
  ])('sanitizes HTTP %i with no retry', async (status, code) => {
    const { provider, transport } = setup();
    transport.mockResolvedValue(
      new Response('synthetic-secret private transcript', {
        status: Number(status),
      }),
    );
    expect(await provider.generate(request())).toEqual({ ok: false, code });
    expect(transport).toHaveBeenCalledTimes(1);
  });
  it.each([
    { model: '' },
    { model: 'bad\nmodel' },
    { maxOutputTokens: 0 },
    { maxOutputTokens: 4097 },
    { timeoutMs: 0 },
    { timeoutMs: Infinity },
  ])(
    'rejects invalid configuration %# before reading credentials',
    async (overrides) => {
      const { options, getApiKey, transport } = setup();
      expect(
        await new OpenAISuggestionProvider({
          ...options,
          ...overrides,
        }).generate(request()),
      ).toEqual({ ok: false, code: 'invalid-request' });
      expect(getApiKey).not.toHaveBeenCalled();
      expect(transport).not.toHaveBeenCalled();
    },
  );
  it('rejects oversized Unicode context without sending it', async () => {
    const { provider, transport } = setup();
    const input = request();
    input.context.recent = input.context.recent.map((s) => ({
      ...s,
      text: '😀'.repeat(4000),
    }));
    expect(await provider.generate(input)).toEqual({
      ok: false,
      code: 'invalid-request',
    });
    expect(transport).not.toHaveBeenCalled();
  });
  it.each([
    null,
    {},
    { status: 'queued', output: [] },
    { status: 'completed', output: [] },
    envelope([card, card, card]),
    envelope([{ ...card, id: 'remote-id' }]),
    { status: 'completed', output: [{ type: 'function_call' }] },
    {
      status: 'completed',
      output: [
        { type: 'message', role: 'user', status: 'completed', content: [] },
      ],
    },
    {
      status: 'completed',
      output: [
        {
          type: 'message',
          role: 'assistant',
          status: 'completed',
          content: [{ type: 'output_text', text: '{' }],
        },
      ],
    },
    {
      status: 'completed',
      output: [...envelope().output, ...envelope().output],
    },
  ])('rejects malformed envelope/schema %#', async (response) => {
    expect(await setup(response).provider.generate(request())).toEqual({
      ok: false,
      code: 'invalid-response',
    });
  });
  it('allows reasoning metadata before the assistant output', async () => {
    const response = envelope();
    expect(
      await setup({
        ...response,
        output: [{ type: 'reasoning', summary: [] }, ...response.output],
      }).provider.generate(request()),
    ).toEqual({ ok: true, suggestions: [card] });
  });
  it('handles refusals and incomplete output even if a card looks valid', async () => {
    expect(
      await setup({ ...envelope(), status: 'incomplete' }).provider.generate(
        request(),
      ),
    ).toEqual({ ok: false, code: 'incomplete' });
    const response = envelope();
    const output = {
      type: 'message',
      role: 'assistant',
      status: 'completed',
      content: [{ type: 'refusal', refusal: 'private response' }],
    };
    expect(
      await setup({
        ...response,
        output: [...response.output, output],
      }).provider.generate(request()),
    ).toEqual({ ok: false, code: 'refused' });
  });
  it.each(['not JSON', 'x'.repeat(65537)])(
    'bounds and rejects raw response bodies %#',
    async (body) => {
      const { provider, transport } = setup();
      transport.mockResolvedValue(new Response(body));
      expect(await provider.generate(request())).toEqual({
        ok: false,
        code: 'invalid-response',
      });
    },
  );
  it('cancels before any credential access', async () => {
    const { provider, transport, getApiKey } = setup();
    const controller = new AbortController();
    controller.abort();
    expect(
      await provider.generate({ ...request(), signal: controller.signal }),
    ).toEqual({ ok: false, code: 'cancelled' });
    expect(transport).not.toHaveBeenCalled();
    expect(getApiKey).not.toHaveBeenCalled();
  });
  it('times out a stalled credential read and prevents a late network call', async () => {
    vi.useFakeTimers();
    const { provider, getApiKey, transport } = setup();
    let finish: (key: string) => void = () => {};
    getApiKey.mockImplementation(
      () =>
        new Promise<string>((resolve) => {
          finish = resolve;
        }),
    );
    const pending = provider.generate(request());
    await vi.advanceTimersByTimeAsync(1000);
    expect(await pending).toEqual({ ok: false, code: 'timeout' });
    finish('synthetic-key');
    await Promise.resolve();
    expect(transport).not.toHaveBeenCalled();
    expect(vi.getTimerCount()).toBe(0);
  });
  it('cancels an in-flight request and ignores its late response', async () => {
    const { provider, transport } = setup();
    const controller = new AbortController();
    let finish: (response: Response) => void = () => {};
    transport.mockImplementation(
      () =>
        new Promise<Response>((resolve) => {
          finish = resolve;
        }),
    );
    const pending = provider.generate({
      ...request(),
      signal: controller.signal,
    });
    await Promise.resolve();
    controller.abort();
    expect(await pending).toEqual({ ok: false, code: 'cancelled' });
    expect(transport.mock.calls[0]?.[1]?.signal?.aborted).toBe(true);
    finish(Response.json(envelope()));
    await Promise.resolve();
  });
  it('times out while reading a stalled response body', async () => {
    vi.useFakeTimers();
    const { provider, transport } = setup();
    const cancel = vi.fn();
    transport.mockResolvedValue(new Response(new ReadableStream({ cancel })));
    const pending = provider.generate(request());
    await vi.advanceTimersByTimeAsync(1000);
    expect(await pending).toEqual({ ok: false, code: 'timeout' });
    expect(transport.mock.calls[0]?.[1]?.signal?.aborted).toBe(true);
    expect(vi.getTimerCount()).toBe(0);
    expect(cancel).toHaveBeenCalledOnce();
  });

  it('bounds streamed bytes, cancels excess data and rejects invalid UTF-8', async () => {
    const { provider, transport } = setup();
    const cancel = vi.fn();
    transport
      .mockResolvedValueOnce(
        new Response(
          new ReadableStream({
            start(controller) {
              controller.enqueue(new Uint8Array(40_000));
              controller.enqueue(new Uint8Array(40_000));
            },
            cancel,
          }),
        ),
      )
      .mockResolvedValueOnce(new Response(new Uint8Array([255])));
    expect(await provider.generate(request())).toEqual({
      ok: false,
      code: 'invalid-response',
    });
    expect(cancel).toHaveBeenCalledOnce();
    expect(await provider.generate(request())).toEqual({
      ok: false,
      code: 'invalid-response',
    });
  });
});

describe('offline mock uses the same contract', () => {
  it('defaults to silence without calling global fetch', async () => {
    const transport = vi.spyOn(globalThis, 'fetch');
    expect(await new MockSuggestionProvider().generate(request())).toEqual({
      ok: true,
      suggestions: [],
    });
    expect(transport).not.toHaveBeenCalled();
  });
  it('copies fixture/results and handles invalid output and cancellation', async () => {
    const fixture = { suggestions: [{ ...card }] };
    const mock = new MockSuggestionProvider(fixture);
    const original = fixture.suggestions[0];
    if (!original) throw new Error('fixture');
    original.title = 'changed';
    const first = await mock.generate(request());
    expect(first).toEqual({ ok: true, suggestions: [card] });
    if (first.ok && first.suggestions[0])
      first.suggestions[0].title = 'changed again';
    expect(await mock.generate(request())).toEqual({
      ok: true,
      suggestions: [card],
    });
    expect(
      await new MockSuggestionProvider({
        suggestions: [card, card, card],
      }).generate(request()),
    ).toEqual({ ok: false, code: 'invalid-response' });
    const controller = new AbortController();
    controller.abort();
    expect(
      await mock.generate({ ...request(), signal: controller.signal }),
    ).toEqual({ ok: false, code: 'cancelled' });
  });
});
