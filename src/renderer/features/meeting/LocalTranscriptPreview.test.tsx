import { act, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, expect, it, vi } from 'vitest';
import { emptyDemo } from '../../../contracts/meeting/demo';
import { SessionControls } from './SessionControls';
import type { SessionResult } from '../../../contracts/ipc/session';

const base = {
  version: 1 as const,
  sessionId: 'test',
  source: 'mic' as const,
  locale: 'pt-BR' as const,
  seq: 1,
  timestampMs: 100,
};
const reply = (): SessionResult => ({
  version: 3,
  ok: true,
  demo: emptyDemo(),
  session: {
    mode: 'apple-local',
    phase: 'running',
    consent: { capture: true, context: false, remoteAudio: false },
  },
  local: {
    failed: false,
    config: { sessionId: 'test', sources: ['mic', 'system'], locale: 'pt-BR' },
    channels: [{ ...base, type: 'status', state: 'listening' }],
    segments: [
      {
        ...base,
        type: 'partial',
        segmentId: 's1',
        startMs: 0,
        endMs: 100,
        text: 'Hipótese',
      },
    ],
  },
});
afterEach(() => {
  vi.unstubAllGlobals();
  vi.useRealTimers();
});

it('updates actual partial/final labels, exposes native errors even while paused, and discards speech', async () => {
  vi.useFakeTimers();
  const initial = reply();
  if (!initial.ok || !initial.local) throw new Error('Invalid fixture');
  const session = vi.fn().mockResolvedValue(initial);
  vi.stubGlobal('meetingCopilot', { session });
  render(<SessionControls />);
  await act(async () => {
    await Promise.resolve();
  });
  expect(screen.getByText('Hipótese')).toBeVisible();
  expect(screen.getByText(/Microfone · pt-BR · Parcial/)).toBeVisible();
  expect(screen.getByText('00:00.000–00:00.100')).toBeVisible();
  const segment = initial.local.segments[0];
  if (!segment) throw new Error('Missing segment');
  const final = {
    ...initial,
    local: {
      ...initial.local,
      segments: [{ ...segment, type: 'final', text: '<b>Fala final</b>' }],
    },
  };
  session.mockResolvedValue(final);
  await act(async () => {
    await vi.advanceTimersByTimeAsync(500);
  });
  expect(screen.getByText('<b>Fala final</b>')).toBeVisible();
  expect(screen.queryByText('Hipótese')).not.toBeInTheDocument();
  expect(screen.getByText(/Microfone · pt-BR · Final/)).toBeVisible();
  session.mockResolvedValue({
    ...final,
    session: { ...initial.session, phase: 'paused' },
  });
  await act(async () => {
    fireEvent.click(screen.getByRole('button', { name: 'Pausar' }));
    await Promise.resolve();
  });
  session.mockResolvedValue({
    ...initial,
    session: { ...initial.session, phase: 'stopped' },
    local: {
      ...initial.local,
      segments: [],
      channels: [{ ...base, type: 'error', code: 'capture-failed' }],
    },
  });
  await act(async () => {
    await vi.advanceTimersByTimeAsync(500);
  });
  expect(screen.getByRole('alert')).toHaveTextContent(
    'A captura de áudio falhou',
  );
  expect(screen.queryByText('<b>Fala final</b>')).not.toBeInTheDocument();
  expect(screen.getByText('Encerrada')).toBeVisible();
});

it('rejects a delayed native snapshot after stop and cancels polling on unmount', async () => {
  vi.useFakeTimers();
  const initial = reply();
  if (!initial.ok) throw new Error('Invalid fixture');
  const session = vi.fn().mockResolvedValue(initial);
  vi.stubGlobal('meetingCopilot', { session });
  const view = render(<SessionControls />);
  await act(async () => {
    await Promise.resolve();
  });
  let resolve: (value: SessionResult) => void = () => {};
  session.mockReturnValueOnce(
    new Promise<SessionResult>((finish) => {
      resolve = finish;
    }),
  );
  await act(async () => {
    await vi.advanceTimersByTimeAsync(500);
  });
  session.mockResolvedValue({
    ...initial,
    session: { ...initial.session, phase: 'stopped' },
    local: null,
  });
  await act(async () => {
    fireEvent.click(screen.getByRole('button', { name: 'Parar' }));
    await Promise.resolve();
  });
  await act(async () => {
    resolve(initial);
    await Promise.resolve();
  });
  expect(
    screen.queryByRole('region', { name: 'Transcrição ao vivo' }),
  ).not.toBeInTheDocument();
  view.unmount();
  const count = session.mock.calls.length;
  await act(async () => {
    await vi.advanceTimersByTimeAsync(2000);
  });
  expect(session).toHaveBeenCalledTimes(count);
});
