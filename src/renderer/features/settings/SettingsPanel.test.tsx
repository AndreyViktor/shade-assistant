import {
  fireEvent,
  render,
  screen,
  waitFor,
  within,
} from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { Preferences } from '../../../contracts/settings/preferences';
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

async function open(name: string) {
  fireEvent.click(
    await screen.findByRole('button', { name: new RegExp(name) }),
  );
}

describe('settings areas', () => {
  it('keeps the next control focused when navigating immediately after entering an area', async () => {
    render(<SettingsPanel diagnostics={<button>Abrir roteiro</button>} />);
    await open('Diagnóstico');
    const entry = screen.getByRole('button', { name: 'Abrir roteiro' });
    entry.focus();
    await new Promise<void>((resolve) =>
      requestAnimationFrame(() => resolve()),
    );
    expect(entry).toHaveFocus();
  });

  it('announces loading and saving and prevents duplicate writes', async () => {
    let finishLoad: (value: typeof initial) => void = () => {};
    api.getSettings.mockReturnValueOnce(
      new Promise((resolve) => {
        finishLoad = resolve;
      }),
    );
    render(<SettingsPanel />);
    expect(screen.getByRole('status')).toHaveTextContent(
      'Carregando preferências',
    );
    finishLoad(initial);
    await open('Áudio e transcrição');
    let finishSave: (value: typeof initial) => void = () => {};
    api.savePreferences.mockReturnValueOnce(
      new Promise((resolve) => {
        finishSave = resolve;
      }),
    );
    fireEvent.change(screen.getByLabelText('Idioma'), {
      target: { value: 'en-US' },
    });
    fireEvent.click(
      screen.getByRole('button', { name: 'Salvar preferências' }),
    );
    expect(screen.getByText('Salvando preferências…')).toBeVisible();
    expect(
      screen.getByRole('button', { name: 'Salvar preferências' }),
    ).toBeDisabled();
    finishSave(initial);
    expect(
      await screen.findByText(/Nenhum serviço foi iniciado/),
    ).toBeVisible();
  });
  it('summarizes saved values and preserves provider controls', async () => {
    render(<SettingsPanel />);
    const audio = await screen.findByRole('button', {
      name: /Áudio e transcrição/,
    });
    expect(audio).toHaveTextContent('pt-BR');
    expect(
      screen.getByRole('button', { name: /Sugestões de IA/ }),
    ).toHaveTextContent('Chave não configurada');
    expect(
      screen.getByRole('button', { name: /Permissões e prontidão/ }),
    ).toHaveTextContent('Não verificado');
    expect(
      screen.getByRole('button', { name: /Diagnóstico/ }),
    ).toHaveTextContent('DEMO offline');
    fireEvent.click(audio);
    expect(screen.getByLabelText('Fornecedor de transcrição')).toHaveValue(
      'apple-local',
    );
    expect(screen.getByRole('option', { name: /OpenAI STT/ })).toBeDisabled();
    expect(
      screen.getByRole('button', { name: 'Salvar preferências' }),
    ).toBeDisabled();
    fireEvent.click(
      screen.getByRole('button', { name: 'Voltar às preferências' }),
    );
    await open('Sugestões de IA');
    expect(screen.getByLabelText('Modelo para as sugestões')).toHaveValue(
      'gpt-5.4-mini',
    );
    expect(
      screen.queryByLabelText('Perfil padrão da reunião'),
    ).not.toBeInTheDocument();
    expect(screen.queryByRole('textbox')).not.toBeInTheDocument();
  });
  it('saves only changed values and uses canonical response in summary', async () => {
    api.savePreferences.mockImplementation((preferences: Preferences) =>
      Promise.resolve({
        ...initial,
        settings: { ...initial.settings, preferences },
      }),
    );
    render(<SettingsPanel />);
    await open('Áudio e transcrição');
    fireEvent.change(screen.getByLabelText('Idioma'), {
      target: { value: 'en-US' },
    });
    expect(screen.getByText('Alterações pendentes')).toBeVisible();
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
    expect(
      screen.getByRole('button', { name: 'Salvar preferências' }),
    ).toBeDisabled();
    fireEvent.click(
      screen.getByRole('button', { name: 'Voltar às preferências' }),
    );
    expect(
      screen.getByRole('button', { name: /Áudio e transcrição/ }),
    ).toHaveTextContent('en-US');
  });
  it('confirms discard, Escape returns focus, and cancel keeps the draft', async () => {
    render(<SettingsPanel />);
    const origin = await screen.findByRole('button', {
      name: /Áudio e transcrição/,
    });
    fireEvent.click(origin);
    fireEvent.change(screen.getByLabelText('Idioma'), {
      target: { value: 'en-US' },
    });
    const cancel = screen.getByRole('button', { name: 'Cancelar' });
    cancel.focus();
    fireEvent.click(cancel);
    const dialog = screen.getByRole('dialog', {
      name: 'Descartar alterações?',
    });
    expect(
      within(dialog).getByRole('button', { name: 'Continuar editando' }),
    ).toHaveFocus();
    fireEvent.keyDown(dialog, { key: 'Escape' });
    expect(cancel).toHaveFocus();
    expect(screen.getByLabelText('Idioma')).toHaveValue('en-US');
    fireEvent.click(cancel);
    fireEvent.click(
      within(screen.getByRole('dialog')).getByRole('button', {
        name: 'Descartar alterações',
      }),
    );
    const restored = await screen.findByRole('button', {
      name: /Áudio e transcrição/,
    });
    await waitFor(() => expect(restored).toHaveFocus());
    fireEvent.click(restored);
    expect(screen.getByLabelText('Idioma')).toHaveValue('pt-BR');
    expect(api.savePreferences).not.toHaveBeenCalled();
  });
  it('retains the draft after save failure and permits retry without exposing errors', async () => {
    api.savePreferences
      .mockRejectedValueOnce(new Error('synthetic-private-key'))
      .mockResolvedValue(initial);
    render(<SettingsPanel />);
    await open('Áudio e transcrição');
    fireEvent.change(screen.getByLabelText('Idioma'), {
      target: { value: 'en-US' },
    });
    fireEvent.click(
      screen.getByRole('button', { name: 'Salvar preferências' }),
    );
    expect(await screen.findByText(/Não foi possível concluir/)).toBeVisible();
    expect(screen.queryByText(/synthetic-private-key/)).not.toBeInTheDocument();
    expect(screen.getByLabelText('Idioma')).toHaveValue('en-US');
    fireEvent.click(
      screen.getByRole('button', { name: 'Salvar preferências' }),
    );
    expect(
      await screen.findByText(/Nenhum serviço foi iniciado/),
    ).toBeVisible();
  });
  it('retries failed loading', async () => {
    api.getSettings
      .mockResolvedValueOnce({ ok: false })
      .mockResolvedValue(initial);
    render(<SettingsPanel />);
    expect(await screen.findByText(/Não foi possível carregar/)).toBeVisible();
    fireEvent.click(screen.getByRole('button', { name: 'Tentar novamente' }));
    expect(
      await screen.findByRole('button', { name: /Áudio e transcrição/ }),
    ).toBeVisible();
  });
  it('imports and removes secrets with no arguments without saving a pending draft', async () => {
    api.importSecret.mockResolvedValue({
      ...initial,
      settings: { ...initial.settings, credential: 'stored' },
    });
    api.removeSecret.mockResolvedValue(initial);
    render(<SettingsPanel />);
    await open('Sugestões de IA');
    fireEvent.change(screen.getByLabelText('Modelo para as sugestões'), {
      target: { value: 'gpt-5.4' },
    });
    fireEvent.click(
      screen.getByText('Chave OpenAI (não usada na transcrição local)'),
    );
    fireEvent.click(screen.getByRole('button', { name: 'Importar chave' }));
    expect(await screen.findByText(/armazenada no cofre do Mac/)).toBeVisible();
    expect(api.importSecret).toHaveBeenCalledExactlyOnceWith();
    fireEvent.click(screen.getByRole('button', { name: 'Remover chave' }));
    await waitFor(() =>
      expect(api.removeSecret).toHaveBeenCalledExactlyOnceWith(),
    );
    expect(screen.getByLabelText('Modelo para as sugestões')).toHaveValue(
      'gpt-5.4',
    );
    expect(api.savePreferences).not.toHaveBeenCalled();
  });
});
