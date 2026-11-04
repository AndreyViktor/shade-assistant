import { Menu } from 'electron';
import type { MenuItemConstructorOptions } from 'electron';

export function installApplicationMenu(showPanel: () => void): void {
  const template: MenuItemConstructorOptions[] = [];
  if (process.platform === 'darwin') template.push({ role: 'appMenu' });
  template.push(
    { role: 'editMenu', label: 'Editar' },
    {
      label: 'Exibir',
      submenu: [
        { role: 'resetZoom', label: 'Tamanho original' },
        { role: 'zoomIn', label: 'Aumentar texto' },
        { role: 'zoomOut', label: 'Diminuir texto' },
      ],
    },
    {
      role: 'windowMenu',
      label: 'Janela',
      submenu: [
        {
          id: 'minimize',
          label: 'Minimizar painel',
          accelerator: 'CommandOrControl+M',
          click: (_item, window) => window?.minimize(),
        },
        {
          id: 'show-panel',
          label: 'Mostrar painel',
          accelerator: 'CommandOrControl+Shift+M',
          click: showPanel,
        },
        { type: 'separator' },
        { role: 'close', label: 'Fechar janela' },
      ],
    },
  );
  if (process.platform !== 'darwin')
    template.push({ role: 'quit', label: 'Sair' });
  Menu.setApplicationMenu(Menu.buildFromTemplate(template));
}
