import type {
  MeetingResultItem,
  MeetingResultKind,
  MeetingResultsSnapshot,
} from '../../../contracts/meeting/meetingResult';

const headings: Record<MeetingResultKind, string> = {
  topic: 'Tópico atual',
  decision: 'Decisões confirmadas',
  action: 'Ações',
  question: 'Perguntas abertas',
  risk: 'Riscos',
};

const sourceLabels = { mic: 'Microfone', system: 'Sistema' } as const;

export function StructuredMeetingResults({
  snapshot,
}: {
  snapshot: MeetingResultsSnapshot;
}) {
  return (
    <section
      className="meeting-results"
      aria-label="Resultados estruturados da reunião"
    >
      <h3>Resultados ao vivo</h3>
      {snapshot.items.length === 0 ? (
        <p>
          Ainda não há fatos ou inferências com evidência suficiente nesta
          sessão.
        </p>
      ) : (
        <div className="meeting-result-groups">
          {(['topic', 'decision', 'action', 'question', 'risk'] as const).map(
            (kind) => {
              const items = snapshot.items.filter((item) => item.kind === kind);
              return items.length > 0 ? (
                <section key={kind} aria-label={headings[kind]}>
                  <h4>{headings[kind]}</h4>
                  <ul>
                    {items.map((item) => (
                      <ResultItem key={item.key} item={item} />
                    ))}
                  </ul>
                </section>
              ) : null;
            },
          )}
        </div>
      )}
      <details className="result-policy">
        <summary>Como estes resultados mudam?</summary>
        <p>
          Cada item cita falas finais da sessão. Fatos foram ditos na reunião;
          inferências precisam de confirmação. Novas falas podem corrigir ou
          remover um item. Pausar preserva a lista; parar ou desativar a OpenAI
          limpa tudo. Nada é salvo por padrão.
        </p>
      </details>
    </section>
  );
}

function ResultItem({ item }: { item: MeetingResultItem }) {
  return (
    <li>
      <article className="meeting-result-item" aria-label={item.text}>
        <p>{item.text}</p>
        <p className={`result-grounding result-grounding-${item.groundedIn}`}>
          {item.groundedIn === 'meeting'
            ? 'Fato da reunião'
            : 'Inferência a confirmar'}
        </p>
        <details>
          <summary>
            {item.evidence.length === 1
              ? '1 fala de suporte'
              : `${item.evidence.length} falas de suporte`}
          </summary>
          <ul className="result-evidence">
            {item.evidence.map((evidence) => (
              <li key={`${evidence.source}:${evidence.segmentId}`}>
                <p>
                  {sourceLabels[evidence.source]} ·{' '}
                  <time>{formatTime(evidence.startMs)}</time>–
                  <time>{formatTime(evidence.endMs)}</time>
                </p>
                <blockquote>
                  {evidence.text}
                  {evidence.truncated ? '…' : ''}
                </blockquote>
              </li>
            ))}
          </ul>
        </details>
      </article>
    </li>
  );
}

function formatTime(milliseconds: number): string {
  const totalSeconds = Math.floor(milliseconds / 1000);
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  return `${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`;
}
