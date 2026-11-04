import { describe, expect, it } from 'vitest';
import { emptyDemo, parseDemoSnapshot } from './demo';
import { parseSessionResult } from '../ipc/session';

const transcript = {
  sequence: 2,
  source: 'system',
  locale: 'pt-BR',
  text: 'Pergunta sintética?',
};
const snapshot = {
  transcript,
  suggestion: { sequence: 2, text: 'Esclareça o contexto.' },
  completed: false,
};
describe('strict bounded demo snapshot', () => {
  it('accepts empty, transcript-only and correlated suggestion snapshots', () => {
    for (const value of [
      emptyDemo(),
      snapshot,
      { ...snapshot, suggestion: null },
      { ...snapshot, completed: true },
    ])
      expect(parseDemoSnapshot(value)).toEqual(value);
  });
  it.each([
    null,
    {},
    { ...snapshot, completed: 'yes' },
    { ...snapshot, secret: 'synthetic' },
    { ...snapshot, transcript: { ...transcript, source: 'speaker' } },
    { ...snapshot, transcript: { ...transcript, locale: 'en-US' } },
    { ...snapshot, transcript: { ...transcript, sequence: 0 } },
    { ...snapshot, transcript: { ...transcript, sequence: 1.5 } },
    { ...snapshot, transcript: { ...transcript, sequence: Infinity } },
    { ...snapshot, transcript: { ...transcript, text: 'x'.repeat(501) } },
    { ...snapshot, transcript: { ...transcript, text: '  ' } },
    { ...snapshot, transcript: { ...transcript, key: 'synthetic' } },
    { ...snapshot, transcript: null },
    { ...snapshot, suggestion: { sequence: 1, text: 'Unrelated' } },
    { ...snapshot, suggestion: { sequence: 2, text: 'x'.repeat(501) } },
    { ...snapshot, suggestion: { sequence: 2, text: '' } },
    {
      ...snapshot,
      suggestion: { sequence: 2, text: 'valid', secret: 'synthetic' },
    },
  ])('rejects invalid content at the parser and IPC boundary %#', (value) => {
    expect(parseDemoSnapshot(value)).toBeNull();
    expect(
      parseSessionResult({
        version: 1,
        ok: true,
        session: {
          phase: 'running',
          mode: 'demo',
          consent: { capture: false, context: false, remoteAudio: false },
        },
        demo: value,
      }),
    ).toEqual({ version: 1, ok: false, code: 'INVALID_RESPONSE' });
  });
});
