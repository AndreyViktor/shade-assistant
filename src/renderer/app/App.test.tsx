import { render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { APP_STATUS, ipcFailure } from '../../contracts/ipc/appStatus';
import { App } from './App';

describe('App scaffold', () => {
  const getStatus = vi.fn();
  beforeEach(() => {
    getStatus.mockResolvedValue({ version: 1, ok: true, status: APP_STATUS });
    vi.stubGlobal('meetingCopilot', { getStatus });
  });
  afterEach(() => vi.unstubAllGlobals());

  it('identifies the demo and states that the meeting flow is not implemented', async () => {
    render(<App />);
    await screen.findByText('Inativa');
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

  it('shows inactive capture and does not offer a misleading start control', async () => {
    render(<App />);
    expect(await screen.findByText('Inativa')).toBeVisible();
    expect(screen.getByText('Desativada')).toBeVisible();
    expect(screen.getByText('Nenhum')).toBeVisible();
    expect(
      screen.queryByRole('button', { name: /iniciar/i }),
    ).not.toBeInTheDocument();
  });

  it('does not claim a verified status while waiting for main', () => {
    getStatus.mockReturnValue(new Promise(() => {}));
    render(<App />);
    expect(screen.getAllByText('Verificando…')).toHaveLength(3);
    expect(screen.queryByText('Inativa')).not.toBeInTheDocument();
  });

  it('shows a safe accessible error when the bridge fails', async () => {
    getStatus.mockResolvedValue(ipcFailure('TIMEOUT'));
    render(<App />);
    expect(await screen.findByRole('alert')).toHaveTextContent(
      'Não foi possível verificar',
    );
    expect(screen.getAllByText('Indisponível')).toHaveLength(3);
  });

  it('handles an absent bridge without exposing internal errors', async () => {
    vi.stubGlobal('meetingCopilot', undefined);
    render(<App />);
    expect(await screen.findByRole('alert')).toHaveTextContent('Reabra o app');
  });
});
