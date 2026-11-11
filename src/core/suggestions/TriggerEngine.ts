import type { TranscriptionEvent } from '../../contracts/native/protocol';

export type Trigger =
  'question' | 'objection' | 'commitment' | 'manual' | 'none';

export type TriggerInput =
  TranscriptionEvent | { type: 'manual' } | { type: 'silence' };

// Deliberately bounded pt-BR cues: a question mark or a topic keyword alone
// does not establish relevance. These are heuristics, not semantic analysis.
const TRIVIAL_QUESTION =
  /^(?:tudo (?:bem|certo|bom)|como (?:vai|voce esta|voces estao)|qual (?:e )?(?:o seu|seu) nome|que horas sao)\b/;
const QUESTION_CUES = [
  /^(?:qual|quais|quanto|quanta|quantos|quantas|quem|onde|por que)\s+\S/,
  /^como (?:podemos|posso|vamos|devemos|resolver|fazer|evitar|garantir|funciona|voce|voces)\b/,
  /^quando (?:podemos|posso|vamos|devemos|sera|voce|voces|o|a)\b/,
  /^que (?:riscos|prazo|custo|impacto|alternativas|opcoes)\b/,
  /^(?:(?:voce|voces) )?(?:pode|podem|poderia|poderiam|consegue|conseguem) (?:me |nos )?(?:explicar|esclarecer|confirmar|detalhar|repetir|informar|avaliar|responder|dizer)\b/,
  /^(?:o que|voce|voces) (?:acha|acham|sugere|sugerem|recomenda|recomendam)\b/,
];
const OBJECTION_CUES = [
  /^(?:mas )?(?:eu )?(?:nao concordo|discordo|nao podemos|nao conseguimos)\b/,
  /^(?:mas )?(?:isso|essa proposta|esse plano) (?:nao funciona|nao atende|e inviavel)\b/,
  /^(?:mas )?(?:ha|existe|temos) (?:um |o )?(?:risco|impedimento|bloqueio)\b/,
  /^(?:estamos bloqueados|falta (?:definir|confirmar|validar)|precisamos esclarecer)\b/,
];
const COMMITMENT_CUES = [
  /^(?:(?:eu|nos) )?(?:vou|vamos|precisamos|devemos) (?:enviar|entregar|revisar|validar|confirmar|definir|preparar|implementar|investigar|agendar|resolver|documentar)\b/,
  /^(?:eu )?(?:me comprometo a|fico responsavel por)\s+\S/,
  /^(?:o prazo (?:e|sera)|a entrega (?:ficou|esta) (?:para|prevista para)|ficou (?:decidido|combinado) que)\s+\S/,
];

/** Classifies one new, validated event; never rescans historical context.
 * No state, timers, IO, speaker inference or permission to call a provider.
 * Host owns session/consent/budget; T023 owns scheduling and deduplication.
 * Automatic classification is pt-BR only; manual requests work without speech.
 */
export class TriggerEngine {
  evaluate(input: TriggerInput): Trigger {
    if (input.type === 'manual') return 'manual';
    if (input.type !== 'final' || input.locale !== 'pt-BR') return 'none';

    const clauses = input.text
      .normalize('NFD')
      .replace(/\p{M}/gu, '')
      .toLowerCase()
      .split(/[.!?;\n]+/)
      .map((clause) => clause.trim().replace(/\s+/g, ' '))
      .filter(Boolean);

    // One decision per event: explicit request > objection > commitment.
    // Ignore small talk per clause so a greeting cannot hide a useful question.
    if (
      clauses.some(
        (clause) =>
          !TRIVIAL_QUESTION.test(clause) &&
          QUESTION_CUES.some((cue) => cue.test(clause)),
      )
    )
      return 'question';
    if (
      clauses.some((clause) => OBJECTION_CUES.some((cue) => cue.test(clause)))
    )
      return 'objection';
    if (
      clauses.some((clause) => COMMITMENT_CUES.some((cue) => cue.test(clause)))
    )
      return 'commitment';
    return 'none';
  }
}
