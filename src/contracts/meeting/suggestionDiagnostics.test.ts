import { describe, expect, it } from 'vitest';
import { SUGGESTION_BATCH_LIMIT } from './suggestion';
import { parseSuggestionDiagnostics } from './suggestionDiagnostics';
import { parseSuggestionSession } from './suggestionSession';

const attempt = {
  number: 1,
  startedAt: 100,
  durationMs: 5,
  requestBody: '{}',
  httpStatus: 401,
  result: 'authentication',
  suggestionCount: null,
};
const diagnostic = {
  model: 'synthetic-model',
  maxRequests: 1,
  activity: 'waiting-trigger',
  lastTrigger: 'question',
  lastAttempt: attempt,
};
describe('bounded diagnostic IPC', () => {
  it('copies allowlisted metadata and rejects unknown properties at every level', () => {
    expect(parseSuggestionDiagnostics(diagnostic)).toEqual(diagnostic);
    expect(
      parseSuggestionDiagnostics({ ...diagnostic, key: 'secret' }),
    ).toBeNull();
    expect(
      parseSuggestionDiagnostics({
        ...diagnostic,
        lastAttempt: { ...attempt, headers: { Authorization: 'secret' } },
      }),
    ).toBeNull();
    expect(
      parseSuggestionSession({
        items: [],
        remainingRequests: 0,
        status: 'unavailable',
        diagnostics: diagnostic,
      })?.diagnostics,
    ).toEqual(diagnostic);
  });
  it.each([
    { requestBody: 'x'.repeat(32769) },
    { requestBody: {} },
    { httpStatus: 0 },
    { httpStatus: 600 },
    { durationMs: -1 },
    { startedAt: Infinity },
    { number: 2 },
    { suggestionCount: SUGGESTION_BATCH_LIMIT + 1 },
    { result: 'raw-private-error' },
  ])('rejects malformed attempt %#', (invalid) => {
    expect(
      parseSuggestionDiagnostics({
        ...diagnostic,
        lastAttempt: { ...attempt, ...invalid },
      }),
    ).toBeNull();
  });
  it('accepts diagnostics for the full batch limit', () => {
    expect(
      parseSuggestionDiagnostics({
        ...diagnostic,
        lastAttempt: {
          ...attempt,
          result: 'success',
          suggestionCount: SUGGESTION_BATCH_LIMIT,
        },
      })?.lastAttempt?.suggestionCount,
    ).toBe(SUGGESTION_BATCH_LIMIT);
  });
  it('requires active diagnostics and prevents retention after disabled/revoked state', () => {
    expect(
      parseSuggestionSession({
        items: [],
        remainingRequests: 0,
        status: 'disabled',
        diagnostics: diagnostic,
      }),
    ).toBeNull();
    expect(
      parseSuggestionSession({
        items: [],
        remainingRequests: 1,
        status: 'ready',
        diagnostics: null,
      }),
    ).toBeNull();
    expect(
      parseSuggestionSession({
        items: [],
        remainingRequests: 0,
        status: 'disabled',
      }),
    ).toBeNull();
    expect(
      parseSuggestionDiagnostics({ ...diagnostic, activity: 'connected' }),
    ).toBeNull();
    expect(
      parseSuggestionDiagnostics({
        ...diagnostic,
        lastTrigger: 'private-transcript',
      }),
    ).toBeNull();
  });
});
