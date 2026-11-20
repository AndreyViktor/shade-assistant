import { readFile } from 'node:fs/promises';
import { pathToFileURL } from 'node:url';

type JsonObject = Record<string, unknown>;

type CorpusTurn = {
  id: string;
  atMs: number;
  expectAbstain: boolean;
  context: {
    recent: Array<{
      source: 'mic' | 'system';
      locale: 'pt-BR' | 'en-US';
      startMs: number;
      endMs: number;
      text: string;
    }>;
    summary: unknown[];
  };
};

type CorpusCase = {
  id: string;
  tags: string[];
  actionableAtMs: number | null;
  turns: CorpusTurn[];
};

export type EvaluationCorpus = {
  schemaVersion: 1;
  id: string;
  synthetic: true;
  cases: CorpusCase[];
};

type CardLabels = {
  useful: boolean;
  relevant: boolean;
  novel: boolean;
  evidenceAdherent: boolean;
  semanticGroup: string;
  falseFactualAlert: boolean;
  reformulation: boolean;
};

type ResultTurn = {
  id: string;
  dispatchedAtMs: number;
  completedAtMs: number;
  inputTokens: number;
  outputTokens: number;
  cards: CardLabels[];
};

export type EvaluationResult = {
  schemaVersion: 1;
  corpusId: string;
  provenance: 'synthetic-control' | 'authorized-model';
  authorizationRecorded: boolean;
  configuration: { id: string; model: string };
  pricing: {
    currency: 'USD';
    inputPerMillion: number;
    outputPerMillion: number;
    asOf: string;
    source: string;
  };
  cases: Array<{ id: string; turns: ResultTurn[] }>;
};

export type EvaluationMetrics = {
  configuration: string;
  model: string;
  provenance: EvaluationResult['provenance'];
  cases: number;
  turns: number;
  cards: number;
  usefulCardRate: number | null;
  usefulCaseRate: number | null;
  noveltyRate: number | null;
  irrelevanceRate: number | null;
  semanticRepetitionRate: number | null;
  abstentionAccuracy: number | null;
  evidenceAdherenceRate: number | null;
  falseFactualAlertRate: number | null;
  reformulationRate: number | null;
  requestLatencyMs: { p50: number | null; p95: number | null };
  firstUsefulCardLatencyMs: {
    observedCases: number;
    eligibleCases: number;
    p50: number | null;
    p95: number | null;
  };
  tokens: { input: number; output: number };
  estimatedCost: { currency: 'USD'; amount: number; pricingAsOf: string };
};

function object(value: unknown, label: string): JsonObject {
  if (typeof value !== 'object' || value === null || Array.isArray(value))
    throw new Error(`${label} must be an object`);
  return value as JsonObject;
}

function exactKeys(value: JsonObject, keys: string[], label: string): void {
  const actual = Object.keys(value).sort();
  const expected = [...keys].sort();
  if (
    actual.length !== expected.length ||
    actual.some((key, i) => key !== expected[i])
  )
    throw new Error(`${label} has unexpected fields`);
}

function identifier(value: unknown, label: string): string {
  if (typeof value !== 'string' || !/^[a-z0-9][a-z0-9._-]{0,79}$/i.test(value))
    throw new Error(`${label} must be a safe identifier`);
  return value;
}

function text(value: unknown, label: string, max = 240): string {
  if (
    typeof value !== 'string' ||
    !value.trim() ||
    value.length > max ||
    /[\r\n]/.test(value)
  )
    throw new Error(`${label} must be bounded single-line text`);
  return value;
}

function boolean(value: unknown, label: string): boolean {
  if (typeof value !== 'boolean') throw new Error(`${label} must be boolean`);
  return value;
}

function nonNegativeInteger(value: unknown, label: string): number {
  if (!Number.isSafeInteger(value) || (value as number) < 0)
    throw new Error(`${label} must be a non-negative safe integer`);
  return value as number;
}

function nonNegativeNumber(value: unknown, label: string): number {
  if (typeof value !== 'number' || !Number.isFinite(value) || value < 0)
    throw new Error(`${label} must be a non-negative finite number`);
  return value;
}

function array(value: unknown, label: string): unknown[] {
  if (!Array.isArray(value)) throw new Error(`${label} must be an array`);
  return value;
}

function unique(values: string[], label: string): void {
  if (new Set(values).size !== values.length)
    throw new Error(`${label} must be unique`);
}

export function parseEvaluationCorpus(value: unknown): EvaluationCorpus {
  const root = object(value, 'corpus');
  exactKeys(root, ['schemaVersion', 'id', 'synthetic', 'cases'], 'corpus');
  if (root['schemaVersion'] !== 1 || root['synthetic'] !== true)
    throw new Error('corpus must be schema v1 and explicitly synthetic');
  const cases = array(root['cases'], 'corpus.cases').map((entry, caseIndex) => {
    const item = object(entry, `case ${caseIndex}`);
    exactKeys(
      item,
      ['id', 'tags', 'actionableAtMs', 'turns'],
      `case ${caseIndex}`,
    );
    const caseId = identifier(item['id'], `case ${caseIndex}.id`);
    const tags = array(item['tags'], `${caseId}.tags`).map((tag, tagIndex) =>
      identifier(tag, `${caseId}.tags[${tagIndex}]`),
    );
    unique(tags, `${caseId}.tags`);
    const actionableAtMs =
      item['actionableAtMs'] === null
        ? null
        : nonNegativeInteger(
            item['actionableAtMs'],
            `${caseId}.actionableAtMs`,
          );
    const turns = array(item['turns'], `${caseId}.turns`).map(
      (turn, turnIndex) => {
        const turnObject = object(turn, `${caseId}.turns[${turnIndex}]`);
        exactKeys(
          turnObject,
          ['id', 'atMs', 'expectAbstain', 'context'],
          `${caseId}.turns[${turnIndex}]`,
        );
        const id = identifier(
          turnObject['id'],
          `${caseId}.turns[${turnIndex}].id`,
        );
        const atMs = nonNegativeInteger(
          turnObject['atMs'],
          `${caseId}.${id}.atMs`,
        );
        const context = object(
          turnObject['context'],
          `${caseId}.${id}.context`,
        );
        exactKeys(context, ['recent', 'summary'], `${caseId}.${id}.context`);
        const recent = array(context['recent'], `${caseId}.${id}.recent`).map(
          (segment, segmentIndex) => {
            const segmentObject = object(
              segment,
              `${caseId}.${id}.recent[${segmentIndex}]`,
            );
            exactKeys(
              segmentObject,
              ['source', 'locale', 'startMs', 'endMs', 'text'],
              `${caseId}.${id}.recent[${segmentIndex}]`,
            );
            const source = segmentObject['source'];
            if (source !== 'mic' && source !== 'system')
              throw new Error(`${caseId}.${id} has invalid source`);
            const locale = segmentObject['locale'];
            if (locale !== 'pt-BR' && locale !== 'en-US')
              throw new Error(`${caseId}.${id} has invalid locale`);
            const startMs = nonNegativeInteger(
              segmentObject['startMs'],
              `${caseId}.${id}.startMs`,
            );
            const endMs = nonNegativeInteger(
              segmentObject['endMs'],
              `${caseId}.${id}.endMs`,
            );
            if (endMs < startMs)
              throw new Error(`${caseId}.${id} has reversed segment time`);
            return {
              source,
              locale,
              startMs,
              endMs,
              text: text(segmentObject['text'], `${caseId}.${id}.text`, 500),
            } satisfies CorpusTurn['context']['recent'][number];
          },
        );
        if (recent.length === 0)
          throw new Error(`${caseId}.${id} must contain context`);
        const summary = array(context['summary'], `${caseId}.${id}.summary`);
        if (summary.length !== 0)
          throw new Error('v1 evaluation corpus uses empty summaries only');
        return {
          id,
          atMs,
          expectAbstain: boolean(
            turnObject['expectAbstain'],
            `${caseId}.${id}.expectAbstain`,
          ),
          context: { recent, summary },
        } satisfies CorpusTurn;
      },
    );
    if (turns.length === 0) throw new Error(`${caseId} must contain turns`);
    unique(
      turns.map(({ id }) => id),
      `${caseId}.turn ids`,
    );
    for (let index = 1; index < turns.length; index++) {
      if ((turns[index]?.atMs ?? 0) < (turns[index - 1]?.atMs ?? 0))
        throw new Error(`${caseId} turns must be chronological`);
    }
    if (
      actionableAtMs !== null &&
      !turns.some(({ atMs }) => atMs >= actionableAtMs)
    )
      throw new Error(`${caseId} has no turn at or after actionableAtMs`);
    return { id: caseId, tags, actionableAtMs, turns } satisfies CorpusCase;
  });
  if (cases.length === 0) throw new Error('corpus must contain cases');
  unique(
    cases.map(({ id }) => id),
    'corpus case ids',
  );
  return {
    schemaVersion: 1,
    id: identifier(root['id'], 'corpus.id'),
    synthetic: true,
    cases,
  };
}

export function parseEvaluationResult(value: unknown): EvaluationResult {
  const root = object(value, 'result');
  exactKeys(
    root,
    [
      'schemaVersion',
      'corpusId',
      'provenance',
      'authorizationRecorded',
      'configuration',
      'pricing',
      'cases',
    ],
    'result',
  );
  if (root['schemaVersion'] !== 1) throw new Error('result must use schema v1');
  if (
    root['provenance'] !== 'synthetic-control' &&
    root['provenance'] !== 'authorized-model'
  )
    throw new Error('result has invalid provenance');
  const authorizationRecorded = boolean(
    root['authorizationRecorded'],
    'authorizationRecorded',
  );
  if ((root['provenance'] === 'authorized-model') !== authorizationRecorded)
    throw new Error(
      'authorized model results require a recorded authorization',
    );
  const configuration = object(root['configuration'], 'configuration');
  exactKeys(configuration, ['id', 'model'], 'configuration');
  const pricing = object(root['pricing'], 'pricing');
  exactKeys(
    pricing,
    ['currency', 'inputPerMillion', 'outputPerMillion', 'asOf', 'source'],
    'pricing',
  );
  if (pricing['currency'] !== 'USD')
    throw new Error('pricing currency must be USD');
  if (
    typeof pricing['asOf'] !== 'string' ||
    !/^\d{4}-\d{2}-\d{2}$/.test(pricing['asOf'])
  )
    throw new Error('pricing.asOf must be an ISO date');
  const cases = array(root['cases'], 'result.cases').map((entry, caseIndex) => {
    const item = object(entry, `result case ${caseIndex}`);
    exactKeys(item, ['id', 'turns'], `result case ${caseIndex}`);
    const caseId = identifier(item['id'], `result case ${caseIndex}.id`);
    const turns = array(item['turns'], `${caseId}.turns`).map(
      (turn, turnIndex) => {
        const turnObject = object(turn, `${caseId}.turns[${turnIndex}]`);
        exactKeys(
          turnObject,
          [
            'id',
            'dispatchedAtMs',
            'completedAtMs',
            'inputTokens',
            'outputTokens',
            'cards',
          ],
          `${caseId}.turns[${turnIndex}]`,
        );
        const id = identifier(turnObject['id'], `${caseId}.turn id`);
        const dispatchedAtMs = nonNegativeInteger(
          turnObject['dispatchedAtMs'],
          `${caseId}.${id}.dispatchedAtMs`,
        );
        const completedAtMs = nonNegativeInteger(
          turnObject['completedAtMs'],
          `${caseId}.${id}.completedAtMs`,
        );
        if (completedAtMs < dispatchedAtMs)
          throw new Error(`${caseId}.${id} completed before dispatch`);
        const cards = array(turnObject['cards'], `${caseId}.${id}.cards`).map(
          (card, cardIndex) => {
            const cardObject = object(
              card,
              `${caseId}.${id}.cards[${cardIndex}]`,
            );
            exactKeys(
              cardObject,
              [
                'useful',
                'relevant',
                'novel',
                'evidenceAdherent',
                'semanticGroup',
                'falseFactualAlert',
                'reformulation',
              ],
              `${caseId}.${id}.cards[${cardIndex}]`,
            );
            return {
              useful: boolean(cardObject['useful'], 'useful'),
              relevant: boolean(cardObject['relevant'], 'relevant'),
              novel: boolean(cardObject['novel'], 'novel'),
              evidenceAdherent: boolean(
                cardObject['evidenceAdherent'],
                'evidenceAdherent',
              ),
              semanticGroup: identifier(
                cardObject['semanticGroup'],
                'semanticGroup',
              ),
              falseFactualAlert: boolean(
                cardObject['falseFactualAlert'],
                'falseFactualAlert',
              ),
              reformulation: boolean(
                cardObject['reformulation'],
                'reformulation',
              ),
            } satisfies CardLabels;
          },
        );
        if (cards.length > 8)
          throw new Error(`${caseId}.${id} exceeds card limit`);
        return {
          id,
          dispatchedAtMs,
          completedAtMs,
          inputTokens: nonNegativeInteger(
            turnObject['inputTokens'],
            `${caseId}.${id}.inputTokens`,
          ),
          outputTokens: nonNegativeInteger(
            turnObject['outputTokens'],
            `${caseId}.${id}.outputTokens`,
          ),
          cards,
        } satisfies ResultTurn;
      },
    );
    unique(
      turns.map(({ id }) => id),
      `${caseId}.result turn ids`,
    );
    return { id: caseId, turns };
  });
  unique(
    cases.map(({ id }) => id),
    'result case ids',
  );
  return {
    schemaVersion: 1,
    corpusId: identifier(root['corpusId'], 'corpusId'),
    provenance: root['provenance'],
    authorizationRecorded,
    configuration: {
      id: identifier(configuration['id'], 'configuration.id'),
      model: identifier(configuration['model'], 'configuration.model'),
    },
    pricing: {
      currency: 'USD',
      inputPerMillion: nonNegativeNumber(
        pricing['inputPerMillion'],
        'inputPerMillion',
      ),
      outputPerMillion: nonNegativeNumber(
        pricing['outputPerMillion'],
        'outputPerMillion',
      ),
      asOf: pricing['asOf'],
      source: text(pricing['source'], 'pricing.source'),
    },
    cases,
  };
}

function percentile(values: number[], fraction: number): number | null {
  if (values.length === 0) return null;
  const sorted = [...values].sort((a, b) => a - b);
  return sorted[Math.ceil(sorted.length * fraction) - 1] ?? null;
}

function rate(numerator: number, denominator: number): number | null {
  return denominator === 0
    ? null
    : Number((numerator / denominator).toFixed(4));
}

function validateCoverage(
  corpus: EvaluationCorpus,
  result: EvaluationResult,
): void {
  if (result.corpusId !== corpus.id)
    throw new Error('result references a different corpus');
  const resultCases = new Map(result.cases.map((item) => [item.id, item]));
  if (resultCases.size !== corpus.cases.length)
    throw new Error('result does not cover every corpus case exactly once');
  for (const corpusCase of corpus.cases) {
    const resultCase = resultCases.get(corpusCase.id);
    if (!resultCase || resultCase.turns.length !== corpusCase.turns.length)
      throw new Error(`${corpusCase.id} result coverage differs from corpus`);
    const resultTurns = new Map(
      resultCase.turns.map((item) => [item.id, item]),
    );
    for (const corpusTurn of corpusCase.turns) {
      const resultTurn = resultTurns.get(corpusTurn.id);
      if (!resultTurn || resultTurn.dispatchedAtMs < corpusTurn.atMs)
        throw new Error(
          `${corpusCase.id}.${corpusTurn.id} is missing or dispatched before context`,
        );
    }
  }
}

export function evaluateResult(
  corpus: EvaluationCorpus,
  result: EvaluationResult,
): EvaluationMetrics {
  validateCoverage(corpus, result);
  const resultCases = new Map(result.cases.map((item) => [item.id, item]));
  const cards: CardLabels[] = [];
  const requestLatencies: number[] = [];
  const firstUsefulLatencies: number[] = [];
  let usefulCases = 0;
  let abstentionExpected = 0;
  let correctAbstentions = 0;
  let repeatedCards = 0;
  let inputTokens = 0;
  let outputTokens = 0;
  for (const corpusCase of corpus.cases) {
    const resultCase = resultCases.get(corpusCase.id);
    if (!resultCase) throw new Error('coverage changed after validation');
    const resultTurns = new Map(
      resultCase.turns.map((item) => [item.id, item]),
    );
    const semanticGroups = new Set<string>();
    let firstUsefulAt: number | null = null;
    for (const corpusTurn of corpusCase.turns) {
      const resultTurn = resultTurns.get(corpusTurn.id);
      if (!resultTurn) throw new Error('coverage changed after validation');
      requestLatencies.push(
        resultTurn.completedAtMs - resultTurn.dispatchedAtMs,
      );
      inputTokens += resultTurn.inputTokens;
      outputTokens += resultTurn.outputTokens;
      if (corpusTurn.expectAbstain) {
        abstentionExpected++;
        if (resultTurn.cards.length === 0) correctAbstentions++;
      }
      for (const card of resultTurn.cards) {
        cards.push(card);
        if (semanticGroups.has(card.semanticGroup)) repeatedCards++;
        semanticGroups.add(card.semanticGroup);
        if (
          card.useful &&
          corpusCase.actionableAtMs !== null &&
          resultTurn.completedAtMs >= corpusCase.actionableAtMs &&
          (firstUsefulAt === null || resultTurn.completedAtMs < firstUsefulAt)
        )
          firstUsefulAt = resultTurn.completedAtMs;
      }
    }
    if (corpusCase.actionableAtMs !== null && firstUsefulAt !== null) {
      usefulCases++;
      firstUsefulLatencies.push(firstUsefulAt - corpusCase.actionableAtMs);
    }
  }
  const eligibleCases = corpus.cases.filter(
    ({ actionableAtMs }) => actionableAtMs !== null,
  ).length;
  const amount =
    (inputTokens * result.pricing.inputPerMillion +
      outputTokens * result.pricing.outputPerMillion) /
    1_000_000;
  return {
    configuration: result.configuration.id,
    model: result.configuration.model,
    provenance: result.provenance,
    cases: corpus.cases.length,
    turns: result.cases.reduce((total, item) => total + item.turns.length, 0),
    cards: cards.length,
    usefulCardRate: rate(
      cards.filter(({ useful }) => useful).length,
      cards.length,
    ),
    usefulCaseRate: rate(usefulCases, eligibleCases),
    noveltyRate: rate(cards.filter(({ novel }) => novel).length, cards.length),
    irrelevanceRate: rate(
      cards.filter(({ relevant }) => !relevant).length,
      cards.length,
    ),
    semanticRepetitionRate: rate(repeatedCards, cards.length),
    abstentionAccuracy: rate(correctAbstentions, abstentionExpected),
    evidenceAdherenceRate: rate(
      cards.filter(({ evidenceAdherent }) => evidenceAdherent).length,
      cards.length,
    ),
    falseFactualAlertRate: rate(
      cards.filter(({ falseFactualAlert }) => falseFactualAlert).length,
      cards.length,
    ),
    reformulationRate: rate(
      cards.filter(({ reformulation }) => reformulation).length,
      cards.length,
    ),
    requestLatencyMs: {
      p50: percentile(requestLatencies, 0.5),
      p95: percentile(requestLatencies, 0.95),
    },
    firstUsefulCardLatencyMs: {
      observedCases: firstUsefulLatencies.length,
      eligibleCases,
      p50: percentile(firstUsefulLatencies, 0.5),
      p95: percentile(firstUsefulLatencies, 0.95),
    },
    tokens: { input: inputTokens, output: outputTokens },
    estimatedCost: {
      currency: 'USD',
      amount: Number(amount.toFixed(6)),
      pricingAsOf: result.pricing.asOf,
    },
  };
}

async function loadJson(path: string): Promise<unknown> {
  return JSON.parse(await readFile(path, 'utf8')) as unknown;
}

export async function evaluateFiles(
  corpusPath: string,
  resultPaths: string[],
): Promise<EvaluationMetrics[]> {
  if (resultPaths.length < 2)
    throw new Error('provide at least two result files for a comparison');
  const corpus = parseEvaluationCorpus(await loadJson(corpusPath));
  const results = await Promise.all(
    resultPaths.map(async (path) =>
      parseEvaluationResult(await loadJson(path)),
    ),
  );
  unique(
    results.map(({ configuration }) => configuration.id),
    'configuration ids',
  );
  return results.map((result) => evaluateResult(corpus, result));
}

async function main(): Promise<void> {
  const [corpusPath, ...resultPaths] = process.argv.slice(2);
  if (!corpusPath)
    throw new Error(
      'usage: npm run evaluate:suggestions -- CORPUS RESULT RESULT [...]',
    );
  process.stdout.write(
    `${JSON.stringify(await evaluateFiles(corpusPath, resultPaths), null, 2)}\n`,
  );
}

const invokedPath = process.argv[1];
if (invokedPath && import.meta.url === pathToFileURL(invokedPath).href) {
  main().catch((error: unknown) => {
    process.stderr.write(
      `${error instanceof Error ? error.message : 'evaluation failed'}\n`,
    );
    process.exitCode = 1;
  });
}
