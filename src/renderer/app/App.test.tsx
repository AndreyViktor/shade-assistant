import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { App } from './App';

describe('App scaffold', () => {
  it('identifies the demo and states that the meeting flow is not implemented', () => {
    render(<App />);
    expect(
      screen.getByRole('heading', { name: 'Meeting Copilot', level: 1 }),
    ).toBeVisible();
    expect(screen.getByLabelText('Modo demonstração')).toHaveTextContent(
      'DEMO',
    );
    expect(
      screen.getByText(
        /a demonstração com transcrições e sugestões ainda não está disponível/i,
      ),
    ).toBeVisible();
  });

  it('shows inactive capture and does not offer a misleading start control', () => {
    render(<App />);
    expect(screen.getByText('Inativa')).toBeVisible();
    expect(screen.getByText('Desativada')).toBeVisible();
    expect(screen.getByText('Nenhum')).toBeVisible();
    expect(
      screen.queryByRole('button', { name: /iniciar/i }),
    ).not.toBeInTheDocument();
  });
});
