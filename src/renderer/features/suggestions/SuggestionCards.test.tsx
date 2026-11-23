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

it('explains retention and cleanup for real cards and dismisses by ID', () => {
  const onDismiss = vi.fn();
  render(
    <SuggestionCards
      suggestions={[{ ...card, expiresAt: null }]}
      demo={false}
      busy={false}
      onDismiss={onDismiss}
    />,
  );
  const region = screen.getByRole('region', { name: 'Sugestões da reunião' });
  expect(region).toHaveTextContent('Todos os cards da sessão');
  expect(region).toHaveTextContent('Os mais recentes aparecem primeiro');
  expect(
    screen.getByRole('list', {
      name: 'Lista rolável de cartões da reunião',
    }),
  ).toBeVisible();
  expect(region).toHaveTextContent(
    'pausar, parar ou desativar sugestões limpa os cards',
  );
  expect(region).not.toHaveTextContent('30 segundos');
  fireEvent.click(
    screen.getByRole('button', { name: `Descartar: ${card.title}` }),
  );
  expect(onDismiss).toHaveBeenCalledExactlyOnceWith(card.id);
});

it('shows real cards newest-first in one keyboard-focusable scroll list', () => {
  const older = { ...card, id: 'old', title: 'Mais antiga' };
  const newer = { ...card, id: 'new', title: 'Mais recente' };
  render(
    <SuggestionCards
      suggestions={[older, newer]}
      demo={false}
      busy={false}
      onDismiss={vi.fn()}
    />,
  );
  const list = screen.getByRole('list', {
    name: 'Lista rolável de cartões da reunião',
  });
  expect(list).toHaveAttribute('tabindex', '0');
  expect(
    [...list.querySelectorAll('article')].map((article) =>
      article.getAttribute('aria-label'),
    ),
  ).toEqual(['Mais recente', 'Mais antiga']);
});

it('offers four native keyboard buttons and exposes the selected rating', () => {
  const onRate = vi.fn();
  render(
    <SuggestionCards
      suggestions={[{ ...card, expiresAt: null }]}
      demo={false}
      busy={false}
      ratings={[{ suggestionId: card.id, value: 'useful' }]}
      onRate={onRate}
      onDismiss={vi.fn()}
    />,
  );
  expect(
    screen.getByRole('group', { name: 'Avaliar este cartão' }),
  ).toBeVisible();
  const useful = screen.getByRole('button', { name: `Útil: ${card.title}` });
  expect(useful).toHaveAttribute('aria-pressed', 'true');
  useful.focus();
  expect(useful).toHaveFocus();
  const repeated = screen.getByRole('button', {
    name: `Repetido: ${card.title}`,
  });
  expect(repeated).toHaveAttribute('aria-pressed', 'false');
  fireEvent.click(repeated);
  expect(onRate).toHaveBeenCalledExactlyOnceWith(card.id, 'repeated');
});
