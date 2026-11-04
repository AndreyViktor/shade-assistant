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
}: {
  suggestions: readonly Suggestion[];
  busy: boolean;
  onDismiss: (id: string) => void;
}) {
  return (
    <section aria-label="Sugestões DEMO" className="suggestion-cards">
      <h3>Sugestões simuladas · DEMO</h3>
      <p>
        Até dois cartões. Expiram após 30 segundos, inclusive durante a pausa.
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
          <p className="suggestion-category">{labels[card.category]} · DEMO</p>
          <h4>{card.title}</h4>
          <p>{card.body}</p>
          <p className="suggestion-grounding">
            {card.groundedIn === 'meeting'
              ? 'Base: fala da reunião simulada'
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
