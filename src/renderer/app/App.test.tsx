import { emptyDemo } from '../../contracts/meeting/demo';
import { render, screen } from '@testing-library/react';
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
          preferences: {
            mode: 'real',
            sttProvider: 'apple-local',
            language: 'pt-BR',
          },
          credential: 'missing',
        },
      }),
      session: vi.fn().mockResolvedValue({
        version: 2,
        ok: true,
        demo: emptyDemo(),
        session: {
          phase: 'idle',
          mode: 'demo',
          consent: { capture: false, context: false, remoteAudio: false },
        },
      }),
    });
  });
  afterEach(() => vi.unstubAllGlobals());

  it('opens on the local transcription action with DEMO secondary', async () => {
    render(<App />);
    expect(
      screen.getByRole('heading', { name: 'Meeting Copilot', level: 1 }),
    ).toBeVisible();
    expect(
      await screen.findByRole('button', { name: 'Iniciar transcrição local' }),
    ).toBeVisible();
    expect(screen.getByText(/O áudio permanece neste Mac/)).toBeVisible();
    expect(screen.getByText('Testar a demonstração')).toBeInTheDocument();
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
