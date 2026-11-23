import { fireEvent, render, screen } from '@testing-library/react';
import { expect, it, vi } from 'vitest';
import { emptySuggestionFeedback } from '../../../contracts/meeting/suggestionFeedback';
import { SuggestionFeedbackSummary } from './SuggestionFeedbackSummary';

it('shows only aggregate metrics and explicit export/cleanup actions', () => {
  const onExport = vi.fn();
  const onClear = vi.fn();
  const feedback = emptySuggestionFeedback();
  feedback.ratedCards = 2;
  feedback.counts.useful = 1;
  feedback.counts.incorrect = 1;
  feedback.ratings = [
    { suggestionId: 'private-1', value: 'useful' },
    { suggestionId: 'private-2', value: 'incorrect' },
  ];
  render(
    <SuggestionFeedbackSummary
      feedback={feedback}
      busy={false}
      onExport={onExport}
      onClear={onClear}
    />,
  );
  const region = screen.getByRole('region', {
    name: 'Métricas locais das sugestões',
  });
  expect(region).toHaveTextContent('2 cartão(ões)');
  expect(region).toHaveTextContent('1 útil');
  expect(region).not.toHaveTextContent('private-1');
  fireEvent.click(
    screen.getByRole('button', { name: 'Exportar métricas anônimas…' }),
  );
  fireEvent.click(
    screen.getByRole('button', { name: 'Limpar feedback local' }),
  );
  expect(onExport).toHaveBeenCalledOnce();
  expect(onClear).toHaveBeenCalledOnce();
});

it('stays hidden when no card was rated', () => {
  const { container } = render(
    <SuggestionFeedbackSummary
      feedback={emptySuggestionFeedback()}
      busy={false}
      onExport={vi.fn()}
      onClear={vi.fn()}
    />,
  );
  expect(container).toBeEmptyDOMElement();
});
