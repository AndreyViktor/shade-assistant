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
  it('offers implemented providers by capability and model choices without claiming remote STT', async () => {
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
    expect(
      screen.getByText(/Fonte, idioma, fornecedores, modelo e perfil padrão/),
    ).toBeVisible();
    expect(screen.getByLabelText('Fornecedor de transcrição')).toHaveValue(
      'apple-local',
    );
    expect(screen.getByRole('option', { name: /OpenAI STT/ })).toBeDisabled();
    expect(screen.getByLabelText('Fornecedor de sugestões')).toHaveValue(
      'openai',
    );
    expect(screen.getByLabelText('Modelo para as sugestões')).toHaveValue(
      'gpt-5.4-mini',
    );
    expect(screen.getByLabelText('Perfil padrão da reunião')).toHaveValue(
      'none',
    );
    expect(
      screen.getByText(/Somente este identificador interno/),
    ).toBeVisible();
  });
  it('saves edited preferences only on explicit submit and renders the canonical response', async () => {
    render(<SettingsPanel />);
    fireEvent.change(await screen.findByLabelText('Idioma'), {
      target: { value: 'en-US' },
    });
    fireEvent.change(screen.getByLabelText('Modelo para as sugestões'), {
      target: { value: 'gpt-5.4' },
    });
    fireEvent.change(screen.getByLabelText('Fonte de áudio'), {
      target: { value: 'system' },
    });
    fireEvent.change(screen.getByLabelText('Perfil padrão da reunião'), {
      target: { value: 'technical-review' },
    });
    expect(screen.getByText(/Examinar decisões técnicas/)).toBeVisible();
    expect(screen.getByText(/premissas e trade-offs/)).toBeVisible();
    expect(api.savePreferences).not.toHaveBeenCalled();
    fireEvent.click(
      screen.getByRole('button', { name: 'Salvar preferências' }),
    );
    await waitFor(() =>
      expect(api.savePreferences).toHaveBeenCalledExactlyOnceWith({
        ...initial.settings.preferences,
        language: 'en-US',
        audioSource: 'system',
        suggestionModel: 'gpt-5.4',
        meetingProfile: 'technical-review',
      }),
    );
    expect(
      await screen.findByText(/Nenhum serviço foi iniciado/),
    ).toBeVisible();
    expect(screen.getByLabelText('Idioma')).toHaveValue('pt-BR');
    expect(screen.getByLabelText('Fonte de áudio')).toHaveValue('both');
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
    fireEvent.change(await screen.findByLabelText('Fonte de áudio'), {
      target: { value: 'mic' },
    });
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
    expect(api.savePreferences).not.toHaveBeenCalled();
    expect(screen.getByLabelText('Fonte de áudio')).toHaveValue('mic');
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

it('refreshes key metadata when reopened without losing an unsaved language draft', async () => {
  const { rerender } = render(<SettingsPanel active />);
  fireEvent.change(await screen.findByLabelText('Idioma'), {
    target: { value: 'en-US' },
  });
  rerender(<SettingsPanel active={false} />);
  api.getSettings.mockResolvedValue({
    ...initial,
    settings: { ...initial.settings, credential: 'stored' },
  });
  rerender(<SettingsPanel active />);
  await screen.findByText(/armazenada no cofre do Mac/);
  expect(screen.getByLabelText('Idioma')).toHaveValue('en-US');
});
