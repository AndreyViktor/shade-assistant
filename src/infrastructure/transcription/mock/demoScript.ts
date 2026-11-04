import type { DemoTranscript } from '../../../contracts/meeting/demo';

type DemoTurn = { transcript: DemoTranscript; suggestion: string | null };

// Fixed source/STT/suggestion fixtures: no audio, inference or external services.
export const demoScript: readonly DemoTurn[] = [
  {
    transcript: {
      sequence: 1,
      source: 'mic',
      locale: 'pt-BR',
      text: 'Vamos revisar a migração do módulo de relatórios.',
    },
    suggestion: null,
  },
  {
    transcript: {
      sequence: 2,
      source: 'system',
      locale: 'pt-BR',
      text: 'Que riscos precisamos avaliar antes da migração?',
    },
    suggestion:
      'Pergunte quais dependências e testes de regressão precisam ser verificados antes de definir o plano.',
  },
  {
    transcript: {
      sequence: 3,
      source: 'mic',
      locale: 'pt-BR',
      text: 'Vou levantar as dependências e trazer uma proposta na próxima reunião.',
    },
    suggestion:
      'Confirme quem acompanhará o levantamento e combine uma data para revisar a proposta.',
  },
];
