import type { MeetingCopilotApi } from '../contracts/ipc/appStatus';

declare global {
  interface Window {
    meetingCopilot: MeetingCopilotApi;
  }
}
