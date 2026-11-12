import { fireEvent, render, screen } from '@testing-library/react';
import { expect, it } from 'vitest';
import { SuggestionDiagnosticsPanel } from './SuggestionDiagnosticsPanel';
import { emptySuggestionSession } from '../../../contracts/meeting/suggestionSession';
import type { SuggestionSessionSnapshot } from '../../../contracts/meeting/suggestionSession';
import type { SuggestionAttempt } from '../../../contracts/meeting/suggestionDiagnostics';

function snapshot(
  result: SuggestionAttempt['result'],
  httpStatus: number | null = 200,
): SuggestionSessionSnapshot {
  return {
    items: [],
    remainingRequests: 0,
    status: 'exhausted',
    diagnostics: {
      model: 'synthetic-model',
      maxRequests: 1,
      activity: result === 'pending' ? 'requesting' : 'waiting-trigger',
      lastTrigger: 'question',
      lastAttempt: {
        number: 1,
        startedAt: 1000,
        durationMs: result === 'pending' ? null : 500,
        requestBody: '{"input":"<script>synthetic</script>"}',
        httpStatus,
        result,
        suggestionCount: result === 'empty' ? 0 : 1,
      },
    },
  };
}
it('explains disabled suggestions without claiming a connection test', () => {
  render(<SuggestionDiagnosticsPanel snapshot={emptySuggestionSession()} />);
  expect(screen.getByRole('status')).toHaveTextContent('Sugestões desativadas');
  fireEvent.click(screen.getByText('Diagnóstico OpenAI'));
  expect(
    screen.getByText(/abrir aqui não testa a chave nem envia dados/),
  ).toBeVisible();
});
it.each([
  ['empty', 200, 'Resposta válida, sem sugestões'],
  ['authentication', 401, 'Autenticação ou acesso negado'],
  ['rate-limited', 429, 'Confira créditos, orçamento'],
  ['network', null, 'Não foi possível concluir a conexão'],
  ['cancelled', null, 'Chamada cancelada'],
] as const)(
  'explains %s distinctly and shows only the rendered body',
  (result, status, message) => {
    render(<SuggestionDiagnosticsPanel snapshot={snapshot(result, status)} />);
    expect(screen.getByText(new RegExp(message))).toBeVisible();
    fireEvent.click(screen.getByText('Diagnóstico OpenAI'));
    expect(
      screen.getByText(
        status ? `HTTP ${status} recebido` : 'Nenhuma resposta HTTP recebida',
      ),
    ).toBeVisible();
    fireEvent.click(screen.getByText('Ver corpo da última requisição'));
    expect(
      screen.getByLabelText('Corpo da requisição OpenAI'),
    ).toHaveTextContent('<script>synthetic</script>');
    expect(document.querySelector('script')).toBeNull();
  },
);
it('keeps the last allowed request in progress instead of prematurely claiming completion', () => {
  render(<SuggestionDiagnosticsPanel snapshot={snapshot('pending', null)} />);
  expect(screen.getByRole('status')).toHaveTextContent(
    'Requisição em andamento',
  );
  expect(screen.queryByText(/Limite atingido/)).not.toBeInTheDocument();
});
