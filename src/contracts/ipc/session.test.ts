import { emptyDemo } from '../meeting/demo';
import { describe, expect, it } from 'vitest';
import { parseSessionRequest, parseSessionResult } from './session';
const options = {
  mode: 'demo',
  consent: { capture: false, context: false, remoteAudio: false },
};
const start = { version: 6, action: 'start', options };
describe('strict session contract', () => {
  it('accepts the versioned allowlist and snapshots', () => {
    expect(parseSessionRequest(start)).toEqual(start);
    const dismiss = {
      version: 6,
      action: 'dismiss-suggestion',
      id: 'demo-1-2',
    };
    expect(parseSessionRequest(dismiss)).toEqual(dismiss);
    for (const action of ['read', 'pause', 'resume', 'stop'])
      expect(parseSessionRequest({ version: 6, action })).toEqual({
        version: 6,
        action,
      });
    const result = {
      version: 6,
      ok: true,
      demo: emptyDemo(),
      local: null,
      suggestions: {
        items: [],
        remainingRequests: 0,
        status: 'disabled',
        diagnostics: null,
      },
      session: { phase: 'running', ...options },
    };
    expect(parseSessionResult(result)).toEqual(result);
    expect(
      parseSessionResult({ version: 6, ok: false, code: 'TIMEOUT' }),
    ).toEqual({ version: 6, ok: false, code: 'TIMEOUT' });
  });
  it('validates Apple local source, locale and consent configuration', () => {
    const appleStart = {
      version: 6,
      action: 'start',
      options: {
        mode: 'apple-local',
        consent: { capture: true, context: false, remoteAudio: false },
        locale: 'pt-BR',
        sources: ['mic', 'system'],
      },
    };
    expect(parseSessionRequest(appleStart)).toEqual(appleStart);
    for (const invalid of [
      { ...appleStart.options, locale: 'pt-BR+en-US' },
      { ...appleStart.options, sources: [] },
      { ...appleStart.options, sources: ['mic', 'mic'] },
      { ...appleStart.options, sources: ['mic', 'system', 'other'] },
      {
        ...appleStart.options,
        consent: { ...appleStart.options.consent, remoteAudio: true },
      },
      { ...appleStart.options, unexpected: true },
    ])
      expect(
        parseSessionRequest({ ...appleStart, options: invalid }),
      ).toBeNull();
  });
  it.each([
    null,
    [],
    {},
    { ...start, version: 99 },
    { ...start, version: 1 },
    { version: 6, action: 'dismiss-suggestion' },
    { version: 6, action: 'dismiss-suggestion', id: '' },
    { version: 6, action: 'dismiss-suggestion', id: 'x'.repeat(81) },
    { version: 6, action: 'dismiss-suggestion', id: 1 },
    { version: 6, action: 'dismiss-suggestion', id: 'ok', extra: true },
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
    { version: 6, action: 'stop', extra: true },
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
      local: null,
      suggestions: {
        items: [],
        remainingRequests: 0,
        status: 'disabled',
        diagnostics: null,
      },
    },
    { version: 1, ok: false, code: 'TIMEOUT' },
    { version: 99, ok: true, session: { phase: 'idle', ...options } },
    { version: 6, ok: true, session: { phase: 'unknown', ...options } },
    {
      version: 6,
      ok: true,
      session: { phase: 'idle', ...options, secret: 'synthetic' },
    },
    {
      version: 6,
      ok: true,
      session: { phase: 'idle', ...options },
      extra: true,
    },
  ])('rejects malformed replies %#', (reply) => {
    expect(parseSessionResult(reply)).toEqual({
      version: 6,
      ok: false,
      code: 'INVALID_RESPONSE',
    });
  });
});

it('requires explicit model and request budget with context consent; rejects old IPC', () => {
  const options = {
    mode: 'apple-local',
    locale: 'pt-BR',
    sources: ['mic'],
    consent: { capture: true, context: true, remoteAudio: false },
    suggestions: { model: 'synthetic-model', maxRequests: 1 },
  };
  const request = { version: 6, action: 'start', options };
  expect(parseSessionRequest(request)).toEqual(request);
  expect(parseSessionRequest({ ...request, version: 3 })).toBeNull();
  expect(parseSessionRequest({ ...request, version: 4 })).toBeNull();
  expect(parseSessionRequest({ ...request, version: 5 })).toBeNull();
  expect(
    parseSessionResult({ version: 5, ok: false, code: 'TIMEOUT' }),
  ).toEqual({
    version: 6,
    ok: false,
    code: 'INVALID_RESPONSE',
  });
  for (const suggestions of [
    undefined,
    null,
    {},
    { model: '', maxRequests: 1 },
    { model: 'synthetic', maxRequests: 0 },
    { model: 'synthetic', maxRequests: 101 },
    { model: 'synthetic', maxRequests: 1.5 },
    { model: 'synthetic', maxRequests: 1, key: 'forbidden' },
  ]) {
    expect(
      parseSessionRequest({ ...request, options: { ...options, suggestions } }),
    ).toBeNull();
  }
  expect(
    parseSessionRequest({
      ...request,
      options: { ...options, consent: { ...options.consent, context: false } },
    }),
  ).toBeNull();
  expect(
    parseSessionRequest({ version: 6, action: 'revoke-suggestions' }),
  ).toEqual({ version: 6, action: 'revoke-suggestions' });
});
