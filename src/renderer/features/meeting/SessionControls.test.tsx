import { defaultPreferences } from '../../../contracts/settings/preferences';
import { emptyDemo } from '../../../contracts/meeting/demo';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { SessionControls as Controls } from './SessionControls';
import { useMeetingSession } from './useMeetingSession';
import type { Preferences } from '../../../contracts/settings/preferences';

function SessionControls({
  savedPreferences,
}: {
  savedPreferences?: Preferences;
}) {
  return (
    <Controls
      meeting={useMeetingSession()}
      savedPreferences={savedPreferences}
    />
  );
}
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
  it('shows consent at start, then sends local source and locale settings', async () => {
    const session = vi.fn().mockResolvedValue(reply('idle'));
    vi.stubGlobal('meetingCopilot', { session });
    render(
      <SessionControls
        savedPreferences={{
          ...defaultPreferences('darwin'),
          language: 'en-US',
        }}
      />,
    );
    await screen.findByText('Pronta para iniciar');
    expect(screen.queryByRole('checkbox')).not.toBeInTheDocument();
    expect(screen.queryByLabelText('Idioma')).not.toBeInTheDocument();
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
    const session = vi.fn().mockResolvedValue({
      ...reply('running'),
      session: { ...reply('running').session, mode: 'apple-local' },
    });
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
      screen.queryByRole('button', { name: 'Iniciar transcrição local' }),
    ).not.toBeInTheDocument();
    await waitFor(() =>
      expect(screen.getByRole('button', { name: 'Parar' })).toBeEnabled(),
    );
  });
  it('redacts transport failures on read', async () => {
    vi.stubGlobal('meetingCopilot', {
      session: vi.fn().mockRejectedValue(new Error('private')),
    });
    render(<SessionControls />);
    expect(await screen.findByRole('alert')).toHaveTextContent(
      'Falha na transcrição. Consulte Preferências.',
    );
    expect(screen.queryByText('private')).not.toBeInTheDocument();
  });
});

it('requires an explicit text/cost opt-in and valid model/budget before sending authorization', async () => {
  const session = vi.fn().mockResolvedValue(reply('idle'));
  vi.stubGlobal('meetingCopilot', {
    session,
    getSettings: vi.fn().mockResolvedValue({
      ok: true,
      settings: {
        credential: 'stored',
        preferences: {
          ...defaultPreferences('darwin'),
          suggestionModel: 'gpt-5.4',
        },
      },
    }),
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
  expect(
    screen.queryByRole('combobox', { name: 'Modelo para as sugestões' }),
  ).not.toBeInTheDocument();
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
