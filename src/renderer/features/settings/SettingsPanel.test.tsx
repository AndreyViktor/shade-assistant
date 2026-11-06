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
  it('shows only the local language preference and keeps cloud credentials secondary', async () => {
    render(<SettingsPanel />);
    expect(await screen.findByLabelText('Idioma')).toHaveValue('pt-BR');
    expect(screen.queryByLabelText('Modo preferido')).not.toBeInTheDocument();
    expect(
      screen.queryByLabelText('Provedor STT preferido'),
    ).not.toBeInTheDocument();
    expect(
      screen.getByText('Chave OpenAI (não usada na transcrição local)'),
    ).toBeInTheDocument();
    expect(screen.queryByRole('textbox')).not.toBeInTheDocument();
    expect(screen.getByText(/O idioma fica salvo/)).toBeVisible();
  });
  it('saves edited preferences only on explicit submit and renders the canonical response', async () => {
    render(<SettingsPanel />);
    fireEvent.change(await screen.findByLabelText('Idioma'), {
      target: { value: 'en-US' },
    });
    expect(api.savePreferences).not.toHaveBeenCalled();
    fireEvent.click(
      screen.getByRole('button', { name: 'Salvar preferências' }),
    );
    await waitFor(() =>
      expect(api.savePreferences).toHaveBeenCalledExactlyOnceWith({
        ...initial.settings.preferences,
        language: 'en-US',
      }),
    );
    expect(
      await screen.findByText(/Nenhum serviço foi iniciado/),
    ).toBeVisible();
    expect(screen.getByLabelText('Idioma')).toHaveValue('pt-BR');
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
      await screen.findByText('Chave OpenAI (não usada na transcrição local)'),
    );
    fireEvent.click(
      await screen.findByRole('button', { name: 'Importar chave' }),
    );
    expect(api.importSecret).toHaveBeenCalledExactlyOnceWith();
    expect(
      screen.getByRole('button', { name: 'Salvar preferências' }),
    ).toBeDisabled();
    finish({
      ...initial,
      settings: { ...initial.settings, credential: 'stored' },
    });
    await screen.findByText(/armazenada no cofre do Mac/);
    fireEvent.click(screen.getByRole('button', { name: 'Remover chave' }));
    await waitFor(() =>
      expect(api.removeSecret).toHaveBeenCalledExactlyOnceWith(),
    );
    await screen.findByText(/não configurada/);
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
