// @vitest-environment node
import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { NativeJsonlDecoder } from '../../src/contracts/native/NativeJsonlDecoder';
import { NativeEventOrder } from '../../src/contracts/native/NativeEventOrder';
import {
  encodeNativeCommand,
  MAX_JSONL_BYTES,
  MAX_TRANSCRIPT_LENGTH,
  NATIVE_ERROR_CODES,
  NativeProtocolError,
  parseNativeCommand,
  parseTranscriptionEvent,
} from '../../src/contracts/native/protocol';
import type {
  ProtocolErrorCode,
  TranscriptionConfig,
  TranscriptionEvent,
} from '../../src/contracts/native/protocol';

const fixtureDirectory = new URL(
  '../../native/macos/Tests/MeetingCopilotProtocolTests/Fixtures/',
  import.meta.url,
);
function fixture(name: string): unknown[] {
  const result: unknown = JSON.parse(
    readFileSync(new URL(`${name}.json`, fixtureDirectory), 'utf8'),
  );
  if (!Array.isArray(result)) throw new Error('Invalid fixture');
  return result;
}
function framingCase(value: unknown): {
  prefix: number[];
  suffix: number[];
  valid: boolean;
} {
  if (
    typeof value !== 'object' ||
    value === null ||
    !('prefix' in value) ||
    !('suffix' in value) ||
    !('valid' in value) ||
    !Array.isArray(value.prefix) ||
    !Array.isArray(value.suffix) ||
    typeof value.valid !== 'boolean'
  )
    throw new Error('Invalid framing fixture');
  const byte = (entry: unknown): entry is number =>
    typeof entry === 'number' &&
    Number.isInteger(entry) &&
    entry >= 0 &&
    entry <= 255;
  if (!value.prefix.every(byte) || !value.suffix.every(byte))
    throw new Error('Invalid bytes');
  return { prefix: value.prefix, suffix: value.suffix, valid: value.valid };
}
const events = fixture('events').map(parseTranscriptionEvent);
const config: TranscriptionConfig = {
  sessionId: 'fixture-session',
  sources: ['mic', 'system'],
  locale: 'pt-BR',
};
const micConfig: TranscriptionConfig = { ...config, sources: ['mic'] };
const encoder = new TextEncoder();
function bytes(values: unknown[], ending = '\n'): Uint8Array {
  return encoder.encode(
    values.map((value) => JSON.stringify(value)).join(ending) + ending,
  );
}
function event(index: number): TranscriptionEvent {
  const result = events[index];
  if (!result) throw new Error('Missing fixture event');
  return result;
}
function expectCode(action: () => unknown, code: ProtocolErrorCode): void {
  expect(action).toThrow(new NativeProtocolError(code));
}

// These exact JSON objects are also asserted against the real Swift event encoder.
describe('native v1 shared Swift/TypeScript wire fixtures', () => {
  it.each(fixture('commands'))('accepts and encodes command %#', (value) => {
    expect(
      JSON.parse(
        new TextDecoder().decode(
          encodeNativeCommand(parseNativeCommand(value)),
        ),
      ),
    ).toEqual(value);
  });
  it.each(fixture('invalid-commands').map((value) => ({ value })))(
    'rejects invalid command %#',
    ({ value }) => {
      expect(() => parseNativeCommand(value)).toThrow(NativeProtocolError);
    },
  );
  it('accepts all six event kinds with independent channel clocks and sequences', () => {
    const decoder = new NativeJsonlDecoder(config);
    expect(decoder.push(bytes(events))).toEqual(events);
    expect(() => decoder.finish()).not.toThrow();
  });
  it('agrees with Swift on shared framing and text cases', () => {
    for (const value of fixture('framing')) {
      const { prefix, suffix, valid } = framingCase(value);
      const frame = Uint8Array.from([
        ...prefix,
        ...encoder.encode(JSON.stringify(event(0))),
        ...suffix,
        10,
      ]);
      const decoder = new NativeJsonlDecoder(config);
      if (valid) expect(decoder.push(frame)).toEqual([event(0)]);
      else expect(() => decoder.push(frame)).toThrow(NativeProtocolError);
    }
    for (const value of fixture('text')) {
      if (
        typeof value !== 'object' ||
        value === null ||
        !('text' in value) ||
        !('valid' in value)
      )
        throw new Error('Invalid text fixture');
      const parse = () =>
        parseTranscriptionEvent({ ...event(4), text: value.text });
      if (value.valid === true)
        expect(parse()).toMatchObject({ text: value.text });
      else expect(parse).toThrow(NativeProtocolError);
    }
  });
  it('accepts one-byte chunks, including emoji, accents and escaped newlines', () => {
    const decoder = new NativeJsonlDecoder(config);
    const received: TranscriptionEvent[] = [];
    for (const byte of bytes(events))
      received.push(...decoder.push(Uint8Array.of(byte)));
    expect(received).toEqual(events);
    decoder.finish();
  });
  it('accepts every possible two-chunk split and CRLF', () => {
    const stream = bytes(events, '\r\n');
    for (let split = 0; split <= stream.length; split++) {
      const decoder = new NativeJsonlDecoder(config);
      expect([
        ...decoder.push(stream.slice(0, split)),
        ...decoder.push(stream.slice(split)),
      ]).toEqual(events);
      decoder.finish();
    }
  });
  it('supports en-US as a single configured locale without claiming bilingual support', () => {
    const decoder = new NativeJsonlDecoder({ ...config, locale: 'en-US' });
    expect(
      decoder.push(
        bytes(events.map((entry) => ({ ...entry, locale: 'en-US' }))),
      ),
    ).toHaveLength(events.length);
    decoder.finish();
  });
});

describe('event schemas and safe errors', () => {
  it.each(
    [
      null,
      [],
      {},
      { ...event(0), version: 2 },
      { ...event(0), version: true },
      { ...event(0), source: 'speaker-1' },
      { ...event(0), locale: 'pt_BR' },
      { ...event(0), sessionId: '' },
      { ...event(0), sessionId: 'x'.repeat(65) },
      { ...event(0), type: 'unknown' },
      { ...event(0), supportsPartial: 1 },
      { ...event(0), seq: 0 },
      { ...event(0), seq: -1 },
      { ...event(0), seq: 1.5 },
      { ...event(0), seq: Number.MAX_SAFE_INTEGER + 1 },
      { ...event(0), timestampMs: Infinity },
      { ...event(0), timestampMs: NaN },
      { ...event(0), timestampMs: -1 },
      { ...event(0), timestampMs: '0' },
      { ...event(0), extra: 'synthetic-secret' },
      { ...event(4), text: '' },
      { ...event(4), text: ' \n\t' },
      { ...event(4), text: '\uD800' },
      { ...event(4), text: '\uDC00' },
      { ...event(4), text: 'x'.repeat(MAX_TRANSCRIPT_LENGTH + 1) },
      { ...event(4), text: '👋'.repeat(MAX_TRANSCRIPT_LENGTH / 2 + 1) },
      { ...event(4), segmentId: 'bad id' },
      { ...event(4), startMs: 91 },
      { ...event(4), endMs: 101 },
      { ...event(4), endMs: null },
      { ...event(2), state: 'recording' },
      { ...event(10), code: 'synthetic-secret' },
      { ...event(9), reason: 'unknown' },
    ].map((value) => ({ value })),
  )('rejects invalid event %#', ({ value }) => {
    expectCode(
      () => parseTranscriptionEvent(value),
      typeof value === 'object' &&
        value !== null &&
        'version' in value &&
        value.version !== 1
        ? 'unsupported-version'
        : 'invalid-message',
    );
  });
  it('requires each envelope/payload key', () => {
    for (const value of events)
      for (const key of Object.keys(value)) {
        const incomplete: Record<string, unknown> = { ...value };
        delete incomplete[key];
        expect(() => parseTranscriptionEvent(incomplete)).toThrow(
          NativeProtocolError,
        );
      }
  });
  it.each(NATIVE_ERROR_CODES)('accepts only fixed error code %s', (code) => {
    expect(parseTranscriptionEvent({ ...event(10), code })).toMatchObject({
      code,
    });
  });
  it('accepts text and integer boundaries', () => {
    expect(
      parseTranscriptionEvent({
        ...event(4),
        text: '👋'.repeat(2048),
        seq: Number.MAX_SAFE_INTEGER,
        timestampMs: Number.MAX_SAFE_INTEGER,
      }),
    ).toMatchObject({ seq: Number.MAX_SAFE_INTEGER });
  });
  it('reports an explicit unsupported version', () => {
    expectCode(
      () => parseTranscriptionEvent({ ...event(0), version: 999 }),
      'unsupported-version',
    );
  });
  it('never includes raw JSON or transcript in errors', () => {
    const decoder = new NativeJsonlDecoder(config);
    try {
      decoder.push(encoder.encode('{"synthetic-secret":\n'));
    } catch (error) {
      expect(error).toBeInstanceOf(NativeProtocolError);
      expect(String(error)).not.toContain('synthetic-secret');
      expect(error).not.toHaveProperty('cause');
      return;
    }
    throw new Error('Expected failure');
  });
});

describe('incremental framing and end of stream', () => {
  it.each(['\n', 'diagnostic log\n', '{\n', '\uFEFF{}\n', 'null\n', '[]\n'])(
    'rejects invalid frame %#',
    (line) => {
      expect(() =>
        new NativeJsonlDecoder(config).push(encoder.encode(line)),
      ).toThrow(NativeProtocolError);
    },
  );
  it('rejects malformed UTF-8 without replacement characters', () => {
    expectCode(
      () => new NativeJsonlDecoder(config).push(Uint8Array.of(0xff, 10)),
      'invalid-utf8',
    );
  });
  it('rejects escaped lone surrogates from JSON and discards a failed batch', () => {
    const decoder = new NativeJsonlDecoder(config);
    expectCode(
      () =>
        decoder.push(
          bytes([event(0), event(2), { ...event(4), text: '\uD800' }]),
        ),
      'invalid-message',
    );
    expectCode(() => decoder.finish(), 'closed-stream');
  });
  it('bounds incomplete lines and closes permanently on failure', () => {
    const decoder = new NativeJsonlDecoder(config);
    decoder.push(new Uint8Array(MAX_JSONL_BYTES).fill(32));
    expectCode(() => decoder.push(Uint8Array.of(32)), 'line-too-large');
    expectCode(() => decoder.push(bytes(events)), 'closed-stream');
    expectCode(() => decoder.finish(), 'closed-stream');
  });
  it('accepts a valid line exactly at the byte limit', () => {
    const json = JSON.stringify(event(0));
    const decoder = new NativeJsonlDecoder(config);
    expect(
      decoder.push(
        encoder.encode(
          json +
            ' '.repeat(MAX_JSONL_BYTES - encoder.encode(json).length) +
            '\n',
        ),
      ),
    ).toEqual([event(0)]);
  });
  it('counts UTF-8 bytes, not characters, toward the frame limit', () => {
    const decoder = new NativeJsonlDecoder(config);
    expectCode(
      () => decoder.push(encoder.encode('é'.repeat(MAX_JSONL_BYTES / 2 + 1))),
      'line-too-large',
    );
  });
  it.each(['{', JSON.stringify(event(0)), '\r', 'é'])(
    'rejects unfinished frame %# at EOF',
    (line) => {
      const decoder = new NativeJsonlDecoder(config);
      decoder.push(encoder.encode(line));
      expectCode(() => decoder.finish(), 'truncated-line');
      expectCode(() => decoder.push(bytes(events)), 'closed-stream');
    },
  );
  it('requires stopped for every selected source even at a clean line boundary', () => {
    const decoder = new NativeJsonlDecoder(config);
    decoder.push(bytes(events.slice(0, -1)));
    expectCode(() => decoder.finish(), 'incomplete-stream');
    expectCode(
      () => new NativeJsonlDecoder(config).finish(),
      'incomplete-stream',
    );
  });
  it('rejects input after successful EOF', () => {
    const decoder = new NativeJsonlDecoder(config);
    decoder.push(bytes(events));
    decoder.finish();
    expectCode(() => decoder.push(new Uint8Array()), 'closed-stream');
  });
});

describe('session and channel ordering', () => {
  it.each(
    [
      [event(0), event(0)], // duplicate
      [event(2)], // missing ready / sequence gap
      [event(0), { ...event(2), seq: 3 }],
      [event(0), { ...event(2), seq: 1 }],
      [{ ...event(0), sessionId: 'previous-session' }],
      [{ ...event(0), source: 'system' }],
      [{ ...event(0), locale: 'en-US' }],
      [event(0), { ...event(4), seq: 2 }], // transcript before listening
      [{ ...event(0), supportsPartial: false }, event(2), event(4)],
      [
        event(0),
        event(2),
        { ...event(7), seq: 3 },
        { ...event(4), seq: 4, timestampMs: 121, endMs: 120 },
      ],
      [
        event(0),
        event(2),
        { ...event(4), timestampMs: 0, startMs: 0, endMs: 0 },
      ],
      [event(0), event(2), { ...event(2), seq: 3 }], // repeated listening
      [event(0), { ...event(7), seq: 2 }], // pause before listening
      [event(0), { ...event(0), seq: 2 }], // repeated ready
      [event(0), { ...event(9), seq: 2, reason: 'error' }],
      [
        event(0),
        { ...event(9), seq: 2 },
        { ...event(2), seq: 3, timestampMs: 141 },
      ],
      [
        { ...event(10), source: 'mic', seq: 1 },
        { ...event(2), timestampMs: 151 },
      ],
      [
        { ...event(10), source: 'mic', seq: 1 },
        { ...event(9), seq: 2, timestampMs: 151 },
      ],
    ].map((values) => ({ values })),
  )('rejects invalid stream %#', ({ values }) => {
    const decoder = new NativeJsonlDecoder(micConfig);
    expectCode(() => decoder.push(bytes(values)), 'invalid-order');
    expectCode(() => decoder.push(bytes(events)), 'closed-stream');
  });
  it('accepts startup failure followed by stopped/error without inventing ready', () => {
    const decoder = new NativeJsonlDecoder(micConfig);
    const failure = [
      { ...event(10), source: 'mic', seq: 1 },
      { ...event(11), source: 'mic', seq: 2 },
    ];
    expect(decoder.push(bytes(failure))).toEqual(failure);
    decoder.finish();
  });
  it('allows cancellation during startup without inventing ready', () => {
    const decoder = new NativeJsonlDecoder(micConfig);
    decoder.push(bytes([{ ...event(9), seq: 1 }]));
    decoder.finish();
    expectCode(
      () =>
        new NativeJsonlDecoder(micConfig).push(
          bytes([{ ...event(9), seq: 1, reason: 'completed' }]),
        ),
      'invalid-order',
    );
  });
  it('keeps a new session independent from a completed one', () => {
    const first = new NativeJsonlDecoder(config);
    first.push(bytes(events));
    first.finish();
    const second = new NativeJsonlDecoder({
      ...config,
      sessionId: 'next-session',
    });
    second.push(
      bytes(events.map((value) => ({ ...value, sessionId: 'next-session' }))),
    );
    second.finish();
  });
  it('does not require partials or matching partial/final ranges', () => {
    const decoder = new NativeJsonlDecoder(micConfig);
    decoder.push(
      bytes([
        { ...event(0), supportsPartial: false },
        event(2),
        { ...event(5), seq: 3 },
        { ...event(9), seq: 4, reason: 'completed' },
      ]),
    );
    decoder.finish();
  });
  it('copies configuration and rejects invalid requested sources', () => {
    const mutable = { ...micConfig, sources: [...micConfig.sources] };
    const order = new NativeEventOrder(mutable);
    mutable.sources.push('system');
    expectCode(() => order.accept(event(1)), 'invalid-order');
    expectCode(
      () => new NativeEventOrder({ ...config, sources: [] }),
      'invalid-message',
    );
  });
});
