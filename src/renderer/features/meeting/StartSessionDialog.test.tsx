import { defaultPreferences } from '../../../contracts/settings/preferences';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, expect, it, vi } from 'vitest';
import { StartSessionDialog } from './StartSessionDialog';

function setup(credential = 'missing', suggestionModel = 'gpt-5.4-mini') {
  const getSettings = vi.fn().mockResolvedValue({
    ok: true,
    settings: {
      credential,
      preferences: { ...defaultPreferences('darwin'), suggestionModel },
    },
  });
  const importSecret = vi
    .fn()
    .mockResolvedValue({ ok: true, settings: { credential: 'stored' } });
  vi.stubGlobal('meetingCopilot', { getSettings, importSecret });
  const onStart = vi.fn();
  const onCancel = vi.fn();
  render(
    <StartSessionDialog
      source="microfone"
      language="Português (Brasil)"
      onStart={onStart}
      onCancel={onCancel}
    />,
  );
  return { onStart, onCancel, getSettings, importSecret };
}
afterEach(() => vi.unstubAllGlobals());

it('allows local transcription even while key metadata is unavailable', async () => {
  const { onStart, importSecret, getSettings } = setup();
  getSettings.mockRejectedValue(new Error('private details'));
  expect(screen.queryByRole('textbox')).not.toBeInTheDocument();
  expect(
    screen.getByText(/Não precisa de conta, chave ou créditos/),
  ).toBeVisible();
  fireEvent.click(screen.getByRole('button', { name: 'Iniciar transcrição' }));
  expect(onStart).toHaveBeenCalledExactlyOnceWith(undefined);
  await waitFor(() => expect(getSettings).toHaveBeenCalledOnce());
  expect(importSecret).not.toHaveBeenCalled();
  expect(screen.queryByText('private details')).not.toBeInTheDocument();
});

it('keeps key setup in preferences and never imports or starts implicitly', async () => {
  const { onStart, importSecret } = setup();
  fireEvent.click(screen.getByRole('checkbox'));
  await screen.findByText('Chave ainda não configurada');
  expect(screen.getByText(/Configure a chave em Preferências/)).toBeVisible();
  expect(
    screen.queryByRole('button', { name: /Importar/ }),
  ).not.toBeInTheDocument();
  expect(
    screen.getByRole('button', { name: 'Iniciar com sugestões' }),
  ).toBeDisabled();
  expect(importSecret).not.toHaveBeenCalled();
  expect(onStart).not.toHaveBeenCalled();
});

it('can bypass incomplete AI setup without granting text consent', async () => {
  const { onStart } = setup();
  fireEvent.click(screen.getByRole('checkbox'));
  await screen.findByText('Chave ainda não configurada');
  expect(
    screen.getByRole('button', { name: 'Iniciar com sugestões' }),
  ).toBeDisabled();
  fireEvent.click(
    screen.getByRole('button', { name: 'Iniciar apenas a transcrição' }),
  );
  expect(onStart).toHaveBeenCalledExactlyOnceWith();
});

it('keeps keyboard focus inside the confirmation and cancels on Escape', async () => {
  const { onCancel, onStart } = setup();
  await waitFor(() =>
    expect(screen.getByRole('button', { name: 'Cancelar' })).toHaveFocus(),
  );
  const dialog = screen.getByRole('alertdialog');
  fireEvent.keyDown(dialog, { key: 'Tab' });
  expect(screen.getByRole('checkbox')).toHaveFocus();
  fireEvent.keyDown(dialog, { key: 'Tab', shiftKey: true });
  expect(screen.getByRole('button', { name: 'Cancelar' })).toHaveFocus();
  fireEvent.keyDown(dialog, { key: 'Escape' });
  expect(onCancel).toHaveBeenCalledOnce();
  expect(onStart).not.toHaveBeenCalled();
});

it.each(['gpt-5.4-mini', 'gpt-5.4'])(
  'uses the saved model %s only after fresh consent',
  async (model) => {
    const { onStart } = setup('stored', model);
    expect(screen.getByRole('checkbox')).not.toBeChecked();
    fireEvent.click(screen.getByRole('checkbox'));
    await screen.findByText('Chave configurada');
    expect(screen.queryByRole('combobox')).not.toBeInTheDocument();
    expect(
      screen.getByRole('textbox', { name: 'Contexto da reunião (opcional)' }),
    ).toHaveValue('');
    expect(onStart).not.toHaveBeenCalled();
    fireEvent.click(
      screen.getByRole('button', { name: 'Iniciar com sugestões' }),
    );
    expect(onStart).toHaveBeenCalledExactlyOnceWith({ model, maxRequests: 10 });
  },
);

it('sends optional context only with explicit suggestions consent and clears it when disabled', async () => {
  const { onStart } = setup('stored');
  fireEvent.click(screen.getByRole('checkbox'));
  await screen.findByText('Chave configurada');
  const input = screen.getByRole('textbox', {
    name: 'Contexto da reunião (opcional)',
  });
  expect(input).toHaveAttribute('maxlength', '2000');
  expect(input).toHaveAccessibleDescription(/enviado separado da transcrição/);
  expect(input).toHaveAccessibleDescription(
    /apagado ao encerrar ou desativar sugestões/,
  );
  fireEvent.change(input, {
    target: { value: '  Objetivo sintético: esclarecer riscos.  ' },
  });
  expect(onStart).not.toHaveBeenCalled();
  fireEvent.click(
    screen.getByRole('button', { name: 'Iniciar com sugestões' }),
  );
  expect(onStart).toHaveBeenLastCalledWith({
    model: 'gpt-5.4-mini',
    maxRequests: 10,
    userContext: 'Objetivo sintético: esclarecer riscos.',
  });
  fireEvent.click(
    screen.getByRole('button', { name: 'Iniciar apenas a transcrição' }),
  );
  expect(onStart).toHaveBeenLastCalledWith();
  fireEvent.click(screen.getByRole('checkbox'));
  fireEvent.click(screen.getByRole('checkbox'));
  expect(screen.getByRole('textbox')).toHaveValue('');
});

it('rejects oversized context but permits transcription and accepts whitespace as absent', async () => {
  const { onStart } = setup('stored');
  fireEvent.click(screen.getByRole('checkbox'));
  await screen.findByText('Chave configurada');
  fireEvent.change(screen.getByRole('textbox'), {
    target: { value: 'a'.repeat(2001) },
  });
  expect(
    screen.getByRole('button', { name: 'Iniciar com sugestões' }),
  ).toBeDisabled();
  expect(
    screen.getByRole('button', { name: 'Iniciar apenas a transcrição' }),
  ).toBeEnabled();
  fireEvent.change(screen.getByRole('textbox'), { target: { value: ' \n ' } });
  fireEvent.click(
    screen.getByRole('button', { name: 'Iniciar com sugestões' }),
  );
  expect(onStart).toHaveBeenCalledExactlyOnceWith({
    model: 'gpt-5.4-mini',
    maxRequests: 10,
  });
});
