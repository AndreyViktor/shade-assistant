import {
  MAX_JSONL_BYTES,
  NativeProtocolError,
  parseTranscriptionEvent,
} from './protocol';
import type { TranscriptionConfig, TranscriptionEvent } from './protocol';
import { NativeEventOrder } from './NativeEventOrder';

/** Bounded UTF-8 framing; any failure permanently closes this session decoder. */
export class NativeJsonlDecoder {
  private readonly line = new Uint8Array(MAX_JSONL_BYTES);
  private length = 0;
  private closed = false;
  private readonly order: NativeEventOrder;

  constructor(config: TranscriptionConfig) {
    this.order = new NativeEventOrder(config);
  }

  push(chunk: Uint8Array): TranscriptionEvent[] {
    if (this.closed) throw new NativeProtocolError('closed-stream');
    try {
      const events: TranscriptionEvent[] = [];
      for (const byte of chunk) {
        if (byte === 10) {
          const event = this.decodeLine();
          this.order.accept(event);
          events.push(event);
          this.clearLine();
        } else {
          if (this.length === MAX_JSONL_BYTES)
            throw new NativeProtocolError('line-too-large');
          this.line[this.length++] = byte;
        }
      }
      return events;
    } catch (error) {
      this.close();
      throw error;
    }
  }

  finish(): void {
    if (this.closed) throw new NativeProtocolError('closed-stream');
    try {
      if (this.length !== 0) throw new NativeProtocolError('truncated-line');
      this.order.finish();
    } finally {
      this.close();
    }
  }

  private decodeLine(): TranscriptionEvent {
    let json: string;
    try {
      // Preserve BOM so JSON.parse rejects it; only UTF-8 JSON is accepted.
      json = new TextDecoder('utf-8', { fatal: true, ignoreBOM: true }).decode(
        this.line.subarray(0, this.length),
      );
    } catch {
      throw new NativeProtocolError('invalid-utf8');
    }
    let value: unknown;
    try {
      value = JSON.parse(json);
    } catch {
      throw new NativeProtocolError('invalid-json');
    }
    return parseTranscriptionEvent(value);
  }

  private clearLine(): void {
    this.line.fill(0, 0, this.length);
    this.length = 0;
  }
  private close(): void {
    this.closed = true;
    this.clearLine();
  }
}
