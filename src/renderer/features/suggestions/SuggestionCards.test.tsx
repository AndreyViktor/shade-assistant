import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { SuggestionCards } from './SuggestionCards';
import type { Suggestion } from '../../../contracts/meeting/suggestion';
const card: Suggestion = {
  id: 'demo-1',
  category: 'question',
  title: 'Verifique o prazo',
  body: 'Qual é o prazo?',
  groundedIn: 'inference',
  expiresAt: 30000,
};

describe('suggestion cards', () => {
  it.each([
    ['answer', 'Resposta'],
    ['question', 'Pergunta'],
    ['warning', 'Alerta'],
    ['action', 'Ação'],
  ] as const)('labels %s with readable text and DEMO', (category, label) => {
    render(
      <SuggestionCards
        suggestions={[{ ...card, category }]}
        busy={false}
        onDismiss={vi.fn()}
      />,
    );
    expect(screen.getByText(`${label} · DEMO`)).toBeVisible();
    expect(screen.getByRole('article', { name: card.title })).toHaveTextContent(
      card.body,
    );
    expect(screen.getByText('Hipótese / sugestão a confirmar')).toBeVisible();
  });
  it('dismisses the selected ID and disables actions while awaiting confirmation', () => {
    const onDismiss = vi.fn();
    const { rerender } = render(
      <SuggestionCards
        suggestions={[card]}
        busy={false}
        onDismiss={onDismiss}
      />,
    );
    const button = screen.getByRole('button', {
      name: `Descartar: ${card.title}`,
    });
    fireEvent.click(button);
    expect(onDismiss).toHaveBeenCalledExactlyOnceWith(card.id);
    rerender(
      <SuggestionCards
        suggestions={[card]}
        busy={true}
        onDismiss={onDismiss}
      />,
    );
    expect(button).toBeDisabled();
    fireEvent.click(button);
    expect(onDismiss).toHaveBeenCalledTimes(1);
    rerender(
      <SuggestionCards suggestions={[]} busy={false} onDismiss={onDismiss} />,
    );
    expect(screen.queryByRole('article')).not.toBeInTheDocument();
    expect(screen.getByRole('status')).toHaveTextContent('Nenhuma sugestão');
  });
  it('shows meeting grounding and renders content as text', () => {
    render(
      <SuggestionCards
        suggestions={[
          {
            ...card,
            groundedIn: 'meeting',
            body: '<img src=x onerror=alert(1)>',
          },
        ]}
        busy={false}
        onDismiss={vi.fn()}
      />,
    );
    expect(screen.getByText('Base: fala da reunião simulada')).toBeVisible();
    expect(screen.getByText('<img src=x onerror=alert(1)>')).toBeVisible();
    expect(screen.queryByRole('img')).not.toBeInTheDocument();
  });
});
