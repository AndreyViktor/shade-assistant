import { describe, expect, it } from 'vitest';
import { emptyDemo, parseDemoSnapshot } from './demo';
import { parseSessionResult } from '../ipc/session';

const transcript = {
  sequence: 2,
  source: 'system',
  locale: 'pt-BR',
  text: 'Pergunta sintética?',
};
const card = {
  id: 'demo-1-2',
  category: 'question',
  title: 'Contexto',
  body: 'Esclareça o contexto.',
  groundedIn: 'inference',
  expiresAt: 30000,
};
const snapshot = {
  transcript,
  suggestions: [card],
  completed: false,
};
describe('strict bounded demo snapshot', () => {
  it('accepts empty, transcript-only and suggestion card snapshots', () => {
    for (const value of [
      emptyDemo(),
      snapshot,
      { ...snapshot, suggestions: [] },
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
    { ...snapshot, suggestion: null }, // Legacy v1 payload is rejected.
    { ...snapshot, suggestions: null },
    {
      ...snapshot,
      suggestions: [card, { ...card, id: 'second' }, { ...card, id: 'third' }],
    },
    { ...snapshot, suggestions: [card, card] },
    { ...snapshot, suggestions: [{ ...card, category: 'unknown' }] },
    { ...snapshot, suggestions: [{ ...card, body: 'x'.repeat(301) }] },
    { ...snapshot, suggestions: [{ ...card, title: 'x'.repeat(81) }] },
    { ...snapshot, suggestions: [{ ...card, title: ' ' }] },
    { ...snapshot, suggestions: [{ ...card, body: '' }] },
    { ...snapshot, suggestions: [{ ...card, id: '../path' }] },
    { ...snapshot, suggestions: [{ ...card, groundedIn: 'fact' }] },
    { ...snapshot, suggestions: [{ ...card, expiresAt: Infinity }] },
    { ...snapshot, suggestions: [{ ...card, expiresAt: -1 }] },
    { ...snapshot, suggestions: [{ ...card, expiresAt: 0.5 }] },
    { ...snapshot, suggestions: [{ ...card, secret: 'synthetic' }] },
  ])('rejects invalid content at the parser and IPC boundary %#', (value) => {
    expect(parseDemoSnapshot(value)).toBeNull();
    expect(
      parseSessionResult({
        version: 2,
        ok: true,
        session: {
          phase: 'running',
          mode: 'demo',
          consent: { capture: false, context: false, remoteAudio: false },
        },
        demo: value,
      }),
    ).toEqual({ version: 2, ok: false, code: 'INVALID_RESPONSE' });
  });
});
