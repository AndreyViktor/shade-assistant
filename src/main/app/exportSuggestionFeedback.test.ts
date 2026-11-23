// @vitest-environment node
import type { BrowserWindow } from 'electron';
import { expect, it, vi } from 'vitest';
import type { SuggestionFeedbackExport } from '../../contracts/meeting/suggestionFeedback';
import { exportSuggestionFeedback } from './exportSuggestionFeedback';

const feedback: SuggestionFeedbackExport = {
  schema: 'meeting-copilot.suggestion-feedback.v1',
  exportedAt: '2026-11-23T12:00:00.000Z',
  metrics: {
    ratedCards: 1,
    counts: { useful: 1, irrelevant: 0, incorrect: 0, repeated: 0 },
  },
};
const window = { isDestroyed: () => false } as BrowserWindow;

it('writes only the provided anonymous aggregate after explicit selection', async () => {
  const showSaveDialog = vi.fn(() =>
    Promise.resolve({ canceled: false, filePath: '/tmp/feedback.json' }),
  );
  const writeFile = vi.fn<
    (path: string, data: string | Buffer) => Promise<void>
  >(() => Promise.resolve());
  await exportSuggestionFeedback(window, feedback, {
    showSaveDialog,
    writeFile,
  });
  expect(showSaveDialog).toHaveBeenCalledOnce();
  expect(writeFile).toHaveBeenCalledExactlyOnceWith(
    '/tmp/feedback.json',
    `${JSON.stringify(feedback, null, 2)}\n`,
  );
  expect(String(writeFile.mock.calls[0]?.[1])).not.toMatch(
    /speech|context|title|body|model|suggestionId|api[_-]?key/i,
  );
});

it('does not write when the user cancels the native dialog', async () => {
  const writeFile = vi.fn<
    (path: string, data: string | Buffer) => Promise<void>
  >(() => Promise.resolve());
  await exportSuggestionFeedback(window, feedback, {
    showSaveDialog: () => Promise.resolve({ canceled: true }),
    writeFile,
  });
  expect(writeFile).not.toHaveBeenCalled();
});
