import { app } from 'electron';
import { createMainWindow } from './app/createMainWindow';
import { createPanelController } from './app/createPanelController';
import { installApplicationMenu } from './app/installApplicationMenu';

app.setName('Meeting Copilot');
const showPanel = createPanelController(createMainWindow);

function reportStartupFailure(): void {
  console.error('Não foi possível iniciar o Meeting Copilot.');
  app.exit(1);
}

app
  .whenReady()
  .then(async () => {
    installApplicationMenu(() => {
      showPanel().catch(reportStartupFailure);
    });
    await showPanel();

    app.on('activate', () => {
      showPanel().catch(reportStartupFailure);
    });
  })
  .catch(reportStartupFailure);

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit();
});
