import { emptyDemo } from '../../../contracts/meeting/demo';
import { act, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { DemoDiagnostics } from './DemoDiagnostics';
import { useMeetingSession } from './useMeetingSession';

function DemoHarness() {
  return <DemoDiagnostics meeting={useMeetingSession()} />;
}
function renderDemo() {
  const view = render(<DemoHarness />);
  fireEvent.click(screen.getByText('Diagnóstico · DEMO offline'));
  return view;
}
const consent = { capture: false, context: false, remoteAudio: false };
const reply = (phase: string) => ({
  version: 8,
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
describe('DEMO diagnostics', () => {
  it.each(['running', 'paused'])(
    'blocks DEMO during a %s local session',
    async (phase) => {
      const session = vi.fn().mockResolvedValue({
        ...reply(phase),
        session: { ...reply(phase).session, mode: 'apple-local' },
      });
      vi.stubGlobal('meetingCopilot', { session });
      renderDemo();
      await screen.findByText(
        'Pare a transcrição no painel antes de iniciar a DEMO.',
      );
      expect(
        screen.getByRole('button', { name: 'Iniciar DEMO' }),
      ).toBeDisabled();
      expect(
        screen.queryByRole('button', { name: 'Pausar' }),
      ).not.toBeInTheDocument();
      expect(
        screen.queryByRole('button', { name: 'Retomar' }),
      ).not.toBeInTheDocument();
      expect(
        screen.queryByRole('region', { name: 'Roteiro DEMO' }),
      ).not.toBeInTheDocument();
      expect(session).toHaveBeenCalledExactlyOnceWith({
        version: 8,
        action: 'read',
      });
    },
  );
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
      renderDemo();
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
    renderDemo();
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
      version: 8,
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
    const view = renderDemo();
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
    renderDemo();
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
    renderDemo();
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
  it('waits for explicit start and sends no capture or remote consent', async () => {
    const session = vi.fn().mockResolvedValue(reply('idle'));
    vi.stubGlobal('meetingCopilot', { session });
    renderDemo();
    await screen.findByText('Pronta para iniciar');
    expect(session).toHaveBeenCalledExactlyOnceWith({
      version: 8,
      action: 'read',
    });
    expect(
      screen.queryByRole('button', { name: 'Pausar' }),
    ).not.toBeInTheDocument();
    session.mockResolvedValue(reply('running'));
    fireEvent.click(screen.getByRole('button', { name: 'Iniciar DEMO' }));
    await screen.findByText('Em andamento');
    expect(session).toHaveBeenLastCalledWith({
      version: 8,
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
});
