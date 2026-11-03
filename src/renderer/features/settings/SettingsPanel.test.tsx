import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { defaultPreferences } from '../../../contracts/settings/preferences';
import { SettingsPanel } from './SettingsPanel';

const initial = {
  version: 1,
  ok: true,
  settings: {
    preferences: defaultPreferences('darwin'),
    credential: 'missing',
  },
};
const api = {
  getSettings: vi.fn(),
  savePreferences: vi.fn(),
  importSecret: vi.fn(),
  removeSecret: vi.fn(),
};
beforeEach(() => {
  vi.clearAllMocks();
  api.getSettings.mockResolvedValue(initial);
  api.savePreferences.mockResolvedValue(initial);
  vi.stubGlobal('meetingCopilot', api);
});
afterEach(() => vi.unstubAllGlobals());

describe('settings interface', () => {
  it('shows Mac defaults, unavailable remote opt-in and no secret input', async () => {
    render(<SettingsPanel />);
    expect(await screen.findByLabelText('Modo preferido')).toHaveValue('demo');
    expect(screen.getByLabelText('Provedor STT preferido')).toHaveValue(
      'apple-local',
    );
    expect(screen.getByLabelText('Idiomas preferidos')).toHaveValue('pt-BR');
    expect(screen.getByRole('option', { name: /OPENAI STT/ })).toBeDisabled();
    expect(screen.queryByRole('textbox')).not.toBeInTheDocument();
    expect(screen.getByText(/Salvar não inicia captura/)).toBeVisible();
  });
  it('saves edited preferences only on explicit submit and renders the canonical response', async () => {
    render(<SettingsPanel />);
    fireEvent.change(await screen.findByLabelText('Modo preferido'), {
      target: { value: 'real' },
    });
    fireEvent.change(screen.getByLabelText('Idiomas preferidos'), {
      target: { value: 'en-US' },
    });
    expect(api.savePreferences).not.toHaveBeenCalled();
    fireEvent.click(
      screen.getByRole('button', { name: 'Salvar preferências' }),
    );
    await waitFor(() =>
      expect(api.savePreferences).toHaveBeenCalledExactlyOnceWith({
        ...initial.settings.preferences,
        mode: 'real',
        language: 'en-US',
      }),
    );
    expect(
      await screen.findByText(/Nenhum serviço foi iniciado/),
    ).toBeVisible();
    expect(screen.getByLabelText('Modo preferido')).toHaveValue('demo');
  });
  it('imports and removes with no secret or path arguments; disables actions while pending', async () => {
    let finish: (value: unknown) => void = () => {
      throw new Error('not started');
    };
    api.importSecret.mockReturnValue(
      new Promise((resolve) => {
        finish = resolve;
      }),
    );
    api.removeSecret.mockResolvedValue(initial);
    render(<SettingsPanel />);
    fireEvent.click(
      await screen.findByRole('button', { name: 'Importar chave pelo Mac' }),
    );
    expect(api.importSecret).toHaveBeenCalledExactlyOnceWith();
    expect(
      screen.getByRole('button', { name: 'Salvar preferências' }),
    ).toBeDisabled();
    finish({
      ...initial,
      settings: { ...initial.settings, credential: 'stored' },
    });
    await screen.findByText(/armazenada; validade não verificada/);
    fireEvent.click(
      screen.getByRole('button', { name: 'Remover chave armazenada' }),
    );
    await waitFor(() =>
      expect(api.removeSecret).toHaveBeenCalledExactlyOnceWith(),
    );
    await screen.findByText(/Chave OpenAI: não configurada/);
  });
  it('reports failed saves without claiming persistence or echoing transport errors', async () => {
    api.savePreferences.mockRejectedValue(new Error('synthetic-private-key'));
    render(<SettingsPanel />);
    fireEvent.click(
      await screen.findByRole('button', { name: 'Salvar preferências' }),
    );
    expect(await screen.findByText(/Não foi possível concluir/)).toBeVisible();
    expect(screen.queryByText(/synthetic-private-key/)).not.toBeInTheDocument();
  });
  it('shows read failures without enabling actions', async () => {
    api.getSettings.mockResolvedValue({
      version: 1,
      ok: false,
      code: 'UNAVAILABLE',
    });
    render(<SettingsPanel />);
    expect(await screen.findByText(/Não foi possível carregar/)).toBeVisible();
    expect(screen.queryByRole('button')).not.toBeInTheDocument();
  });
});
