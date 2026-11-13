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
      screen.getByRole('heading', { name: 'Meeting Copilot', level: 1 }),
    ).toBeVisible();
    expect(
      await screen.findByRole('button', { name: 'Iniciar transcrição local' }),
    ).toBeVisible();
    expect(screen.getByText(/O áudio permanece neste Mac/)).toBeVisible();
    expect(
      screen.queryByText('Diagnóstico · DEMO offline'),
    ).not.toBeInTheDocument();
    const preferences = screen.getByRole('button', { name: 'Preferências' });
    fireEvent.click(preferences);
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
      screen.getByRole('heading', { name: 'Meeting Copilot', level: 1 }),
    ).toBeVisible();
    expect(
      screen.queryByRole('button', { name: 'Iniciar transcrição local' }),
    ).not.toBeInTheDocument();
  });

  it('shows a safe accessible error when the bridge fails', async () => {
    getStatus.mockResolvedValue(ipcFailure('TIMEOUT'));
    render(<App />);
    expect(await screen.findByRole('alert')).toHaveTextContent(
      'Não foi possível verificar',
    );
  });

  it('handles an absent bridge without exposing internal errors', async () => {
    vi.stubGlobal('meetingCopilot', undefined);
    render(<App />);
    expect(await screen.findByRole('alert')).toHaveTextContent(
      'Não foi possível verificar',
    );
  });
});
