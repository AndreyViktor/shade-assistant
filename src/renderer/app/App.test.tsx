import { defaultPreferences } from '../../contracts/settings/preferences';
import { emptyDemo } from '../../contracts/meeting/demo';
import { fireEvent, render, screen, within } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { APP_STATUS, ipcFailure } from '../../contracts/ipc/appStatus';
import { App } from './App';
import { emptySuggestionFeedback } from '../../contracts/meeting/suggestionFeedback';

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
        version: 12,
        ok: true,
        demo: emptyDemo(),
        local: null,
        suggestions: {
          items: [],
          remainingRequests: 0,
          status: 'disabled',
          diagnostics: null,
          feedback: emptySuggestionFeedback(),
        },
        results: { items: [] },
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
    expect(screen.getByText('Nenhuma fala nesta sessão')).toBeVisible();
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
    fireEvent.click(
      await screen.findByRole('button', { name: /Áudio e transcrição/ }),
    );
    expect(
      screen.getByRole('group', { name: 'Transcrição de áudio' }),
    ).toContainElement(screen.getByLabelText('Fonte de áudio'));
    fireEvent.click(
      screen.getByRole('button', { name: 'Voltar às preferências' }),
    );
    fireEvent.click(screen.getByRole('button', { name: /Sugestões de IA/ }));
    const ai = screen.getByRole('group', { name: 'Sugestões de IA' });
    expect(within(ai).getByLabelText('Modelo para as sugestões')).toBeVisible();
    fireEvent.click(
      screen.getByRole('button', { name: 'Voltar às preferências' }),
    );
    fireEvent.click(screen.getByRole('button', { name: /Diagnóstico/ }));
    expect(
      screen.getByRole('region', { name: 'Estado da OpenAI' }),
    ).toBeVisible();
    expect(screen.getByText('Sobre o histórico de transcrição')).toBeVisible();
    expect(
      screen.getByRole('button', { name: 'Voltar às preferências' }),
    ).toBeVisible();
    fireEvent.click(screen.getByText('Diagnóstico · DEMO offline'));
    expect(screen.getByRole('button', { name: 'Iniciar DEMO' })).toBeVisible();
    expect(
      screen.queryByRole('button', { name: 'Iniciar transcrição local' }),
    ).not.toBeInTheDocument();
    expect(window.meetingCopilot.session).toHaveBeenCalledExactlyOnceWith({
      version: 12,
      action: 'read',
    });
    fireEvent.keyDown(screen.getByRole('button', { name: 'Iniciar DEMO' }), {
      key: 'Escape',
    });
    fireEvent.keyDown(document.body, { key: 'Escape' });
    expect(preferences).toHaveFocus();
    expect(
      screen.queryByRole('button', { name: 'Iniciar DEMO' }),
    ).not.toBeInTheDocument();
    expect(screen.queryByText('Seu painel de reunião')).not.toBeInTheDocument();
  });

  it('closes preferences with Escape after focus leaves the controls', async () => {
    render(<App />);
    const preferences = screen.getByRole('button', { name: 'Preferências' });
    fireEvent.click(preferences);
    const back = screen.getByRole('button', { name: 'Voltar ao painel' });
    await screen.findByRole('button', { name: /Áudio e transcrição/ });
    back.blur();
    expect(document.body).toHaveFocus();
    const handledEscape = new KeyboardEvent('keydown', {
      key: 'Escape',
      bubbles: true,
      cancelable: true,
    });
    handledEscape.preventDefault();
    fireEvent(document.body, handledEscape);
    expect(back).toBeVisible();
    fireEvent.keyDown(document.body, { key: 'Escape' });
    expect(preferences).toHaveFocus();
    expect(back).not.toBeVisible();
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

  it('switches presentation views without changing the session', async () => {
    const session = vi.fn().mockResolvedValue({
      version: 12,
      ok: true,
      demo: emptyDemo(),
      local: null,
      suggestions: {
        items: [],
        remainingRequests: 1,
        status: 'ready',
        diagnostics: null,
        feedback: emptySuggestionFeedback(),
      },
      results: { items: [] },
      session: {
        phase: 'running',
        mode: 'apple-local',
        consent: { capture: true, context: true, remoteAudio: false },
      },
    });
    vi.stubGlobal('meetingCopilot', {
      getStatus,
      getSettings: vi.fn().mockResolvedValue({
        version: 1,
        ok: true,
        settings: {
          preferences: defaultPreferences('darwin'),
          credential: 'stored',
        },
      }),
      session,
    });
    render(<App />);

    const modes = await screen.findByRole('group', {
      name: 'Visualização do overlay',
    });
    const complete = within(modes).getByRole('button', {
      name: 'Visualização completa',
    });
    expect(complete).toHaveAttribute('aria-pressed', 'true');
    expect(within(modes).getAllByRole('button')).toHaveLength(3);
    expect(
      screen.getByRole('region', { name: 'Transcrição ao vivo' }),
    ).toBeVisible();
    expect(
      screen.getByRole('region', { name: 'Assistência da reunião' }),
    ).toBeVisible();
    expect(
      screen.getByRole('region', {
        name: 'Resultados estruturados da reunião',
      }),
    ).toBeVisible();

    const transcript = within(modes).getByRole('button', {
      name: 'Só transcrição',
    });
    transcript.focus();
    fireEvent.click(transcript);
    expect(transcript).toHaveFocus();
    expect(transcript).toHaveAttribute('aria-pressed', 'true');
    expect(
      screen.getByRole('region', { name: 'Transcrição ao vivo' }),
    ).toBeVisible();
    expect(
      screen.queryByRole('region', { name: 'Assistência da reunião' }),
    ).not.toBeInTheDocument();

    const assistance = within(modes).getByRole('button', {
      name: 'Só assistência',
    });
    fireEvent.click(assistance);
    expect(assistance).toHaveAttribute('aria-pressed', 'true');
    expect(
      screen.queryByRole('region', { name: 'Transcrição ao vivo' }),
    ).not.toBeInTheDocument();
    expect(
      screen.getByRole('region', { name: 'Assistência da reunião' }),
    ).toBeVisible();
    expect(
      screen.getByRole('region', {
        name: 'Resultados estruturados da reunião',
      }),
    ).toBeVisible();
    expect(screen.getByRole('button', { name: 'Preferências' })).toBeVisible();
    expect(screen.getByRole('button', { name: 'Pausar' })).toBeVisible();
    expect(screen.getByRole('button', { name: 'Parar' })).toBeVisible();
    expect(session).toHaveBeenCalledExactlyOnceWith({
      version: 12,
      action: 'read',
    });
  });

  it('shows a safe accessible error when the bridge fails', async () => {
    getStatus.mockResolvedValue(ipcFailure('TIMEOUT'));
    render(<App />);
    expect(await screen.findByRole('alert')).toHaveTextContent(
      'Falha na transcrição. Consulte Preferências.',
    );
    fireEvent.click(screen.getByRole('button', { name: 'Preferências' }));
    fireEvent.click(await screen.findByRole('button', { name: /Diagnóstico/ }));
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
