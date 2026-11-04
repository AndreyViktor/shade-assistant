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
  session: { mode: 'demo', phase, consent },
});
afterEach(() => vi.unstubAllGlobals());
describe('session controls', () => {
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
