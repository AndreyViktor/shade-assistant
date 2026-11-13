import { defaultPreferences } from '../../contracts/settings/preferences';
import { emptyDemo } from '../../contracts/meeting/demo';
import { fireEvent, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { APP_STATUS, ipcFailure } from '../../contracts/ipc/appStatus';
import { App } from './App';

describe('App shell', () => {
  const getStatus = vi.fn();
  beforeEach(() => {
    getStatus.mockResolvedValue({ version: 1, ok: true, status: APP_STATUS });
    vi.stubGlobal('meetingCopilot', {
      getStatus,
      getSettings: vi.fn().mockResolvedValue({
        version: 1,
        ok: true,
        settings: {
          preferences: defaultPreferences('darwin'),
          credential: 'missing',
        },
      }),
      session: vi.fn().mockResolvedValue({
        version: 6,
        ok: true,
        demo: emptyDemo(),
        local: null,
        suggestions: {
          items: [],
          remainingRequests: 0,
          status: 'disabled',
          diagnostics: null,
        },
        session: {
          phase: 'idle',
          mode: 'demo',
          consent: { capture: false, context: false, remoteAudio: false },
        },
      }),
    });
  });
  afterEach(() => vi.unstubAllGlobals());

  it('keeps DEMO exclusively in preferences and restores keyboard focus', async () => {
    render(<App />);
    expect(
      screen.queryByRole('heading', { name: 'Meeting Copilot', level: 1 }),
    ).not.toBeInTheDocument();
    expect(
      await screen.findByRole('button', { name: 'Iniciar transcrição local' }),
    ).toBeVisible();
    expect(
      screen.getByRole('region', { name: 'Transcrição ao vivo' }),
    ).toBeVisible();
    expect(
      screen.getByRole('region', { name: 'Assistência da reunião' }),
    ).toBeVisible();
    expect(
      screen.getByText('Nenhuma fala exibida nesta sessão.'),
    ).toBeVisible();
    expect(
      screen.queryByText('Sobre o histórico de transcrição'),
    ).not.toBeInTheDocument();
    expect(
      screen.queryByText('Apple Local · histórico temporário'),
    ).not.toBeInTheDocument();
    expect(
      screen.queryByText('Diagnóstico · DEMO offline'),
    ).not.toBeInTheDocument();
    const preferences = screen.getByRole('button', { name: 'Preferências' });
    fireEvent.click(preferences);
    expect(screen.getByText('Sobre o histórico de transcrição')).toBeVisible();
    expect(
      screen.getByRole('button', { name: 'Voltar ao painel' }),
    ).toHaveFocus();
    fireEvent.click(screen.getByText('Diagnóstico · DEMO offline'));
    expect(screen.getByRole('button', { name: 'Iniciar DEMO' })).toBeVisible();
    expect(
      screen.queryByRole('button', { name: 'Iniciar transcrição local' }),
    ).not.toBeInTheDocument();
    expect(window.meetingCopilot.session).toHaveBeenCalledExactlyOnceWith({
      version: 6,
      action: 'read',
    });
    fireEvent.keyDown(screen.getByRole('button', { name: 'Iniciar DEMO' }), {
      key: 'Escape',
    });
    expect(preferences).toHaveFocus();
    expect(
      screen.queryByRole('button', { name: 'Iniciar DEMO' }),
    ).not.toBeInTheDocument();
    expect(screen.queryByText('Seu painel de reunião')).not.toBeInTheDocument();
  });

  it('keeps the shell responsive while status is pending', () => {
    getStatus.mockReturnValue(new Promise(() => {}));
    render(<App />);
    expect(
      screen.queryByRole('heading', { name: 'Meeting Copilot', level: 1 }),
    ).not.toBeInTheDocument();
    expect(
      screen.getByRole('button', { name: 'Iniciar transcrição local' }),
    ).toBeDisabled();
  });

  it('shows a safe accessible error when the bridge fails', async () => {
    getStatus.mockResolvedValue(ipcFailure('TIMEOUT'));
    render(<App />);
    expect(await screen.findByRole('alert')).toHaveTextContent(
      'Falha na transcrição. Consulte Preferências.',
    );
    fireEvent.click(screen.getByRole('button', { name: 'Preferências' }));
    expect(
      screen.getByRole('region', { name: 'Estado da transcrição' }),
    ).toHaveTextContent(
      'Não foi possível verificar o estado do app. Reabra-o.',
    );
  });

  it('handles an absent bridge without exposing internal errors', async () => {
    vi.stubGlobal('meetingCopilot', undefined);
    render(<App />);
    expect(await screen.findByRole('alert')).toHaveTextContent(
      'Falha na transcrição. Consulte Preferências.',
    );
  });
});
