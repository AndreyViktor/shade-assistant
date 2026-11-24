import { render, screen, within } from '@testing-library/react';
import { expect, it, vi } from 'vitest';
import { emptyDemo } from '../../../contracts/meeting/demo';
import { NATIVE_ERROR_CODES } from '../../../contracts/native/protocol';
import { SUGGESTION_FAILURES } from '../../../contracts/meeting/suggestionDiagnostics';
import type { SuggestionAttempt } from '../../../contracts/meeting/suggestionDiagnostics';
import type { LocalTranscriptSnapshot } from '../../../contracts/meeting/localTranscript';
import { SessionControls } from './SessionControls';
import type { useMeetingSession } from './useMeetingSession';
import { LocalTranscriptPreview } from './LocalTranscriptPreview';
import { TranscriptionDiagnostics } from './TranscriptionDiagnostics';
import { emptySuggestionFeedback } from '../../../contracts/meeting/suggestionFeedback';
import { suggestionFailureMessages } from '../suggestions/SuggestionDiagnosticsPanel';

const transcript: LocalTranscriptSnapshot = {
  failed: false,
  config: { sessionId: 'synthetic', sources: ['mic'], locale: 'pt-BR' },
  channels: [],
  segments: [],
};

it.each([...NATIVE_ERROR_CODES, 'connection', 'stopped'] as const)(
  'keeps %s transcription failures accessible with details separate from the panel',
  (code) => {
    const failed: LocalTranscriptSnapshot = {
      ...transcript,
      failed: code === 'connection',
      channels:
        code === 'connection'
          ? []
          : [
              {
                version: 1,
                sessionId: 'synthetic',
                source: 'mic',
                locale: 'pt-BR',
                seq: 1,
                timestampMs: 0,
                ...(code === 'stopped'
                  ? { type: 'stopped', reason: 'error' }
                  : { type: 'error', code }),
              },
            ],
    };
    const view = render(<LocalTranscriptPreview transcript={failed} />);
    const pane = screen.getByRole('region', { name: 'Transcrição ao vivo' });
    expect(pane).toHaveClass('area-failed');
    expect(within(pane).getByRole('alert')).toHaveTextContent(
      'Falha na transcrição. Consulte Preferências.',
    );
    expect(within(pane).getByText('⚠')).toHaveAttribute('aria-hidden', 'true');
    view.rerender(<TranscriptionDiagnostics transcript={failed} error="" />);
    expect(
      screen.getByRole('region', { name: 'Estado da transcrição' }),
    ).not.toHaveTextContent('Consulte Preferências');
    expect(
      screen.getByRole('region', { name: 'Estado da transcrição' }),
    ).toHaveTextContent(/interrompida|Microfone/);
    view.rerender(<LocalTranscriptPreview transcript={transcript} />);
    expect(screen.queryByRole('alert')).not.toBeInTheDocument();
    expect(screen.getByRole('region')).not.toHaveClass('area-failed');
  },
);

it.each<SuggestionAttempt['result']>([
  ...SUGGESTION_FAILURES,
  'pending',
  'success',
  'empty',
])(
  'distinguishes suggestion outcome %s from the request limit and transcription',
  (result) => {
    const command = vi.fn();
    const meeting: ReturnType<typeof useMeetingSession> = {
      session: {
        mode: 'apple-local',
        phase: 'running',
        consent: { capture: true, context: true, remoteAudio: false },
      },
      local: transcript,
      demo: emptyDemo(),
      busy: false,
      error: '',
      preferences: null,
      command,
      results: { items: [] },
      suggestions: {
        status: 'exhausted',
        items: [],
        remainingRequests: 0,
        diagnostics: {
          model: 'synthetic',
          maxRequests: 1,
          activity: 'waiting-trigger',
          lastTrigger: 'question',
          lastAttempt: {
            number: 1,
            startedAt: 0,
            durationMs: 1,
            requestBody: null,
            httpStatus: null,
            result,
            suggestionCount: null,
          },
        },
        feedback: emptySuggestionFeedback(),
      },
    };
    const view = render(<SessionControls meeting={meeting} />);
    const assistance = screen.getByRole('region', {
      name: 'Assistência da reunião',
    });
    const failure = !['pending', 'success', 'empty', 'cancelled'].includes(
      result,
    );
    if (failure) {
      expect(assistance).toHaveClass('area-failed');
      expect(within(assistance).getByRole('alert')).toHaveTextContent(
        `Falha nas sugestões. ${suggestionFailureMessages[result as keyof typeof suggestionFailureMessages]}`,
      );
      expect(within(assistance).getByRole('alert')).toHaveTextContent(
        'Novas tentativas suspensas.',
      );
      expect(within(assistance).getByText('⚠')).toHaveAttribute(
        'aria-hidden',
        'true',
      );
    } else {
      expect(assistance).not.toHaveClass('area-failed');
      expect(within(assistance).queryByRole('alert')).not.toBeInTheDocument();
    }
    expect(
      screen.getByRole('region', { name: 'Transcrição ao vivo' }),
    ).not.toHaveClass('area-failed');
    expect(screen.getByText(/Limite atingido/)).toBeVisible();
    expect(
      screen.queryByRole('region', { name: 'Estado da OpenAI' }),
    ).not.toBeInTheDocument();
    expect(command).not.toHaveBeenCalled();
    view.rerender(
      <SessionControls
        meeting={{
          ...meeting,
          suggestions: {
            ...meeting.suggestions,
            status: 'disabled',
            diagnostics: null,
          },
          results: { items: [] },
        }}
      />,
    );
    expect(screen.queryByRole('alert')).not.toBeInTheDocument();
    expect(assistance).not.toHaveClass('area-failed');
  },
);
