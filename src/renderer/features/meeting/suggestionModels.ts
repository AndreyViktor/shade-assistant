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
