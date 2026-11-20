// @vitest-environment node
import { chmod, mkdtemp, readFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { performance } from 'node:perf_hooks';
import { parseEnv } from 'node:util';
import { expect, it } from 'vitest';
import {
  parseEvaluationCorpus,
  type EvaluationCorpus,
} from '../../scripts/evaluate-suggestions.mts';
import { OpenAISuggestionProvider } from '../../src/infrastructure/ai/OpenAISuggestionProvider';
import { writePrivateFile } from '../../src/infrastructure/settings/privateFile';
import type { MeetingContext } from '../../src/core/meeting/ContextManager';
import type { SuggestionContent } from '../../src/contracts/meeting/suggestion';

type ModelId = 'gpt-5.4-mini' | 'gpt-5.4';
type Usage = { inputTokens: number; outputTokens: number };
type Pricing = { inputPerMillion: number; outputPerMillion: number };
type RawTurn = {
  caseId: string;
  turnId: string;
  dispatchedAtMs: number;
  completedAtMs: number;
  inputTokens: number;
  outputTokens: number;
  suggestions: SuggestionContent[];
};

const enabled = process.env['MEETING_COPILOT_AUTHORIZED_MODEL_EVAL'] === '1';
const MAX_COST_USD = 0.1;
const MAX_SUGGESTIONS_PER_MODEL = 10;
const MAX_OUTPUT_TOKENS = 128;
const PRICING_AS_OF = '2026-11-19';
const PRICING_SOURCE = 'https://developers.openai.com/api/docs/pricing';
const models: Array<{ id: ModelId; pricing: Pricing }> = [
  {
    id: 'gpt-5.4-mini',
    pricing: { inputPerMillion: 0.75, outputPerMillion: 4.5 },
  },
  {
    id: 'gpt-5.4',
    pricing: { inputPerMillion: 2.5, outputPerMillion: 15 },
  },
];

function usageFromPayload(value: unknown): Usage {
  if (
    typeof value !== 'object' ||
    value === null ||
    !('usage' in value) ||
    typeof value.usage !== 'object' ||
    value.usage === null ||
    !('input_tokens' in value.usage) ||
    !('output_tokens' in value.usage) ||
    !Number.isSafeInteger(value.usage.input_tokens) ||
    !Number.isSafeInteger(value.usage.output_tokens) ||
    (value.usage.input_tokens as number) < 0 ||
    (value.usage.output_tokens as number) < 0
  )
    throw new Error('Authorized response did not include bounded token usage');
  return {
    inputTokens: value.usage.input_tokens as number,
    outputTokens: value.usage.output_tokens as number,
  };
}

function cost(usage: Usage, pricing: Pricing): number {
  return (
    (usage.inputTokens * pricing.inputPerMillion +
      usage.outputTokens * pricing.outputPerMillion) /
    1_000_000
  );
}

function contextFor(
  corpusCase: EvaluationCorpus['cases'][number],
  turn: EvaluationCorpus['cases'][number]['turns'][number],
): MeetingContext {
  return {
    recent: turn.context.recent.map((segment, index) => ({
      version: 1,
      sessionId: `t027-${corpusCase.id}`,
      source: segment.source,
      locale: segment.locale,
      seq: index + 1,
      timestampMs: segment.endMs,
      type: 'final',
      segmentId: `segment-${index + 1}`,
      startMs: segment.startMs,
      endMs: segment.endMs,
      text: segment.text,
    })),
    summary: [],
  };
}

async function loadKey(): Promise<string> {
  const contents = await readFile(resolve('.env'), 'utf8');
  const key = parseEnv(contents).OPENAI_API_KEY;
  if (typeof key !== 'string' || key.length < 20 || /\s/.test(key))
    throw new Error('Authorized development credential is unavailable');
  return key;
}

function constrainToOneSuggestion(init: RequestInit | undefined): RequestInit {
  if (typeof init?.body !== 'string')
    throw new Error('Authorized request body is unavailable');
  const body = JSON.parse(init.body) as {
    max_output_tokens: number;
    text: {
      format: {
        schema: { properties: { suggestions: { maxItems: number } } };
      };
    };
  };
  body.max_output_tokens = MAX_OUTPUT_TOKENS;
  body.text.format.schema.properties.suggestions.maxItems = 1;
  return { ...init, body: JSON.stringify(body) };
}

it.skipIf(!enabled)(
  'compares the two authorized product models within the explicit card and cost caps',
  async () => {
    const corpus = parseEvaluationCorpus(
      JSON.parse(
        await readFile(
          resolve(
            'tests/fixtures/suggestion-evaluation/authorized-corpus-v1.json',
          ),
          'utf8',
        ),
      ) as unknown,
    );
    const key = await loadKey();
    const outputDirectory = await mkdtemp(
      join(tmpdir(), 'meeting-copilot-t027-'),
    );
    await chmod(outputDirectory, 0o700);
    const rawModels: Array<{
      model: ModelId;
      pricing: Pricing;
      turns: RawTurn[];
    }> = [];
    const miniInputTokens = new Map<string, number>();
    let accumulatedCost = 0;

    for (const model of models) {
      const turns: RawTurn[] = [];
      let suggestionCount = 0;
      for (const corpusCase of corpus.cases) {
        for (const turn of corpusCase.turns) {
          const turnKey = `${corpusCase.id}.${turn.id}`;
          const usageCapture: { promise?: Promise<Usage> } = {};
          const budgetedFetch: typeof fetch = async (input, init) => {
            const constrained = constrainToOneSuggestion(init);
            const bodyLength =
              typeof constrained.body === 'string'
                ? constrained.body.length
                : 0;
            const predictedInput =
              model.id === 'gpt-5.4-mini'
                ? Math.ceil(bodyLength / 2)
                : Math.ceil(
                    (miniInputTokens.get(turnKey) ?? bodyLength / 2) * 1.1,
                  ) + 16;
            const worstNext = cost(
              {
                inputTokens: predictedInput,
                outputTokens: MAX_OUTPUT_TOKENS,
              },
              model.pricing,
            );
            if (accumulatedCost + worstNext > MAX_COST_USD)
              throw new Error('Authorized cost cap would be exceeded');
            const response = await fetch(input, constrained);
            usageCapture.promise = response
              .clone()
              .json()
              .then((payload: unknown) => usageFromPayload(payload));
            return response;
          };
          const provider = new OpenAISuggestionProvider({
            model: model.id,
            getApiKey: () => Promise.resolve(key),
            isAuthorized: () => true,
            fetch: budgetedFetch,
            timeoutMs: 60_000,
            maxOutputTokens: MAX_OUTPUT_TOKENS,
          });
          const started = performance.now();
          const result = await provider.generate({
            context: contextFor(corpusCase, turn),
            language: 'pt-BR',
            signal: new AbortController().signal,
          });
          const elapsedMs = Math.max(
            1,
            Math.round(performance.now() - started),
          );
          if (!result.ok)
            throw new Error(
              `Authorized model evaluation failed: ${result.code}`,
            );
          if (!usageCapture.promise)
            throw new Error('Authorized request did not expose token usage');
          const usage = await usageCapture.promise;
          accumulatedCost += cost(usage, model.pricing);
          if (accumulatedCost > MAX_COST_USD)
            throw new Error('Authorized cost cap was exceeded');
          suggestionCount += result.suggestions.length;
          if (suggestionCount > MAX_SUGGESTIONS_PER_MODEL)
            throw new Error('Authorized suggestion cap was exceeded');
          if (model.id === 'gpt-5.4-mini')
            miniInputTokens.set(turnKey, usage.inputTokens);
          turns.push({
            caseId: corpusCase.id,
            turnId: turn.id,
            dispatchedAtMs: turn.atMs,
            completedAtMs: turn.atMs + elapsedMs,
            inputTokens: usage.inputTokens,
            outputTokens: usage.outputTokens,
            suggestions: result.suggestions,
          });
        }
      }
      expect(turns).toHaveLength(5);
      expect(suggestionCount).toBeLessThanOrEqual(MAX_SUGGESTIONS_PER_MODEL);
      rawModels.push({ model: model.id, pricing: model.pricing, turns });
    }

    const outputPath = join(outputDirectory, 'authorized-raw-output.json');
    await writePrivateFile(
      outputPath,
      `${JSON.stringify(
        {
          schemaVersion: 1,
          corpusId: corpus.id,
          authorization: {
            maxSuggestionsPerModel: MAX_SUGGESTIONS_PER_MODEL,
            maxCostUsd: MAX_COST_USD,
          },
          pricingAsOf: PRICING_AS_OF,
          pricingSource: PRICING_SOURCE,
          accumulatedCostUsd: Number(accumulatedCost.toFixed(6)),
          models: rawModels,
        },
        null,
        2,
      )}\n`,
    );
    process.stdout.write(
      `${JSON.stringify({
        authorizedEvaluation: true,
        outputPath,
        accumulatedCostUsd: Number(accumulatedCost.toFixed(6)),
        models: rawModels.map(({ model, turns }) => ({
          model,
          turns: turns.length,
          suggestions: turns.reduce(
            (total, item) => total + item.suggestions.length,
            0,
          ),
          inputTokens: turns.reduce(
            (total, item) => total + item.inputTokens,
            0,
          ),
          outputTokens: turns.reduce(
            (total, item) => total + item.outputTokens,
            0,
          ),
        })),
      })}\n`,
    );
  },
  300_000,
);
