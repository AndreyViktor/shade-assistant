import type {
  Suggestion,
  SuggestionCategory,
} from '../../../contracts/meeting/suggestion';

const labels: Record<SuggestionCategory, string> = {
  answer: 'Resposta',
  question: 'Pergunta',
  warning: 'Alerta',
  action: 'Ação',
};

export function SuggestionCards({
  suggestions,
  busy,
  onDismiss,
  demo = true,
}: {
  suggestions: readonly Suggestion[];
  busy: boolean;
  demo?: boolean;
  onDismiss: (id: string) => void;
}) {
  return (
    <section
      aria-label={demo ? 'Sugestões DEMO' : 'Sugestões da reunião'}
      className="suggestion-cards"
    >
      <h3>{demo ? 'Sugestões simuladas · DEMO' : 'Sugestões · OpenAI'}</h3>
      <p>
        {demo
          ? 'Até dois cartões. Expiram após 30 segundos, inclusive durante a pausa.'
          : 'Até dois cartões, sem expiração por tempo. Novos substituem os mais antigos. Descarte quando quiser; pausar, parar ou desativar sugestões limpa os cartões.'}
      </p>
      {suggestions.length === 0 && (
        <p role="status">Nenhuma sugestão neste momento.</p>
      )}
      {suggestions.map((card) => (
        <article
          key={card.id}
          className="suggestion-card"
          aria-label={card.title}
        >
          <p className="suggestion-category">
            {labels[card.category]}
            {demo ? ' · DEMO' : ''}
          </p>
          <h4>{card.title}</h4>
          <p>{card.body}</p>
          <p className="suggestion-grounding">
            {card.groundedIn === 'meeting'
              ? demo
                ? 'Base: fala da reunião simulada'
                : 'Base: fala da reunião'
              : 'Hipótese / sugestão a confirmar'}
          </p>
          <button
            disabled={busy}
            aria-label={`Descartar: ${card.title}`}
            onClick={() => onDismiss(card.id)}
          >
            Descartar
          </button>
        </article>
      ))}
    </section>
  );
}
