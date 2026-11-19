import type { TranscriptionEvent } from '../../contracts/native/protocol';

export type Trigger =
  'question' | 'objection' | 'commitment' | 'manual' | 'none';

export type TriggerInput =
  TranscriptionEvent | { type: 'manual' } | { type: 'silence' };

// Deliberately bounded language cues: a question mark or a topic keyword alone
// does not establish relevance. These are heuristics, not semantic analysis.
const PT_TRIVIAL_QUESTION =
  /^(?:tudo (?:bem|certo|bom)|como (?:vai|voce esta|voces estao)|qual (?:e )?(?:o seu|seu) nome|que horas sao)\b/;
const PT_QUESTION_CUES = [
  /^(?:qual|quais|quanto|quanta|quantos|quantas|quem|onde|por que)\s+\S/,
  /^como (?:podemos|posso|vamos|devemos|resolver|fazer|evitar|garantir|funciona|voce|voces)\b/,
  /^quando (?:podemos|posso|vamos|devemos|sera|voce|voces|o|a)\b/,
  /^que (?:riscos|prazo|custo|impacto|alternativas|opcoes)\b/,
  /^(?:(?:voce|voces) )?(?:pode|podem|poderia|poderiam|consegue|conseguem) (?:me |nos )?(?:explicar|esclarecer|confirmar|detalhar|repetir|informar|avaliar|responder|dizer)\b/,
  /^(?:o que|voce|voces) (?:acha|acham|sugere|sugerem|recomenda|recomendam)\b/,
];
const PT_OBJECTION_CUES = [
  /^(?:mas )?(?:eu )?(?:nao concordo|discordo|nao podemos|nao conseguimos)\b/,
  /^(?:mas )?(?:isso|essa proposta|esse plano) (?:nao funciona|nao atende|e inviavel)\b/,
  /^(?:mas )?(?:ha|existe|temos) (?:um |o )?(?:risco|impedimento|bloqueio)\b/,
  /^(?:estamos bloqueados|falta (?:definir|confirmar|validar)|precisamos esclarecer)\b/,
];
const PT_COMMITMENT_CUES = [
  /^(?:(?:eu|nos) )?(?:vou|vamos|precisamos|devemos) (?:enviar|entregar|revisar|validar|confirmar|definir|preparar|implementar|investigar|agendar|resolver|documentar)\b/,
  /^(?:eu )?(?:me comprometo a|fico responsavel por)\s+\S/,
  /^(?:o prazo (?:e|sera)|a entrega (?:ficou|esta) (?:para|prevista para)|ficou (?:decidido|combinado) que)\s+\S/,
];

const EN_TRIVIAL_QUESTION =
  /^(?:how are (?:you|things)|what(?:'s| is) your name|what time is it)\b/;
const EN_QUESTION_CUES = [
  /^(?:what|which|how much|how many|who|where|why)\s+\S/,
  /^how (?:can|could|should|do|does|did|will|would|are|is)\b/,
  /^when (?:can|could|should|will|would|is|are|do|does)\b/,
  /^(?:can|could|would|will|do|does|did|should) (?:you|we|i|they|it)\b/,
];
const EN_OBJECTION_CUES = [
  /^(?:but )?(?:i |we )?(?:do not|don't) agree\b/,
  /^(?:but )?(?:we |i )?(?:cannot|can't)\b/,
  /^(?:but )?(?:this|that|the proposal|the plan) (?:does not|doesn't|will not|won't) (?:work|meet)\b/,
  /^(?:we are|we're) blocked\b/,
  /^(?:there is|there's|we have) (?:a |an |the )?(?:risk|blocker|impediment)\b/,
  /^(?:we need to clarify|we still need to (?:define|confirm|validate))\b/,
];
const EN_COMMITMENT_CUES = [
  /^(?:(?:i|we) )?(?:will|must|need to|have to|are going to) (?:send|deliver|review|validate|confirm|define|prepare|implement|investigate|schedule|resolve|document)\b/,
  /^(?:i am|i'm) (?:responsible for|committed to)\s+\S/,
  /^(?:the deadline (?:is|will be)|the delivery (?:is|was) (?:set |scheduled )?for|we (?:decided|agreed) that)\s+\S/,
];

type AutomaticCues = {
  trivialQuestion: RegExp;
  questions: RegExp[];
  objections: RegExp[];
  commitments: RegExp[];
};

const AUTOMATIC_CUES: Record<'pt-BR' | 'en-US', AutomaticCues> = {
  'pt-BR': {
    trivialQuestion: PT_TRIVIAL_QUESTION,
    questions: PT_QUESTION_CUES,
    objections: PT_OBJECTION_CUES,
    commitments: PT_COMMITMENT_CUES,
  },
  'en-US': {
    trivialQuestion: EN_TRIVIAL_QUESTION,
    questions: EN_QUESTION_CUES,
    objections: EN_OBJECTION_CUES,
    commitments: EN_COMMITMENT_CUES,
  },
};

/** Classifies one new, validated event; never rescans historical context.
 * No state, timers, IO, speaker inference or permission to call a provider.
 * Host owns session/consent/budget; T023 owns scheduling and deduplication.
 * Automatic classification covers the two single-language session locales;
 * manual requests work without speech.
 */
export class TriggerEngine {
  evaluate(input: TriggerInput): Trigger {
    if (input.type === 'manual') return 'manual';
    if (input.type !== 'final') return 'none';
    const cues = AUTOMATIC_CUES[input.locale];

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
          !cues.trivialQuestion.test(clause) &&
          cues.questions.some((cue) => cue.test(clause)),
      )
    )
      return 'question';
    if (
      clauses.some((clause) => cues.objections.some((cue) => cue.test(clause)))
    )
      return 'objection';
    if (
      clauses.some((clause) => cues.commitments.some((cue) => cue.test(clause)))
    )
      return 'commitment';
    return 'none';
  }
}
