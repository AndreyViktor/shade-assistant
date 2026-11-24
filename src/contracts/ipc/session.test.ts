import { emptyDemo } from '../meeting/demo';
import { describe, expect, it } from 'vitest';
import { parseSessionRequest, parseSessionResult } from './session';
import { emptySuggestionFeedback } from '../meeting/suggestionFeedback';
const options = {
  mode: 'demo',
  consent: { capture: false, context: false, remoteAudio: false },
};
const start = { version: 12, action: 'start', options };
describe('strict session contract', () => {
  it('accepts the versioned allowlist and snapshots', () => {
    expect(parseSessionRequest(start)).toEqual(start);
    const dismiss = {
      version: 12,
      action: 'dismiss-suggestion',
      id: 'demo-1-2',
    };
    expect(parseSessionRequest(dismiss)).toEqual(dismiss);
    const rating = {
      version: 12,
      action: 'rate-suggestion',
      id: 'suggestion-1',
      feedback: 'useful',
    };
    expect(parseSessionRequest(rating)).toEqual(rating);
    for (const action of [
      'read',
      'pause',
      'resume',
      'stop',
      'clear-suggestion-feedback',
      'export-suggestion-feedback',
    ])
      expect(parseSessionRequest({ version: 12, action })).toEqual({
        version: 12,
        action,
      });
    const result = {
      version: 12,
      ok: true,
      demo: emptyDemo(),
      local: null,
      suggestions: {
        items: [],
        remainingRequests: 0,
        status: 'disabled',
        diagnostics: null,
        feedback: emptySuggestionFeedback(),
      },
      results: { items: [] },
      session: { phase: 'running', ...options },
    };
    expect(parseSessionResult(result)).toEqual(result);
    expect(
      parseSessionResult({ version: 12, ok: false, code: 'TIMEOUT' }),
    ).toEqual({ version: 12, ok: false, code: 'TIMEOUT' });
  });
  it('validates Apple local source, locale and consent configuration', () => {
    const appleStart = {
      version: 12,
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
    { ...start, version: 7 },
    { version: 12, action: 'dismiss-suggestion' },
    { version: 12, action: 'dismiss-suggestion', id: '' },
    { version: 12, action: 'dismiss-suggestion', id: 'x'.repeat(81) },
    { version: 12, action: 'dismiss-suggestion', id: 1 },
    { version: 12, action: 'dismiss-suggestion', id: 'ok', extra: true },
    { version: 12, action: 'rate-suggestion', id: 'ok' },
    {
      version: 12,
      action: 'rate-suggestion',
      id: 'ok',
      feedback: 'private-comment',
    },
    {
      version: 12,
      action: 'rate-suggestion',
      id: 'ok',
      feedback: 'useful',
      text: 'forbidden',
    },
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
    { version: 12, action: 'stop', extra: true },
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
        feedback: emptySuggestionFeedback(),
      },
    },
    { version: 1, ok: false, code: 'TIMEOUT' },
    { version: 99, ok: true, session: { phase: 'idle', ...options } },
    { version: 12, ok: true, session: { phase: 'unknown', ...options } },
    {
      version: 12,
      ok: true,
      session: { phase: 'idle', ...options, secret: 'synthetic' },
    },
    {
      version: 12,
      ok: true,
      session: { phase: 'idle', ...options },
      extra: true,
    },
  ])('rejects malformed replies %#', (reply) => {
    expect(parseSessionResult(reply)).toEqual({
      version: 12,
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
  const request = { version: 12, action: 'start', options };
  expect(parseSessionRequest(request)).toEqual(request);
  expect(parseSessionRequest({ ...request, version: 3 })).toBeNull();
  expect(parseSessionRequest({ ...request, version: 4 })).toBeNull();
  expect(parseSessionRequest({ ...request, version: 5 })).toBeNull();
  expect(parseSessionRequest({ ...request, version: 6 })).toBeNull();
  expect(parseSessionRequest({ ...request, version: 7 })).toBeNull();
  expect(parseSessionRequest({ ...request, version: 9 })).toBeNull();
  expect(
    parseSessionResult({ version: 5, ok: false, code: 'TIMEOUT' }),
  ).toEqual({
    version: 12,
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
    { model: 'synthetic', maxRequests: 1, meetingProfile: 'none' },
    { model: 'synthetic', maxRequests: 1, meetingProfile: 'custom' },
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
    parseSessionRequest({ version: 12, action: 'revoke-suggestions' }),
  ).toEqual({ version: 12, action: 'revoke-suggestions' });
});

it.each([
  'discovery',
  'status',
  'interview',
  'negotiation',
  'technical-review',
] as const)(
  'accepts the built-in profile %s only with context consent',
  (profile) => {
    const request = {
      version: 12,
      action: 'start',
      options: {
        mode: 'apple-local',
        locale: 'pt-BR',
        sources: ['mic'],
        consent: { capture: true, context: true, remoteAudio: false },
        suggestions: {
          model: 'synthetic-model',
          maxRequests: 1,
          meetingProfile: profile,
        },
      },
    };
    expect(parseSessionRequest(request)).toEqual(request);
    expect(
      parseSessionRequest({
        ...request,
        options: {
          ...request.options,
          consent: { ...request.options.consent, context: false },
        },
      }),
    ).toBeNull();
  },
);

it('requires separate web consent and system audio for video checking', () => {
  const options = {
    mode: 'apple-local',
    locale: 'pt-BR',
    sources: ['system'],
    consent: { capture: true, context: true, remoteAudio: false },
    suggestions: {
      model: 'synthetic',
      maxRequests: 2,
      meetingProfile: 'video-fact-check',
      webSearchConsent: true,
    },
  };
  const request = { version: 12, action: 'start', options };
  expect(parseSessionRequest(request)).toEqual(request);
  expect(
    parseSessionRequest({
      ...request,
      options: { ...options, sources: ['mic'] },
    }),
  ).toBeNull();
  expect(
    parseSessionRequest({
      ...request,
      options: {
        ...options,
        suggestions: { ...options.suggestions, webSearchConsent: false },
      },
    }),
  ).toBeNull();
  expect(
    parseSessionRequest({
      ...request,
      options: {
        ...options,
        suggestions: {
          model: 'synthetic',
          maxRequests: 2,
          meetingProfile: 'video-fact-check',
        },
      },
    }),
  ).toBeNull();
  expect(
    parseSessionRequest({
      ...request,
      options: {
        ...options,
        suggestions: { ...options.suggestions, meetingProfile: 'status' },
      },
    }),
  ).toBeNull();
  expect(parseSessionRequest({ version: 11, action: 'read' })).toBeNull();
});

it('validates optional context at the session boundary and requires consent', () => {
  const options = {
    mode: 'apple-local',
    locale: 'pt-BR',
    sources: ['mic'],
    consent: { capture: true, context: true, remoteAudio: false },
    suggestions: { model: 'synthetic-model', maxRequests: 1 },
  };
  const start = (userContext: unknown, context = true) => ({
    version: 12,
    action: 'start',
    options: {
      ...options,
      consent: { ...options.consent, context },
      suggestions: { ...options.suggestions, userContext },
    },
  });
  for (const userContext of [
    'a'.repeat(2000),
    'á'.repeat(2000),
    '😀'.repeat(1000),
    'tema\nobjetivo',
  ]) {
    expect(parseSessionRequest(start(userContext))).toEqual(start(userContext));
  }
  for (const userContext of [
    null,
    undefined,
    1,
    {},
    [],
    'a'.repeat(2001),
    '😀'.repeat(1001),
    ' '.repeat(2001),
  ]) {
    expect(parseSessionRequest(start(userContext))).toBeNull();
  }
  for (const userContext of ['', ' \n ', 'tema']) {
    expect(parseSessionRequest(start(userContext, false))).toBeNull();
  }
  expect(parseSessionRequest(start(' \n '))).toEqual({
    version: 12,
    action: 'start',
    options,
  });
  expect(parseSessionRequest(start(' tema '))).toMatchObject({
    options: { suggestions: { userContext: 'tema' } },
  });
  expect(parseSessionRequest({ ...start('tema'), version: 6 })).toBeNull();
  expect(
    parseSessionResult({ version: 6, ok: false, code: 'TIMEOUT' }),
  ).toEqual({ version: 12, ok: false, code: 'INVALID_RESPONSE' });
  for (const mode of ['demo', 'openai-stt']) {
    expect(
      parseSessionRequest({
        ...start('tema'),
        options: { ...start('tema').options, mode },
      }),
    ).toBeNull();
  }
});
