import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { SettingsDisclosure } from './SettingsDisclosure';

vi.mock('./SettingsPanel', () => ({
  SettingsPanel: () => (
    <label>
      Exemplo
      <input defaultValue="rascunho" />
    </label>
  ),
}));

describe('panel preferences disclosure', () => {
  it('starts collapsed, exposes its relationship, and preserves drafts when closed', () => {
    render(<SettingsDisclosure />);
    const toggle = screen.getByRole('button', { name: 'Preferências' });
    expect(toggle).toHaveAttribute('aria-expanded', 'false');
    expect(toggle).toHaveAttribute('aria-controls', 'panel-settings');
    expect(screen.queryByRole('textbox')).not.toBeInTheDocument();
    fireEvent.click(toggle);
    expect(toggle).toHaveAttribute('aria-expanded', 'true');
    const input = screen.getByRole('textbox', { name: 'Exemplo' });
    fireEvent.change(input, { target: { value: 'alterado' } });
    input.focus();
    fireEvent.keyDown(input, { key: 'Escape' });
    expect(toggle).toHaveFocus();
    expect(toggle).toHaveAttribute('aria-expanded', 'false');
    fireEvent.click(toggle);
    expect(screen.getByRole('textbox')).toHaveValue('alterado');
    fireEvent.click(screen.getByRole('button', { name: 'Voltar ao painel' }));
    expect(toggle).toHaveFocus();
    expect(toggle).toHaveAttribute('aria-expanded', 'false');
  });
});
