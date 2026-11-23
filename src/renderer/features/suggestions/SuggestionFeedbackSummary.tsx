import type { SuggestionFeedbackSnapshot } from '../../../contracts/meeting/suggestionFeedback';

export function SuggestionFeedbackSummary({
  feedback,
  busy,
  onExport,
  onClear,
}: {
  feedback: SuggestionFeedbackSnapshot;
  busy: boolean;
  onExport: () => void;
  onClear: () => void;
}) {
  if (feedback.ratedCards === 0) return null;
  return (
    <section
      className="suggestion-feedback-summary"
      aria-label="Métricas locais das sugestões"
    >
      <h3>Feedback local</h3>
      <p role="status">
        {feedback.ratedCards} cartão(ões) avaliado(s): {feedback.counts.useful}{' '}
        útil(eis), {feedback.counts.irrelevant} irrelevante(s),{' '}
        {feedback.counts.incorrect} incorreto(s) e {feedback.counts.repeated}{' '}
        repetido(s).
      </p>
      <p>
        Estas contagens ficam somente na memória deste app. Nenhum feedback é
        enviado automaticamente. A exportação inclui apenas os totais, sem IDs,
        fala, contexto, modelo, título ou corpo dos cartões.
      </p>
      <div className="suggestion-feedback-summary-actions">
        <button type="button" disabled={busy} onClick={onExport}>
          Exportar métricas anônimas…
        </button>
        <button type="button" disabled={busy} onClick={onClear}>
          Limpar feedback local
        </button>
      </div>
      <p>
        Parar mantém este resumo para revisão. Limpar, iniciar outra sessão ou
        fechar o app remove os dados em memória.
      </p>
    </section>
  );
}
