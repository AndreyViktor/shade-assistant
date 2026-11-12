import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, expect, it, vi } from 'vitest';
import { StartSessionDialog } from './StartSessionDialog';

function setup(credential = 'missing') {
  const getSettings = vi
    .fn()
    .mockResolvedValue({ ok: true, settings: { credential } });
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

it('imports via the existing secret IPC without key arguments and requires model plus explicit start', async () => {
  const { onStart, importSecret } = setup();
  fireEvent.click(screen.getByRole('checkbox'));
  await waitFor(() =>
    expect(
      screen.getByRole('button', { name: 'Importar arquivo com a chave' }),
    ).toBeEnabled(),
  );
  const start = screen.getByRole('button', { name: 'Iniciar com sugestões' });
  expect(start).toBeDisabled();
  fireEvent.click(
    screen.getByRole('button', { name: 'Importar arquivo com a chave' }),
  );
  expect(await screen.findByText('Chave configurada')).toBeVisible();
  expect(importSecret).toHaveBeenCalledExactlyOnceWith();
  expect(onStart).not.toHaveBeenCalled();
  expect(start).toBeDisabled();
  const model = screen.getByRole('textbox', {
    name: 'Modelo para as sugestões',
  });
  expect(model).toHaveAccessibleDescription(/Este campo não é a chave/);
  fireEvent.change(model, { target: { value: 'sk-synthetic-not-a-real-key' } });
  expect(start).toBeDisabled();
  expect(screen.getByRole('alert')).toHaveTextContent('Isso parece uma chave');
  fireEvent.change(model, { target: { value: 'synthetic-model' } });
  fireEvent.click(start);
  expect(onStart).toHaveBeenCalledExactlyOnceWith({
    model: 'synthetic-model',
    maxRequests: 1,
  });
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
