import { dialog } from 'electron';
import type { BrowserWindow, SaveDialogOptions } from 'electron';
import type { SuggestionFeedbackExport } from '../../contracts/meeting/suggestionFeedback';
import { writePrivateFile } from '../../infrastructure/settings/privateFile';

type ExportDependencies = {
  showSaveDialog: (
    window: BrowserWindow,
    options: SaveDialogOptions,
  ) => Promise<{ canceled: boolean; filePath?: string }>;
  writeFile: (path: string, data: string | Buffer) => Promise<void>;
};

const defaultDependencies: ExportDependencies = {
  showSaveDialog: (window, options) => dialog.showSaveDialog(window, options),
  writeFile: writePrivateFile,
};

export async function exportSuggestionFeedback(
  window: BrowserWindow,
  feedback: SuggestionFeedbackExport,
  dependencies: ExportDependencies = defaultDependencies,
): Promise<void> {
  const selection = await dependencies.showSaveDialog(window, {
    title: 'Exportar métricas de sugestões',
    defaultPath: 'meeting-copilot-feedback.json',
    message:
      'O arquivo contém somente contagens anônimas, sem fala, contexto ou conteúdo dos cartões.',
    filters: [{ name: 'JSON', extensions: ['json'] }],
  });
  if (selection.canceled || !selection.filePath || window.isDestroyed()) return;
  await dependencies.writeFile(
    selection.filePath,
    `${JSON.stringify(feedback, null, 2)}\n`,
  );
}
