/** Curated UI choices, checked against official model pages on 2026-11-12.
 * Both support Responses + Structured Outputs; this is not an account-access check.
 * Sources and maintenance notes: docs/TEST-T024.md (model selection).
 */
export const SUGGESTION_MODELS = [
  {
    id: 'gpt-5.4-mini',
    label: 'GPT-5.4 mini — menor custo',
    description:
      'Opção inicial para sugestões curtas. Tem custo menor que o GPT-5.4.',
  },
  {
    id: 'gpt-5.4',
    label: 'GPT-5.4 — tarefas complexas',
    description:
      'Modelo para tarefas mais complexas. Custa mais que o mini e pode levar mais tempo para responder.',
  },
] as const;

export const DEFAULT_SUGGESTION_MODEL = 'gpt-5.4-mini';

// Providers are listed by capability; availability here means implemented,
// not a successful hardware, permission or account-access check.
export const TRANSCRIPTION_PROVIDERS = [
  {
    id: 'apple-local',
    label: 'Apple Local — áudio neste Mac',
    available: true,
  },
  {
    id: 'openai-stt',
    label: 'OpenAI STT — indisponível (adiado)',
    available: false,
  },
  {
    id: 'mock',
    label: 'DEMO — preferência legada, sem captura real',
    available: false,
  },
] as const;
export const SUGGESTION_PROVIDERS = [
  { id: 'openai', label: 'OpenAI — sugestões de texto', available: true },
] as const;
export type SuggestionModel = (typeof SUGGESTION_MODELS)[number]['id'];
