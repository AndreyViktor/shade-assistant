// @vitest-environment node
import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { parseEnv } from 'node:util';
import { expect, it } from 'vitest';
import { OpenAISuggestionProvider } from '../../src/infrastructure/ai/OpenAISuggestionProvider';
import type { MeetingContext } from '../../src/core/meeting/ContextManager';

// Explicit one-case opt-in; each execution dispatches at most one request.
const caseId = process.env['MEETING_COPILOT_AUTHORIZED_VIDEO_CASE'];
const cases: Record<string, string> = {
  false: 'A capital da Austrália é Sydney.',
  correct: 'A capital da Austrália é Canberra.',
  ambiguous: 'Parece que aquilo talvez tenha mudado um pouco.',
};

function record(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

it.skipIf(!caseId || !(caseId in cases))(
  'runs one separately authorized synthetic video fact-check request',
  async () => {
    const text = caseId ? cases[caseId] : undefined;
    if (!text) throw new Error('Authorized case unavailable');
    const key = parseEnv(
      await readFile(resolve('.env'), 'utf8'),
    ).OPENAI_API_KEY;
    if (typeof key !== 'string' || key.length < 20 || /\s/.test(key))
      throw new Error('Authorized development credential unavailable');
    const context: MeetingContext = {
      recent: [
        {
          version: 1,
          sessionId: 'synthetic-video',
          source: 'system',
          locale: 'pt-BR',
          seq: 1,
          timestampMs: 1000,
          type: 'final',
          segmentId: 'synthetic-segment',
          startMs: 0,
          endMs: 1000,
          text,
        },
      ],
      summary: [],
    };
    let dispatched = false;
    let metadata: Record<string, unknown> | undefined;
    const transport: typeof fetch = async (input, init) => {
      if (dispatched) throw new Error('Only one request is authorized per run');
      dispatched = true;
      const response = await fetch(input, init);
      const payload: unknown = await response.clone().json();
      if (record(payload)) {
        const output: unknown[] = Array.isArray(payload.output)
          ? payload.output
          : [];
        const parts = output.flatMap((item): unknown[] =>
          record(item) && Array.isArray(item.content) ? item.content : [],
        );
        const part = parts.find(
          (item) => record(item) && item.type === 'output_text',
        );
        const annotations =
          record(part) && Array.isArray(part.annotations)
            ? part.annotations
            : [];
        const sources: unknown[] = output.flatMap((item): unknown[] =>
          record(item) &&
          record(item.action) &&
          Array.isArray(item.action.sources)
            ? item.action.sources
            : [],
        );
        let corrections: unknown[] = [];
        let jsonValid = false;
        if (record(part) && typeof part.text === 'string') {
          try {
            const parsed: unknown = JSON.parse(part.text);
            jsonValid = true;
            if (record(parsed) && Array.isArray(parsed.corrections))
              corrections = parsed.corrections;
          } catch {
            // The response shape, never its content, is reported below.
          }
        }
        metadata = {
          httpStatus: response.status,
          status: payload.status,
          incompleteReason: record(payload.incomplete_details)
            ? payload.incomplete_details.reason
            : null,
          outputTypes: output.map((item) => (record(item) ? item.type : null)),
          searchActions: output
            .filter((item) => record(item) && item.type === 'web_search_call')
            .map((item) =>
              record(item) && record(item.action) ? item.action.type : null,
            ),
          jsonValid,
          corrections: corrections.length,
          syntheticCorrections: corrections
            .filter(record)
            .map((correction) => ({
              title: correction.title,
              body: correction.body,
              url: correction.url,
            })),
          annotationTypes: annotations.map((item) =>
            record(item) ? item.type : null,
          ),
          matchingCitationCount: corrections.filter(
            (correction) =>
              record(correction) &&
              annotations.some(
                (annotation) =>
                  record(annotation) &&
                  annotation.type === 'url_citation' &&
                  annotation.url === correction.url,
              ),
          ).length,
          sourceCount: sources.length,
          matchingSourceCount: corrections.filter(
            (correction) =>
              record(correction) &&
              sources.some(
                (source) => record(source) && source.url === correction.url,
              ),
          ).length,
          mentionsCanberra: corrections.some(
            (correction) =>
              record(correction) &&
              typeof correction.body === 'string' &&
              /canberra/i.test(correction.body),
          ),
          usage: record(payload.usage)
            ? {
                inputTokens: payload.usage.input_tokens,
                outputTokens: payload.usage.output_tokens,
              }
            : null,
        };
      }
      return response;
    };
    const provider = new OpenAISuggestionProvider({
      model: 'gpt-5.4-mini',
      getApiKey: () => Promise.resolve(key),
      isAuthorized: () => true,
      fetch: transport,
      timeoutMs: 60_000,
      maxOutputTokens: 2048,
    });
    const result = await provider.generate({
      context,
      meetingProfile: 'video-fact-check',
      videoNewSegmentIds: ['synthetic-segment'],
      language: 'pt-BR',
      signal: new AbortController().signal,
    });
    // Fixed synthetic inputs only; no key or request body is logged. Card text
    // and public source URLs are necessary to inspect unexpected corrections.
    console.log(
      JSON.stringify({
        caseId,
        dispatched,
        metadata,
        result: result.ok
          ? {
              ok: true,
              suggestions: result.suggestions.length,
              cards: result.suggestions.map(({ title, body, citation }) => ({
                title,
                body,
                sourceUrl: citation?.url ?? null,
              })),
            }
          : result,
      }),
    );
    expect(dispatched).toBe(true);
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    if (caseId === 'false') {
      expect(result.suggestions.length).toBeGreaterThan(0);
      expect(
        result.suggestions.some(
          (card) => /canberra/i.test(card.body) && Boolean(card.citation),
        ),
      ).toBe(true);
    } else {
      expect(result.suggestions).toHaveLength(0);
    }
  },
  90_000,
);
