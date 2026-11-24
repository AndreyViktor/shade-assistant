import { describe, expect, it } from 'vitest';
import { parseVideoFactCheck } from './videoFactCheck';
import type { MeetingContext } from '../../core/meeting/ContextManager';

const context: MeetingContext = {
  summary: [],
  recent: [
    {
      version: 1,
      type: 'final',
      sessionId: 'session',
      source: 'system',
      locale: 'pt-BR',
      seq: 1,
      timestampMs: 1000,
      startMs: 0,
      endMs: 1000,
      segmentId: 's1',
      text: 'A água ferve a 50 graus ao nível do mar.',
    },
  ],
};
const correction = {
  title: 'Temperatura de ebulição',
  body: 'A água ferve a 100 °C ao nível do mar, não a 50 °C.',
  source: 'system',
  segmentId: 's1',
  url: 'https://example.org/agua',
};
function response(
  corrections: unknown[],
  annotations: unknown[] = [
    { type: 'url_citation', url: correction.url, title: 'Fonte sintética' },
  ],
  search = true,
) {
  return {
    status: 'completed',
    output: [
      ...(search
        ? [
            {
              type: 'web_search_call',
              status: 'completed',
              action: { type: 'search' },
            },
          ]
        : []),
      {
        type: 'message',
        role: 'assistant',
        status: 'completed',
        content: [
          {
            type: 'output_text',
            text: JSON.stringify({ corrections }),
            annotations,
          },
        ],
      },
    ],
  };
}
describe('video fact checks from synthetic search responses', () => {
  it('distinguishes an incomplete API response from an invalid format', () => {
    expect(parseVideoFactCheck({ status: 'incomplete' }, context)).toEqual({
      ok: false,
      code: 'incomplete',
    });
  });
  it('resolves the transcript and cited source for a correction', () => {
    expect(parseVideoFactCheck(response([correction]), context)).toEqual({
      ok: true,
      resultUpdates: [],
      suggestions: [
        {
          category: 'warning',
          title: correction.title,
          body: correction.body,
          groundedIn: 'inference',
          citation: {
            url: correction.url,
            title: 'Fonte sintética',
            startMs: 0,
            excerpt: context.recent[0]?.text,
          },
        },
      ],
    });
  });
  it('accepts silence without search for correct or unverifiable claims', () => {
    expect(parseVideoFactCheck(response([], [], false), context)).toEqual({
      ok: true,
      suggestions: [],
      resultUpdates: [],
    });
  });
  it.each([
    response([correction], [], true),
    response([correction], undefined, false),
    response([{ ...correction, segmentId: 'invented' }]),
    response(
      [{ ...correction, url: 'javascript:alert(1)' }],
      [{ type: 'url_citation', url: 'javascript:alert(1)', title: 'Fake' }],
    ),
    response([{ ...correction, source: 'mic' }]),
  ])('rejects missing or unsafe evidence %#', (input) => {
    expect(parseVideoFactCheck(input, context)).toEqual({
      ok: false,
      code: 'invalid-response',
    });
  });
});
