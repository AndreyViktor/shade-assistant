// @vitest-environment node
import { readFile } from 'node:fs/promises';
import { describe, expect, it } from 'vitest';
import {
  evaluateFiles,
  evaluateResult,
  parseEvaluationCorpus,
  parseEvaluationResult,
} from '../../scripts/evaluate-suggestions.mts';

const fixture = (name: string) =>
  new URL(`../fixtures/suggestion-evaluation/${name}`, import.meta.url);

async function json(name: string): Promise<unknown> {
  return JSON.parse(await readFile(fixture(name), 'utf8')) as unknown;
}

describe('suggestion quality evaluation', () => {
  it('replays the sanitized authorized model comparison', async () => {
    const metrics = await evaluateFiles(
      fixture('authorized-corpus-v1.json').pathname,
      [
        fixture('authorized-gpt-5.4-mini.json').pathname,
        fixture('authorized-gpt-5.4.json').pathname,
      ],
    );

    expect(metrics).toEqual([
      expect.objectContaining({
        configuration: 'authorized-gpt-5.4-mini',
        provenance: 'authorized-model',
        cases: 4,
        turns: 5,
        cards: 3,
        usefulCardRate: 0.3333,
        noveltyRate: 0.6667,
        semanticRepetitionRate: 0.3333,
        abstentionAccuracy: 0.6667,
        evidenceAdherenceRate: 0.3333,
        requestLatencyMs: { p50: 1605, p95: 2438 },
        tokens: { input: 4878, output: 222 },
        estimatedCost: {
          currency: 'USD',
          amount: 0.004658,
          pricingAsOf: '2026-11-19',
        },
      }),
      expect.objectContaining({
        configuration: 'authorized-gpt-5.4',
        provenance: 'authorized-model',
        cases: 4,
        turns: 5,
        cards: 3,
        usefulCardRate: 0.3333,
        noveltyRate: 0.6667,
        semanticRepetitionRate: 0.3333,
        abstentionAccuracy: 0.6667,
        evidenceAdherenceRate: 1,
        requestLatencyMs: { p50: 2025, p95: 2087 },
        tokens: { input: 4878, output: 217 },
        estimatedCost: {
          currency: 'USD',
          amount: 0.01545,
          pricingAsOf: '2026-11-19',
        },
      }),
    ]);
  });

  it('compares complete synthetic controls with quality, latency, token and cost metrics', async () => {
    const metrics = await evaluateFiles(fixture('corpus-v1.json').pathname, [
      fixture('control-a.json').pathname,
      fixture('control-b.json').pathname,
    ]);

    expect(metrics).toEqual([
      {
        configuration: 'control-a',
        model: 'synthetic-control-a',
        provenance: 'synthetic-control',
        cases: 8,
        turns: 10,
        cards: 5,
        usefulCardRate: 1,
        usefulCaseRate: 1,
        noveltyRate: 1,
        irrelevanceRate: 0,
        semanticRepetitionRate: 0,
        abstentionAccuracy: 1,
        evidenceAdherenceRate: 1,
        falseFactualAlertRate: 0,
        reformulationRate: 0,
        requestLatencyMs: { p50: 500, p95: 800 },
        firstUsefulCardLatencyMs: {
          observedCases: 5,
          eligibleCases: 5,
          p50: 500,
          p95: 800,
        },
        tokens: { input: 1105, output: 179 },
        estimatedCost: {
          currency: 'USD',
          amount: 0.001463,
          pricingAsOf: '2026-11-19',
        },
      },
      {
        configuration: 'control-b',
        model: 'synthetic-control-b',
        provenance: 'synthetic-control',
        cases: 8,
        turns: 10,
        cards: 10,
        usefulCardRate: 0.2,
        usefulCaseRate: 0.4,
        noveltyRate: 0.2,
        irrelevanceRate: 0.4,
        semanticRepetitionRate: 0.1,
        abstentionAccuracy: 0,
        evidenceAdherenceRate: 0.6,
        falseFactualAlertRate: 0.4,
        reformulationRate: 0.3,
        requestLatencyMs: { p50: 900, p95: 1100 },
        firstUsefulCardLatencyMs: {
          observedCases: 2,
          eligibleCases: 5,
          p50: 950,
          p95: 1100,
        },
        tokens: { input: 1105, output: 277 },
        estimatedCost: {
          currency: 'USD',
          amount: 0.001659,
          pricingAsOf: '2026-11-19',
        },
      },
    ]);
  });

  it('requires identical case and turn coverage', async () => {
    const corpus = parseEvaluationCorpus(await json('corpus-v1.json'));
    const raw = (await json('control-a.json')) as {
      cases: Array<{ turns: unknown[] }>;
    };
    raw.cases[0]?.turns.pop();
    const result = parseEvaluationResult(raw);

    expect(() => evaluateResult(corpus, result)).toThrow(
      'initial-fragment result coverage differs from corpus',
    );
  });

  it('rejects result payload text and unrecorded real-model provenance', async () => {
    const withText = (await json('control-a.json')) as {
      cases: Array<{ turns: Array<Record<string, unknown>> }>;
    };
    if (withText.cases[0]?.turns[0])
      withText.cases[0].turns[0]['responseText'] = 'must not be stored';
    expect(() => parseEvaluationResult(withText)).toThrow(
      'initial-fragment.turns[0] has unexpected fields',
    );

    const unauthorized = (await json('control-a.json')) as Record<
      string,
      unknown
    >;
    unauthorized['provenance'] = 'authorized-model';
    expect(() => parseEvaluationResult(unauthorized)).toThrow(
      'authorized model results require a recorded authorization',
    );
  });

  it('rejects non-synthetic or malformed corpora', async () => {
    const raw = (await json('corpus-v1.json')) as Record<string, unknown>;
    raw['synthetic'] = false;
    expect(() => parseEvaluationCorpus(raw)).toThrow(
      'corpus must be schema v1 and explicitly synthetic',
    );
  });
});
