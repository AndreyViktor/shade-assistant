import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { ReadinessPanel } from './ReadinessPanel';

const snapshot = {
  owner: {
    capture: 'MeetingCopilotTranscriber' as const,
    host: 'Meeting Copilot' as const,
  },
  microphone: { state: 'not-requested' as const, detail: 'exact' as const },
  systemAudio: {
    state: 'denied' as const,
    detail: 'screen-preflight-ambiguous' as const,
  },
  speechRecognition: {
    state: 'restricted' as const,
    detail: 'exact' as const,
  },
  helper: { state: 'allowed' as const, detail: 'exact' as const },
  helperIdentity: {
    process: 'MeetingCopilotTranscriber' as const,
    bundleIdentifier: 'local.meetingcopilot.transcriber',
    signingIdentifier: 'local.meetingcopilot.transcriber',
    signature: 'no-team' as const,
  },
};
const api = {
  getReadiness: vi.fn(),
  openPermissionSettings: vi.fn(),
};

beforeEach(() => {
  vi.clearAllMocks();
  api.getReadiness.mockResolvedValue({
    version: 1,
    ok: true,
    action: 'check',
    readiness: snapshot,
  });
  api.openPermissionSettings.mockResolvedValue({
    version: 1,
    ok: true,
    action: 'open-settings',
    target: 'microphone',
  });
  vi.stubGlobal('meetingCopilot', api);
});
afterEach(() => vi.unstubAllGlobals());

describe('session readiness center', () => {
  it('checks only on explicit action and explains owner and all returned states', async () => {
    render(<ReadinessPanel />);
    expect(api.getReadiness).not.toHaveBeenCalled();
    expect(
      screen.getByText(/atribuir permissões também ao Electron/),
    ).toBeVisible();
    expect(screen.getByText(/não pede permissão/)).toBeVisible();
    fireEvent.click(
      screen.getByRole('button', { name: 'Verificar prontidão' }),
    );
    await screen.findByRole('button', { name: 'Rechecar prontidão' });
    expect(api.getReadiness).toHaveBeenCalledExactlyOnceWith();
    expect(screen.getByText('Não solicitado')).toBeVisible();
    expect(
      screen.getByText('Não permitido ou ainda não solicitado'),
    ).toBeVisible();
    expect(screen.getByText('Restrito')).toBeVisible();
    expect(screen.getByText('Permitido')).toBeVisible();
    expect(screen.getByText(/sem identificador de equipe/)).toBeVisible();
    expect(screen.getByRole('status')).toHaveTextContent(
      'Nenhuma captura foi iniciada',
    );
  });

  it('opens only the chosen settings pane and requires a later recheck', async () => {
    render(<ReadinessPanel />);
    fireEvent.click(
      screen.getByRole('button', { name: 'Verificar prontidão' }),
    );
    fireEvent.click(
      await screen.findByRole('button', {
        name: 'Abrir Ajustes de Microfone',
      }),
    );
    await waitFor(() =>
      expect(api.openPermissionSettings).toHaveBeenCalledExactlyOnceWith(
        'microphone',
      ),
    );
    expect(screen.getByRole('status')).toHaveTextContent(
      'Nenhuma captura foi iniciada; rechecque',
    );
    expect(api.getReadiness).toHaveBeenCalledOnce();
  });

  it('fails without exposing transport details or claiming a check', async () => {
    api.getReadiness.mockRejectedValue(
      new Error('synthetic-private /private/helper'),
    );
    render(<ReadinessPanel />);
    fireEvent.click(
      screen.getByRole('button', { name: 'Verificar prontidão' }),
    );
    expect(await screen.findByRole('status')).toHaveTextContent(
      'Não foi possível rechecá-la',
    );
    expect(screen.queryByText(/synthetic-private/)).not.toBeInTheDocument();
  });
});
