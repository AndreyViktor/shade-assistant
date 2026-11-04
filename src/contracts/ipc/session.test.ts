import { emptyDemo } from '../meeting/demo';
import { describe, expect, it } from 'vitest';
import { parseSessionRequest, parseSessionResult } from './session';
const options = {
  mode: 'demo',
  consent: { capture: false, context: false, remoteAudio: false },
};
const start = { version: 2, action: 'start', options };
describe('strict session contract', () => {
  it('accepts the versioned allowlist and snapshots', () => {
    expect(parseSessionRequest(start)).toEqual(start);
    const dismiss = {
      version: 2,
      action: 'dismiss-suggestion',
      id: 'demo-1-2',
    };
    expect(parseSessionRequest(dismiss)).toEqual(dismiss);
    for (const action of ['read', 'pause', 'resume', 'stop'])
      expect(parseSessionRequest({ version: 2, action })).toEqual({
        version: 2,
        action,
      });
    const result = {
      version: 2,
      ok: true,
      demo: emptyDemo(),
      session: { phase: 'running', ...options },
    };
    expect(parseSessionResult(result)).toEqual(result);
    expect(
      parseSessionResult({ version: 2, ok: false, code: 'TIMEOUT' }),
    ).toEqual({ version: 2, ok: false, code: 'TIMEOUT' });
  });
  it.each([
    null,
    [],
    {},
    { ...start, version: 99 },
    { ...start, version: 1 },
    { version: 2, action: 'dismiss-suggestion' },
    { version: 2, action: 'dismiss-suggestion', id: '' },
    { version: 2, action: 'dismiss-suggestion', id: 'x'.repeat(81) },
    { version: 2, action: 'dismiss-suggestion', id: 1 },
    { version: 2, action: 'dismiss-suggestion', id: 'ok', extra: true },
    { ...start, action: 'send' },
    { ...start, options: { ...options, mode: 'unknown' } },
    { ...start, options: { ...options, consent: { capture: true } } },
    {
      ...start,
      options: { ...options, consent: { ...options.consent, context: 'yes' } },
    },
    { ...start, options: { ...options, key: 'synthetic' } },
    {
      ...start,
      options: {
        ...options,
        consent: { ...options.consent, screenshot: true },
      },
    },
    { version: 2, action: 'stop', extra: true },
  ])('rejects malformed requests %#', (request) => {
    expect(parseSessionRequest(request)).toBeNull();
  });
  it.each([
    null,
    {
      version: 1,
      ok: true,
      session: { phase: 'idle', ...options },
      demo: emptyDemo(),
    },
    { version: 1, ok: false, code: 'TIMEOUT' },
    { version: 99, ok: true, session: { phase: 'idle', ...options } },
    { version: 2, ok: true, session: { phase: 'unknown', ...options } },
    {
      version: 2,
      ok: true,
      session: { phase: 'idle', ...options, secret: 'synthetic' },
    },
    {
      version: 2,
      ok: true,
      session: { phase: 'idle', ...options },
      extra: true,
    },
  ])('rejects malformed replies %#', (reply) => {
    expect(parseSessionResult(reply)).toEqual({
      version: 2,
      ok: false,
      code: 'INVALID_RESPONSE',
    });
  });
});
