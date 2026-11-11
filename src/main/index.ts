import { cleanupSessions } from './app/sessionCleanup';
import { app } from 'electron';
import { createMainWindow } from './app/createMainWindow';
import { createPanelController } from './app/createPanelController';
import { installApplicationMenu } from './app/installApplicationMenu';

app.setName('Meeting Copilot');
let quitting = false;
let cleanedUp = false;
app.on('before-quit', (event) => {
  if (cleanedUp) return;
  event.preventDefault();
  if (quitting) return;
  quitting = true;
  void cleanupSessions().finally(() => {
    cleanedUp = true;
    app.quit();
  });
});
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
