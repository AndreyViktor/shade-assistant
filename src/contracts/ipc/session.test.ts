import { describe, expect, it } from 'vitest';
import { parseSessionRequest, parseSessionResult } from './session';
const options = {
  mode: 'demo',
  consent: { capture: false, context: false, remoteAudio: false },
};
const start = { version: 1, action: 'start', options };
describe('strict session contract', () => {
  it('accepts the versioned allowlist and snapshots', () => {
    expect(parseSessionRequest(start)).toEqual(start);
    for (const action of ['read', 'pause', 'resume', 'stop'])
      expect(parseSessionRequest({ version: 1, action })).toEqual({
        version: 1,
        action,
      });
    const result = {
      version: 1,
      ok: true,
      session: { phase: 'running', ...options },
    };
    expect(parseSessionResult(result)).toEqual(result);
    expect(
      parseSessionResult({ version: 1, ok: false, code: 'TIMEOUT' }),
    ).toEqual({ version: 1, ok: false, code: 'TIMEOUT' });
  });
  it.each([
    null,
    [],
    {},
    { ...start, version: 2 },
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
    { version: 1, action: 'stop', extra: true },
  ])('rejects malformed requests %#', (request) => {
    expect(parseSessionRequest(request)).toBeNull();
  });
  it.each([
    null,
    { version: 2, ok: true, session: { phase: 'idle', ...options } },
    { version: 1, ok: true, session: { phase: 'unknown', ...options } },
    {
      version: 1,
      ok: true,
      session: { phase: 'idle', ...options, secret: 'synthetic' },
    },
    {
      version: 1,
      ok: true,
      session: { phase: 'idle', ...options },
      extra: true,
    },
  ])('rejects malformed replies %#', (reply) => {
    expect(parseSessionResult(reply)).toEqual({
      version: 1,
      ok: false,
      code: 'INVALID_RESPONSE',
    });
  });
});
