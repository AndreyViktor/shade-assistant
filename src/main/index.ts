import { app, BrowserWindow } from 'electron';
import { createMainWindow } from './app/createMainWindow';

app.setName('Meeting Copilot');

function reportStartupFailure(): void {
  console.error('Não foi possível iniciar o Meeting Copilot.');
  app.exit(1);
}

app
  .whenReady()
  .then(async () => {
    await createMainWindow();

    app.on('activate', () => {
      if (BrowserWindow.getAllWindows().length === 0) {
        createMainWindow().catch(reportStartupFailure);
      }
    });
  })
  .catch(reportStartupFailure);

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit();
});
