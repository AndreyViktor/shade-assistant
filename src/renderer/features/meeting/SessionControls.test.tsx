import { emptyDemo } from '../../../contracts/meeting/demo';
import {
  act,
  fireEvent,
  render,
  screen,
  waitFor,
} from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { SessionControls } from './SessionControls';
const consent = { capture: false, context: false, remoteAudio: false };
const reply = (phase: string) => ({
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
  session: { mode: 'demo', phase, consent },
});
afterEach(() => {
  vi.unstubAllGlobals();
  vi.useRealTimers();
});
describe('session controls', () => {
  it.each(['paused', 'running'])(
    'refreshes expiration in %s after playback completion and then stops polling',
    async (phase) => {
      vi.useFakeTimers();
      const card = {
        id: 'demo-1-2',
        category: 'question',
        title: 'Contexto',
        body: 'Sugestão sintética.',
        groundedIn: 'inference',
        expiresAt: 30000,
      };
      const session = vi.fn().mockResolvedValue({
        ...reply(phase),
        demo: { ...emptyDemo(), completed: true, suggestions: [card] },
      });
      vi.stubGlobal('meetingCopilot', { session });
      render(<SessionControls />);
      await act(async () => {
        await Promise.resolve();
      });
      expect(screen.getByRole('article')).toBeVisible();
      session.mockResolvedValue({
        ...reply(phase),
        demo: { ...emptyDemo(), completed: true },
      });
      await act(async () => {
        await vi.advanceTimersByTimeAsync(500);
      });
      expect(screen.queryByRole('article')).not.toBeInTheDocument();
      const calls = session.mock.calls.length;
      await act(async () => {
        await vi.advanceTimersByTimeAsync(10000);
      });
      expect(session).toHaveBeenCalledTimes(calls);
    },
  );

  it('discards a stale read after dismissal and does not restore the card', async () => {
    vi.useFakeTimers();
    const card = {
      id: 'demo-1-2',
      category: 'question',
      title: 'Contexto',
      body: 'Sugestão sintética.',
      groundedIn: 'inference',
      expiresAt: 30000,
    };
    const withCard = {
      ...reply('paused'),
      demo: { ...emptyDemo(), suggestions: [card] },
    };
    const session = vi.fn().mockResolvedValue(withCard);
    vi.stubGlobal('meetingCopilot', { session });
    render(<SessionControls />);
    await act(async () => {
      await Promise.resolve();
    });
    let finish: (value: unknown) => void = () => {};
    session.mockReturnValueOnce(
      new Promise((resolve) => {
        finish = resolve;
      }),
    );
    await act(async () => {
      await vi.advanceTimersByTimeAsync(500);
    });
    session.mockResolvedValue(reply('paused'));
    await act(async () => {
      fireEvent.click(
        screen.getByRole('button', { name: 'Descartar: Contexto' }),
      );
      await Promise.resolve();
    });
    expect(session).toHaveBeenLastCalledWith({
      version: 6,
      action: 'dismiss-suggestion',
      id: card.id,
    });
    await act(async () => {
      finish(withCard);
      await Promise.resolve();
    });
    expect(screen.queryByRole('article')).not.toBeInTheDocument();
  });

  it('polls simulated content, labels its source and stops polling after unmount', async () => {
    vi.useFakeTimers();
    const session = vi.fn().mockResolvedValue(reply('running'));
    vi.stubGlobal('meetingCopilot', { session });
    const view = render(<SessionControls />);
    await act(async () => {
      await Promise.resolve();
    });
    expect(screen.getByText('Aguardando fala simulada…')).toBeVisible();
    session.mockResolvedValue({
      ...reply('running'),
      demo: {
        transcript: {
          sequence: 2,
          source: 'system',
          locale: 'pt-BR',
          text: 'Pergunta sintética?',
        },
        suggestions: [
          {
            id: 'demo-1-2',
            category: 'question',
            title: 'Contexto',
            body: 'Sugestão sintética.',
            groundedIn: 'inference',
            expiresAt: 30000,
          },
        ],
        completed: false,
      },
    });
    await act(async () => {
      await vi.advanceTimersByTimeAsync(500);
    });
    expect(screen.getByText('Pergunta sintética?')).toBeVisible();
    expect(screen.getByText('Sugestão sintética.')).toBeVisible();
    expect(screen.getByText(/Fonte simulada: sistema · pt-BR/)).toBeVisible();
    const calls = session.mock.calls.length;
    view.unmount();
    await act(async () => {
      await vi.advanceTimersByTimeAsync(10000);
    });
    expect(session).toHaveBeenCalledTimes(calls);
  });

  it('discards a polled transcript that arrives after stop', async () => {
    vi.useFakeTimers();
    const session = vi.fn().mockResolvedValue(reply('running'));
    vi.stubGlobal('meetingCopilot', { session });
    render(<SessionControls />);
    await act(async () => {
      await Promise.resolve();
    });
    let finish: (value: unknown) => void = () => {};
    session.mockReturnValueOnce(
      new Promise((resolve) => {
        finish = resolve;
      }),
    );
    await act(async () => {
      await vi.advanceTimersByTimeAsync(500);
    });
    session.mockResolvedValue(reply('stopped'));
    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: 'Parar' }));
      await Promise.resolve();
    });
    await act(async () => {
      finish({
        ...reply('running'),
        demo: {
          transcript: {
            sequence: 1,
            source: 'mic',
            locale: 'pt-BR',
            text: 'Late content',
          },
          suggestions: [],
          completed: false,
        },
      });
      await Promise.resolve();
    });
    expect(screen.getByText('Encerrada')).toBeVisible();
    expect(screen.queryByText('Late content')).not.toBeInTheDocument();
    expect(
      screen.queryByRole('region', { name: 'Roteiro DEMO' }),
    ).not.toBeInTheDocument();
  });

  it('stops polling on completion and safely reports a polling failure', async () => {
    vi.useFakeTimers();
    const session = vi.fn().mockResolvedValue(reply('running'));
    vi.stubGlobal('meetingCopilot', { session });
    render(<SessionControls />);
    await act(async () => {
      await Promise.resolve();
    });
    session.mockResolvedValue({
      ...reply('running'),
      demo: { ...emptyDemo(), completed: true },
    });
    await act(async () => {
      await vi.advanceTimersByTimeAsync(500);
    });
    expect(screen.getByText(/Roteiro concluído/)).toBeVisible();
    const calls = session.mock.calls.length;
    await act(async () => {
      await vi.advanceTimersByTimeAsync(10000);
    });
    expect(session).toHaveBeenCalledTimes(calls);
    session.mockResolvedValue(reply('paused'));
    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: 'Pausar' }));
      await Promise.resolve();
    });
    session.mockResolvedValue(reply('running'));
    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: 'Retomar' }));
      await Promise.resolve();
    });
    session.mockRejectedValue(new Error('private payload'));
    await act(async () => {
      await vi.advanceTimersByTimeAsync(500);
    });
    expect(screen.getByRole('alert')).toHaveTextContent(
      'Não foi possível atualizar',
    );
    expect(screen.queryByText('private payload')).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Parar' })).toBeEnabled();
    expect(
      screen.queryByRole('region', { name: 'Roteiro DEMO' }),
    ).not.toBeInTheDocument();
  });
  it('keeps DEMO secondary and waits for its explicit start action', async () => {
    const session = vi.fn().mockResolvedValue(reply('idle'));
    vi.stubGlobal('meetingCopilot', { session });
    render(<SessionControls />);
    await screen.findByText('Pronta para iniciar');
    expect(session).toHaveBeenCalledExactlyOnceWith({
      version: 6,
      action: 'read',
    });
    expect(
      screen.queryByRole('button', { name: 'Pausar' }),
    ).not.toBeInTheDocument();
    session.mockResolvedValue(reply('running'));
    fireEvent.click(screen.getByText('Testar a demonstração'));
    fireEvent.click(screen.getByRole('button', { name: 'Iniciar DEMO' }));
    await screen.findByText('Em andamento');
    expect(session).toHaveBeenLastCalledWith({
      version: 6,
      action: 'start',
      options: { mode: 'demo', consent },
    });
    session.mockResolvedValue(reply('paused'));
    fireEvent.click(screen.getByRole('button', { name: 'Pausar' }));
    await screen.findByText('Pausada');
    expect(screen.getByRole('button', { name: 'Iniciar DEMO' })).toBeDisabled();
    session.mockResolvedValue(reply('running'));
    fireEvent.click(screen.getByRole('button', { name: 'Retomar' }));
    await screen.findByText('Em andamento');
    session.mockResolvedValue(reply('stopped'));
    fireEvent.click(screen.getByRole('button', { name: 'Parar' }));
    await screen.findByText('Encerrada');
    expect(
      screen.queryByRole('button', { name: 'Retomar' }),
    ).not.toBeInTheDocument();
    expect(screen.getByText(/A DEMO usa falas simuladas/)).toBeVisible();
  });
  it('shows consent at start, then sends local source and locale settings', async () => {
    const session = vi.fn().mockResolvedValue(reply('idle'));
    vi.stubGlobal('meetingCopilot', { session });
    render(<SessionControls />);
    await screen.findByText('Pronta para iniciar');
    expect(screen.queryByRole('checkbox')).not.toBeInTheDocument();
    fireEvent.change(screen.getByLabelText('Idioma'), {
      target: { value: 'en-US' },
    });
    fireEvent.change(screen.getByLabelText('Fonte de áudio'), {
      target: { value: 'mic' },
    });
    fireEvent.click(
      screen.getByRole('button', { name: 'Iniciar transcrição local' }),
    );
    expect(screen.getByRole('alertdialog')).toHaveTextContent('microfone');
    expect(session).toHaveBeenCalledTimes(1);
    session.mockResolvedValue({
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
        phase: 'running',
        mode: 'apple-local',
        consent: { capture: true, context: false, remoteAudio: false },
      },
    });
    fireEvent.click(
      screen.getByRole('button', { name: 'Iniciar transcrição' }),
    );
    await screen.findByText('Em andamento');
    expect(session).toHaveBeenLastCalledWith({
      version: 6,
      action: 'start',
      options: {
        mode: 'apple-local',
        consent: { capture: true, context: false, remoteAudio: false },
        locale: 'en-US',
        sources: ['mic'],
      },
    });
    expect(screen.getByText(/áudio é processado neste Mac/)).toBeVisible();
    expect(
      screen.queryByRole('region', { name: 'Roteiro DEMO' }),
    ).not.toBeInTheDocument();
  });
  it('does not confirm optimistic state or duplicate pending commands and keeps stop for recovery', async () => {
    const session = vi.fn().mockResolvedValue(reply('running'));
    vi.stubGlobal('meetingCopilot', { session });
    render(<SessionControls />);
    await screen.findByText('Em andamento');
    session.mockResolvedValue({ version: 6, ok: false, code: 'TIMEOUT' });
    fireEvent.click(screen.getByRole('button', { name: 'Pausar' }));
    fireEvent.click(screen.getByRole('button', { name: 'Pausar' }));
    await screen.findByRole('alert');
    expect(session).toHaveBeenCalledTimes(3);
    expect(screen.getByText('Em andamento')).toBeVisible();
    expect(
      screen.getByRole('button', { name: 'Iniciar transcrição local' }),
    ).toBeDisabled();
    await waitFor(() =>
      expect(screen.getByRole('button', { name: 'Parar' })).toBeEnabled(),
    );
  });
  it('redacts transport failures on read', async () => {
    vi.stubGlobal('meetingCopilot', {
      session: vi.fn().mockRejectedValue(new Error('private')),
    });
    render(<SessionControls />);
    expect(await screen.findByRole('alert')).toHaveTextContent('Reabra o app');
    expect(screen.queryByText('private')).not.toBeInTheDocument();
  });
});

it('requires an explicit text/cost opt-in and valid model/budget before sending authorization', async () => {
  const session = vi.fn().mockResolvedValue(reply('idle'));
  vi.stubGlobal('meetingCopilot', {
    session,
    getSettings: vi
      .fn()
      .mockResolvedValue({ ok: true, settings: { credential: 'stored' } }),
  });
  render(<SessionControls />);
  await waitFor(() =>
    expect(
      screen.getByRole('button', { name: 'Iniciar transcrição local' }),
    ).toBeEnabled(),
  );
  fireEvent.click(
    screen.getByRole('button', { name: 'Iniciar transcrição local' }),
  );
  const checkbox = screen.getByRole('checkbox');
  expect(checkbox).not.toBeChecked();
  fireEvent.click(checkbox);
  const confirm = screen.getByRole('button', { name: 'Iniciar com sugestões' });
  expect(confirm).toBeDisabled();
  fireEvent.change(
    screen.getByRole('combobox', { name: 'Modelo para as sugestões' }),
    { target: { value: 'gpt-5.4' } },
  );
  fireEvent.change(screen.getByRole('spinbutton'), { target: { value: '0' } });
  expect(confirm).toBeDisabled();
  fireEvent.change(screen.getByRole('spinbutton'), { target: { value: '1' } });
  await waitFor(() => expect(confirm).toBeEnabled());
  fireEvent.click(confirm);
  await waitFor(() =>
    expect(session).toHaveBeenLastCalledWith({
      version: 6,
      action: 'start',
      options: {
        mode: 'apple-local',
        locale: 'pt-BR',
        sources: ['mic', 'system'],
        consent: { capture: true, context: true, remoteAudio: false },
        suggestions: { model: 'gpt-5.4', maxRequests: 1 },
      },
    }),
  );
});

it('renders real-session cards separately from DEMO and exposes revocation', async () => {
  const session = vi.fn().mockResolvedValue({
    ...reply('running'),
    session: {
      phase: 'running',
      mode: 'apple-local',
      consent: { capture: true, context: true, remoteAudio: false },
    },
    suggestions: {
      diagnostics: {
        model: 'synthetic-model',
        maxRequests: 1,
        activity: 'waiting-trigger',
        lastTrigger: 'question',
        lastAttempt: null,
      },
      status: 'exhausted',
      remainingRequests: 0,
      items: [
        {
          id: 'suggestion-1',
          category: 'question',
          title: 'Prazo sintético',
          body: 'Confirme o prazo fictício.',
          groundedIn: 'inference',
          expiresAt: null,
        },
      ],
    },
  });
  vi.stubGlobal('meetingCopilot', { session });
  render(<SessionControls />);
  const cards = await screen.findByRole('region', {
    name: 'Sugestões da reunião',
  });
  expect(cards).toHaveTextContent('Prazo sintético');
  expect(cards).not.toHaveTextContent('DEMO');
  expect(screen.getByText(/Limite atingido/)).toBeVisible();
  fireEvent.click(screen.getByRole('button', { name: 'Desativar sugestões' }));
  await waitFor(() =>
    expect(session).toHaveBeenLastCalledWith({
      version: 6,
      action: 'revoke-suggestions',
    }),
  );
});
