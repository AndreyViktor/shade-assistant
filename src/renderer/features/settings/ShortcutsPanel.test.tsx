import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, expect, it, vi } from 'vitest';
import { DEFAULT_SHORTCUTS } from '../../../contracts/shortcuts/configuration';
import { ShortcutsPanel } from './ShortcutsPanel';

afterEach(() => vi.unstubAllGlobals());
it('requires confirmation, rejects duplicate choices and offers restoration', async () => {
  const shortcuts = vi.fn().mockResolvedValue({
    version: 1,
    ok: true,
    shortcuts: DEFAULT_SHORTCUTS,
    registered: true,
  });
  vi.stubGlobal('meetingCopilot', { shortcuts });
  render(<ShortcutsPanel />);
  const help = await screen.findByLabelText('Pedir ajuda');
  fireEvent.change(help, { target: { value: DEFAULT_SHORTCUTS.stop } });
  expect(screen.getByRole('alert')).toHaveTextContent('diferentes');
  expect(
    screen.getByRole('button', { name: 'Aplicar atalhos' }),
  ).toBeDisabled();
  fireEvent.change(help, {
    target: { value: 'CommandOrControl+Alt+Shift+F8' },
  });
  fireEvent.click(screen.getByRole('button', { name: 'Aplicar atalhos' }));
  expect(shortcuts).toHaveBeenCalledTimes(1);
  fireEvent.click(screen.getByRole('button', { name: 'Confirmar' }));
  await waitFor(() =>
    expect(shortcuts).toHaveBeenCalledWith({
      ...DEFAULT_SHORTCUTS,
      help: 'CommandOrControl+Alt+Shift+F8',
    }),
  );
  fireEvent.click(screen.getByRole('button', { name: 'Restaurar padrões' }));
  fireEvent.click(screen.getByRole('button', { name: 'Confirmar' }));
  await waitFor(() => expect(shortcuts).toHaveBeenCalledWith('restore'));
});
