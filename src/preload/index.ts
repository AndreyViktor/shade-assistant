import { contextBridge, ipcRenderer } from 'electron';
import { createMeetingCopilotApi } from './createMeetingCopilotApi';

contextBridge.exposeInMainWorld(
  'meetingCopilot',
  createMeetingCopilotApi((channel, request): Promise<unknown> =>
    ipcRenderer.invoke(channel, request),
  ),
);
