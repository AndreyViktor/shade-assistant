import { expect, it } from 'vitest';
import { parseSessionResult } from '../../src/contracts/ipc/session';
import { emptyDemo } from '../../src/contracts/meeting/demo';
import { createMeetingCopilotApi } from '../../src/preload/createMeetingCopilotApi';

const card = {
  id: 'suggestion-1',
  category: 'question',
  title: 'Prazo',
  body: 'Confirme o prazo fictício.',
  groundedIn: 'inference',
  expiresAt: null,
};
const reply = {
  version: 9,
  ok: true,
  session: {
    phase: 'running',
    mode: 'apple-local',
    consent: { capture: true, context: true, remoteAudio: false },
  },
  demo: emptyDemo(),
  local: null,
  suggestions: {
    items: [card],
    remainingRequests: 0,
    status: 'exhausted',
    diagnostics: {
      model: 'synthetic-model',
      maxRequests: 1,
      activity: 'waiting-trigger',
      lastTrigger: 'question',
      lastAttempt: null,
    },
  },
  results: { items: [] },
};

it('carries retained cards through the versioned parser and preload without loss', async () => {
  expect(parseSessionResult(reply)).toEqual(reply);
  const api = createMeetingCopilotApi(() => Promise.resolve(reply));
  expect(await api.session({ version: 9, action: 'read' })).toEqual(reply);
  expect(parseSessionResult({ ...reply, version: 5 })).toEqual({
    version: 9,
    ok: false,
    code: 'INVALID_RESPONSE',
  });
});

it('carries the full session card ceiling through IPC and preload without eviction', async () => {
  const items = Array.from({ length: 800 }, (_, index) => ({
    ...card,
    id: `suggestion-${index + 1}`,
    body: `Distinct synthetic card ${index + 1}`,
  }));
  const fullReply = {
    ...reply,
    suggestions: { ...reply.suggestions, items },
  };
  expect(parseSessionResult(fullReply)).toEqual(fullReply);
  const api = createMeetingCopilotApi(() => Promise.resolve(fullReply));
  expect(await api.session({ version: 9, action: 'read' })).toEqual(fullReply);
});

it.each(
  [
    Array.from({ length: 801 }, (_, index) => ({
      ...card,
      id: `suggestion-${index + 1}`,
      body: `Distinct synthetic card ${index + 1}`,
    })),
    [card, card],
    [{ ...card, expiresAt: 30000 }],
    [{ ...card, expiresAt: undefined }],
    [{ ...card, expiresAt: Infinity }],
    [{ ...card, expiresAt: 'never' }],
    [{ ...card, body: 'x'.repeat(301) }],
    [{ ...card, title: 'x'.repeat(81) }],
    [{ ...card, id: 'x'.repeat(81) }],
    [{ ...card, secret: 'synthetic-secret' }],
  ].map((items) => ({ items })),
)('rejects invalid retained cards at IPC and preload %#', async ({ items }) => {
  const invalid = { ...reply, suggestions: { ...reply.suggestions, items } };
  const failure = { version: 9, ok: false, code: 'INVALID_RESPONSE' };
  expect(parseSessionResult(invalid)).toEqual(failure);
  const api = createMeetingCopilotApi(() => Promise.resolve(invalid));
  expect(await api.session({ version: 9, action: 'read' })).toEqual(failure);
});

it('rejects content or remaining budget in a disabled suggestion snapshot', () => {
  for (const patch of [
    { items: [card], remainingRequests: 0 },
    { items: [], remainingRequests: 1 },
  ]) {
    expect(
      parseSessionResult({
        ...reply,
        suggestions: { ...patch, status: 'disabled', diagnostics: null },
      }),
    ).toEqual({ version: 9, ok: false, code: 'INVALID_RESPONSE' });
  }
});
