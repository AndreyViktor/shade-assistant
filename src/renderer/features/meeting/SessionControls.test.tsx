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
  version: 1,
  ok: true,
  demo: emptyDemo(),
  session: { mode: 'demo', phase, consent },
});
afterEach(() => {
  vi.unstubAllGlobals();
  vi.useRealTimers();
});
describe('session controls', () => {
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
        suggestion: { sequence: 2, text: 'Sugestão sintética.' },
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
          suggestion: null,
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
  it('waits for manual start, confirms state from main and exposes separate data notices', async () => {
    const session = vi.fn().mockResolvedValue(reply('idle'));
    vi.stubGlobal('meetingCopilot', { session });
    render(<SessionControls />);
    await screen.findByText('Não iniciada');
    expect(session).toHaveBeenCalledExactlyOnceWith({
      version: 1,
      action: 'read',
    });
    expect(screen.getByRole('button', { name: 'Pausar' })).toBeDisabled();
    session.mockResolvedValue(reply('running'));
    fireEvent.click(screen.getByRole('button', { name: 'Iniciar DEMO' }));
    await screen.findByText('Em andamento');
    expect(session).toHaveBeenLastCalledWith({
      version: 1,
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
    expect(screen.getByRole('button', { name: 'Retomar' })).toBeDisabled();
    expect(screen.getByText(/Texto de contexto só poderá/)).toBeInTheDocument();
    expect(screen.getByText(/custos de API/)).toBeInTheDocument();
    expect(
      screen.getByText(/prévia e confirmação de cada imagem/),
    ).toBeInTheDocument();
  });
  it('does not confirm optimistic state or duplicate pending commands and keeps stop for recovery', async () => {
    const session = vi.fn().mockResolvedValue(reply('running'));
    vi.stubGlobal('meetingCopilot', { session });
    render(<SessionControls />);
    await screen.findByText('Em andamento');
    session.mockResolvedValue({ version: 1, ok: false, code: 'TIMEOUT' });
    fireEvent.click(screen.getByRole('button', { name: 'Pausar' }));
    fireEvent.click(screen.getByRole('button', { name: 'Pausar' }));
    await screen.findByRole('alert');
    expect(session).toHaveBeenCalledTimes(2);
    expect(screen.getByText('Estado não confirmado')).toBeVisible();
    expect(screen.getByRole('button', { name: 'Iniciar DEMO' })).toBeDisabled();
    await waitFor(() =>
      expect(screen.getByRole('button', { name: 'Parar' })).toBeEnabled(),
    );
  });
  it('ignores a read that arrives after an explicit stop', async () => {
    let finish: (value: ReturnType<typeof reply>) => void = () => {};
    const session = vi
      .fn()
      .mockReturnValueOnce(
        new Promise((resolve) => {
          finish = resolve;
        }),
      )
      .mockResolvedValue(reply('stopped'));
    vi.stubGlobal('meetingCopilot', { session });
    render(<SessionControls />);
    fireEvent.click(screen.getByRole('button', { name: 'Parar' }));
    await screen.findByText('Encerrada');
    await act(async () => {
      finish(reply('running'));
      await Promise.resolve();
    });
    expect(screen.getByText('Encerrada')).toBeVisible();
    expect(screen.queryByText('Em andamento')).not.toBeInTheDocument();
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
