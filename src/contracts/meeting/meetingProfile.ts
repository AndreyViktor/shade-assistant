export const MEETING_PROFILE_IDS = [
  'none',
  'discovery',
  'status',
  'interview',
  'negotiation',
  'technical-review',
  'video-fact-check',
] as const;

export type MeetingProfileId = (typeof MEETING_PROFILE_IDS)[number];
export type FocusedMeetingProfileId = Exclude<MeetingProfileId, 'none'>;

export type MeetingProfile = {
  id: FocusedMeetingProfileId;
  label: string;
  objective: string;
  priorities: readonly string[];
};

export const MEETING_PROFILES: readonly MeetingProfile[] = [
  {
    id: 'discovery',
    label: 'Descoberta',
    objective: 'Entender necessidades, contexto e critérios de sucesso.',
    priorities: [
      'lacunas relevantes a investigar',
      'problemas e resultados desejados',
      'restrições e critérios de decisão',
    ],
  },
  {
    id: 'status',
    label: 'Status',
    objective: 'Clarificar progresso, bloqueios e próximos passos.',
    priorities: [
      'mudanças desde a última atualização',
      'bloqueios e riscos',
      'responsáveis e próximos passos explicitamente sustentados',
    ],
  },
  {
    id: 'interview',
    label: 'Entrevista',
    objective: 'Aprofundar experiências e obter exemplos concretos.',
    priorities: [
      'perguntas abertas e não indutivas',
      'exemplos e evidências comportamentais',
      'lacunas ou contradições relevantes',
    ],
  },
  {
    id: 'negotiation',
    label: 'Negociação',
    objective: 'Tornar interesses, opções e condições de acordo explícitos.',
    priorities: [
      'interesses e limites declarados',
      'trocas e alternativas',
      'condições ainda não resolvidas',
    ],
  },
  {
    id: 'technical-review',
    label: 'Revisão técnica',
    objective: 'Examinar decisões técnicas, riscos e validação necessária.',
    priorities: [
      'premissas e trade-offs',
      'falhas, riscos e casos-limite',
      'evidências e verificações pendentes',
    ],
  },
  {
    id: 'video-fact-check',
    label: 'Verificação de vídeos',
    objective:
      'Identificar e corrigir afirmações factuais falsas em vídeos com fontes.',
    priorities: [
      'verificação de afirmações',
      'fontes consultadas',
      'silêncio diante de incerteza',
    ],
  },
];

export function parseMeetingProfileId(value: unknown): MeetingProfileId | null {
  return MEETING_PROFILE_IDS.find((id) => id === value) ?? null;
}

export function getMeetingProfile(id: MeetingProfileId): MeetingProfile | null {
  return id === 'none'
    ? null
    : (MEETING_PROFILES.find((profile) => profile.id === id) ?? null);
}
