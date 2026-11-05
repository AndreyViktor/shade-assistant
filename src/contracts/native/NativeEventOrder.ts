import { NativeProtocolError, parseNativeCommand } from './protocol';
import type {
  AudioSource,
  TranscriptionConfig,
  TranscriptionEvent,
} from './protocol';

type Channel = {
  seq: number;
  timestampMs: number;
  state: 'initial' | 'ready' | 'listening' | 'paused' | 'error' | 'stopped';
  supportsPartial: boolean;
};

/** Transport order only. Segment revision/echo reconciliation belongs to T018. */
export class NativeEventOrder {
  private readonly config: TranscriptionConfig;
  private readonly channels = new Map<AudioSource, Channel>();

  constructor(config: TranscriptionConfig) {
    const command = parseNativeCommand({
      ...config,
      version: 1,
      type: 'start',
    });
    if (command.type !== 'start')
      throw new NativeProtocolError('invalid-message');
    this.config = command;
    for (const source of command.sources)
      this.channels.set(source, {
        seq: 0,
        timestampMs: 0,
        state: 'initial',
        supportsPartial: false,
      });
  }

  accept(event: TranscriptionEvent): void {
    const channel = this.channels.get(event.source);
    if (
      !channel ||
      event.sessionId !== this.config.sessionId ||
      event.locale !== this.config.locale ||
      event.seq !== channel.seq + 1 ||
      event.timestampMs < channel.timestampMs ||
      channel.state === 'stopped'
    )
      throw new NativeProtocolError('invalid-order');
    let state: Channel['state'] = channel.state;
    switch (event.type) {
      case 'ready':
        if (state !== 'initial') this.invalid();
        state = 'ready';
        break;
      case 'status':
        if (
          event.state === 'listening'
            ? state !== 'ready' && state !== 'paused'
            : state !== 'listening'
        )
          this.invalid();
        state = event.state;
        break;
      case 'partial':
      case 'final':
        if (
          state !== 'listening' ||
          (event.type === 'partial' && !channel.supportsPartial)
        )
          this.invalid();
        break;
      case 'error':
        if (state === 'error') this.invalid();
        state = 'error';
        break;
      case 'stopped':
        if (
          (state === 'initial' && event.reason !== 'cancelled') ||
          (state === 'error') !== (event.reason === 'error')
        )
          this.invalid();
        state = 'stopped';
    }
    this.channels.set(event.source, {
      seq: event.seq,
      timestampMs: event.timestampMs,
      state,
      supportsPartial:
        event.type === 'ready'
          ? event.supportsPartial
          : channel.supportsPartial,
    });
  }

  finish(): void {
    if (
      [...this.channels.values()].some((channel) => channel.state !== 'stopped')
    )
      throw new NativeProtocolError('incomplete-stream');
  }

  private invalid(): never {
    throw new NativeProtocolError('invalid-order');
  }
}
