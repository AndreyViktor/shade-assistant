import type {
  Suggestion,
  SuggestionCategory,
} from '../../../contracts/meeting/suggestion';
import { SUGGESTION_FEEDBACK_VALUES } from '../../../contracts/meeting/suggestionFeedback';
import type {
  SuggestionFeedbackValue,
  SuggestionRating,
} from '../../../contracts/meeting/suggestionFeedback';

const labels: Record<SuggestionCategory, string> = {
  answer: 'Resposta',
  question: 'Pergunta',
  warning: 'Alerta',
  action: 'Ação',
};
const feedbackLabels: Record<SuggestionFeedbackValue, string> = {
  useful: 'Útil',
  irrelevant: 'Irrelevante',
  incorrect: 'Incorreto',
  repeated: 'Repetido',
};

export function SuggestionCards({
  suggestions,
  busy,
  onDismiss,
  ratings = [],
  onRate,
  demo = true,
}: {
  suggestions: readonly Suggestion[];
  busy: boolean;
  demo?: boolean;
  onDismiss: (id: string) => void;
  ratings?: readonly SuggestionRating[];
  onRate?: (id: string, feedback: SuggestionFeedbackValue) => void;
}) {
  const displayedSuggestions = demo ? suggestions : [...suggestions].reverse();
  return (
    <section
      aria-label={demo ? 'Sugestões DEMO' : 'Sugestões da reunião'}
      className="suggestion-cards"
    >
      <h3>{demo ? 'Sugestões simuladas · DEMO' : 'Sugestões · OpenAI'}</h3>
      <p>
        {demo
          ? 'Cards roteirizados da demonstração. Expiram após 30 segundos, inclusive durante a pausa.'
          : 'Todos os cards da sessão ficam disponíveis até descarte ou limpeza. Os mais recentes aparecem primeiro.'}
      </p>
      {suggestions.length === 0 && (
        <p role="status">Nenhuma sugestão neste momento.</p>
      )}
      {displayedSuggestions.length > 0 && (
        <ul
          className="suggestion-card-list"
          aria-label={
            demo
              ? 'Lista rolável de cartões DEMO'
              : 'Lista rolável de cartões da reunião'
          }
          tabIndex={0}
        >
          {displayedSuggestions.map((card) => (
            <li key={card.id}>
              <article className="suggestion-card" aria-label={card.title}>
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
                {!demo && onRate && (
                  <fieldset className="suggestion-feedback">
                    <legend>Avaliar este cartão</legend>
                    <div className="suggestion-feedback-actions">
                      {SUGGESTION_FEEDBACK_VALUES.map((feedback) => {
                        const selected = ratings.some(
                          (rating) =>
                            rating.suggestionId === card.id &&
                            rating.value === feedback,
                        );
                        return (
                          <button
                            key={feedback}
                            type="button"
                            aria-pressed={selected}
                            aria-label={`${feedbackLabels[feedback]}: ${card.title}`}
                            disabled={busy}
                            onClick={() => onRate(card.id, feedback)}
                          >
                            {feedbackLabels[feedback]}
                          </button>
                        );
                      })}
                    </div>
                  </fieldset>
                )}
                <button
                  disabled={busy}
                  aria-label={`Descartar: ${card.title}`}
                  onClick={() => onDismiss(card.id)}
                >
                  Descartar
                </button>
              </article>
            </li>
          ))}
        </ul>
      )}
      {!demo && (
        <details className="card-retention">
          <summary>Quando os cartões são removidos?</summary>
          <p>
            Os mais recentes aparecem primeiro. Role a lista para acessar todos
            os cards desta sessão. Redimensionar não remove cartões. Descarte
            quando quiser; pausar, parar ou desativar sugestões limpa os cards.
          </p>
        </details>
      )}
    </section>
  );
}
