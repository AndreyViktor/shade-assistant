import { hasExactKeys } from '../validation';
import {
  SUGGESTION_BATCH_LIMIT,
  SUGGESTION_SESSION_REQUEST_LIMIT,
} from './suggestion';

export const SUGGESTION_AUTOMATIC_DEBOUNCE_MS = 2_000;

export const SUGGESTION_FAILURES = [
  'not-authorized',
  'credentials-unavailable',
  'invalid-request',
  'cancelled',
  'timeout',
  'network',
  'authentication',
  'rate-limited',
  'unavailable',
  'rejected',
  'refused',
  'incomplete',
  'invalid-response',
] as const;
export type SuggestionFailure = (typeof SUGGESTION_FAILURES)[number];
const RESULTS = [
  'pending',
  'success',
  'empty',
  ...SUGGESTION_FAILURES,
] as const;
const ACTIVITIES = [
  'waiting-final',
  'waiting-trigger',
  'debounce',
  'cooldown',
  'preparing',
  'requesting',
  'paused',
] as const;
const TRIGGERS = [
  'none',
  'question',
  'objection',
  'commitment',
  'manual',
] as const;

export type SuggestionAttempt = {
  number: number;
  startedAt: number;
  durationMs: number | null;
  /** Exact JSON body passed to fetch, never headers or raw response/error bodies. */
  requestBody: string | null;
  httpStatus: number | null;
  result: (typeof RESULTS)[number];
  suggestionCount: number | null;
};
export type SuggestionDiagnostics = {
  model: string;
  maxRequests: number;
  activity: (typeof ACTIVITIES)[number];
  lastTrigger: (typeof TRIGGERS)[number];
  lastAttempt: SuggestionAttempt | null;
};

function integer(
  value: unknown,
  min: number,
  max = Number.MAX_SAFE_INTEGER,
): value is number {
  return (
    typeof value === 'number' &&
    Number.isSafeInteger(value) &&
    value >= min &&
    value <= max
  );
}
function member<T extends string>(
  values: readonly T[],
  value: unknown,
): value is T {
  return typeof value === 'string' && values.some((item) => item === value);
}
export function parseSuggestionDiagnostics(
  value: unknown,
): SuggestionDiagnostics | null {
  if (
    !hasExactKeys(value, [
      'model',
      'maxRequests',
      'activity',
      'lastTrigger',
      'lastAttempt',
    ]) ||
    typeof value.model !== 'string' ||
    !/^[a-zA-Z0-9][a-zA-Z0-9._:-]{0,199}$/.test(value.model) ||
    !integer(value.maxRequests, 1, SUGGESTION_SESSION_REQUEST_LIMIT) ||
    !member(ACTIVITIES, value.activity) ||
    !member(TRIGGERS, value.lastTrigger)
  )
    return null;
  let lastAttempt: SuggestionAttempt | null = null;
  const attempt = value.lastAttempt;
  if (attempt !== null) {
    if (
      !hasExactKeys(attempt, [
        'number',
        'startedAt',
        'durationMs',
        'requestBody',
        'httpStatus',
        'result',
        'suggestionCount',
      ]) ||
      !integer(attempt.number, 1, value.maxRequests) ||
      !integer(attempt.startedAt, 0) ||
      (attempt.durationMs !== null && !integer(attempt.durationMs, 0)) ||
      (attempt.requestBody !== null &&
        (typeof attempt.requestBody !== 'string' ||
          attempt.requestBody.length > 32768)) ||
      (attempt.httpStatus !== null && !integer(attempt.httpStatus, 100, 599)) ||
      !member(RESULTS, attempt.result) ||
      (attempt.suggestionCount !== null &&
        !integer(attempt.suggestionCount, 0, SUGGESTION_BATCH_LIMIT))
    )
      return null;
    lastAttempt = {
      number: attempt.number,
      startedAt: attempt.startedAt,
      durationMs: attempt.durationMs,
      requestBody: attempt.requestBody,
      httpStatus: attempt.httpStatus,
      result: attempt.result,
      suggestionCount: attempt.suggestionCount,
    };
  }
  return {
    model: value.model,
    maxRequests: value.maxRequests,
    activity: value.activity,
    lastTrigger: value.lastTrigger,
    lastAttempt,
  };
}
