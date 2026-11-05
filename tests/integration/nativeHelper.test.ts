// @vitest-environment node
import { spawn, spawnSync } from 'node:child_process';
import { setTimeout as delay } from 'node:timers/promises';
import { describe, expect, it } from 'vitest';
import { NativeJsonlDecoder } from '../../src/contracts/native/NativeJsonlDecoder';
import { encodeNativeCommand } from '../../src/contracts/native/protocol';
import type { TranscriptionConfig } from '../../src/contracts/native/protocol';

// Opt-in native gate: run after the Swift build via npm run test:helper.
// No test sends a standalone start: cancellation is decoded in the same batch.
const executable = process.env['MEETING_COPILOT_HELPER'];
const config: TranscriptionConfig = {
  sessionId: 'process-test',
  sources: ['mic', 'system'],
  locale: 'pt-BR',
};
const start = Buffer.from(
  encodeNativeCommand({ version: 1, type: 'start', ...config }),
).toString('utf8');
const stop = Buffer.from(
  encodeNativeCommand({
    version: 1,
    type: 'stop',
    sessionId: config.sessionId,
  }),
).toString('utf8');

function path(): string {
  if (!executable) throw new Error('Run npm run test:helper on macOS');
  return executable;
}

function run(input: string | Buffer, args: string[] = []) {
  const result = spawnSync(path(), args, {
    input,
    shell: false,
    timeout: 4000,
    maxBuffer: 64 * 1024,
  });
  expect(result.error).toBeUndefined();
  expect(result.signal).toBeNull();
  expect(result.stderr.toString()).toBe('');
  return result;
}

function decode(bytes: Buffer) {
  const decoder = new NativeJsonlDecoder(config);
  // Validate real Swift frames through the production TS codec, including byte splits.
  const events = [...bytes].flatMap((byte) =>
    decoder.push(Uint8Array.of(byte)),
  );
  decoder.finish();
  return events;
}

describe.skipIf(!executable)('real Swift helper process (no capture)', () => {
  it('exits on clean stdin EOF without starting a session', () => {
    const result = run('');
    expect(result.status).toBe(0);
    expect(result.stdout.length).toBe(0);
  });

  it('rejects command-line capture and test flags', () => {
    const result = run('', ['--capture']);
    expect(result.status).toBe(64);
    expect(result.stdout.length).toBe(0);
  });

  it.each([
    '{}\n',
    '\n',
    '{"version":99,"type":"stop","sessionId":"private-input"}\n',
    '{"private":"DO_NOT_LOG"}',
    'x'.repeat(16_385),
    Buffer.from([0xff, 10]),
    stop,
  ])(
    'rejects invalid input without reflecting it in diagnostics (%#)',
    (input) => {
      const result = run(input);
      expect(result.status).toBe(2);
      expect(result.stdout.length).toBe(0);
    },
  );

  it('cancels both sources before startup and emits terminal v1 frames', () => {
    const result = run(start + stop);
    expect(result.status).toBe(0);
    const events = decode(result.stdout);
    expect(events).toHaveLength(2);
    expect(events.map((event) => event.source)).toEqual(['mic', 'system']);
    for (const event of events)
      expect(event).toMatchObject({
        type: 'stopped',
        reason: 'cancelled',
        seq: 1,
      });
  });

  it.each([
    start + start + stop,
    start + stop.replace('process-test', 'wrong-session'),
  ])('rejects duplicate starts and cross-session stop (%#)', (input) => {
    const result = run(input);
    expect(result.status).toBe(2);
    const events = decode(result.stdout);
    for (const source of config.sources) {
      expect(events.filter((event) => event.source === source)).toMatchObject([
        { type: 'error', code: 'invalid-command', seq: 1 },
        { type: 'stopped', reason: 'error', seq: 2 },
      ]);
    }
  });

  it('handles split JSONL input and stop while stdin stays open', async () => {
    const child = spawn(path(), [], { shell: false, stdio: 'pipe' });
    const output: Buffer[] = [];
    const errors: Buffer[] = [];
    child.stdout.on('data', (data: Buffer) => output.push(data));
    child.stderr.on('data', (data: Buffer) => errors.push(data));
    const done = new Promise<number | null>((resolve, reject) => {
      child.once('error', reject);
      child.once('close', resolve);
    });
    const timeout = setTimeout(() => child.kill('SIGKILL'), 4000);
    try {
      child.stdin.write(start.slice(0, 20));
      await delay(20);
      child.stdin.write(start.slice(20) + stop);
      expect(await done).toBe(0);
      expect(decode(Buffer.concat(output))).toHaveLength(2);
      expect(Buffer.concat(errors).length).toBe(0);
    } finally {
      clearTimeout(timeout);
      child.kill('SIGKILL');
    }
  });

  it('exits with failure when the stdout consumer disconnects', async () => {
    const child = spawn(path(), [], { shell: false, stdio: 'pipe' });
    const done = new Promise<{ code: number | null; signal: string | null }>(
      (resolve, reject) => {
        child.once('error', reject);
        child.once('exit', (code, signal) => resolve({ code, signal }));
      },
    );
    const timeout = setTimeout(() => child.kill('SIGKILL'), 4000);
    try {
      child.stdout.destroy();
      child.stdin.write(start + stop);
      expect(await done).toEqual({ code: 2, signal: null });
    } finally {
      clearTimeout(timeout);
      child.kill('SIGKILL');
    }
  });

  it.each(['SIGTERM', 'SIGINT'] as const)(
    'releases an idle process on %s',
    async (signal) => {
      const child = spawn(path(), [], { shell: false, stdio: 'pipe' });
      const done = new Promise<{ code: number | null; signal: string | null }>(
        (resolve, reject) => {
          child.once('error', reject);
          child.once('exit', (code, signal) => resolve({ code, signal }));
        },
      );
      const timeout = setTimeout(() => child.kill('SIGKILL'), 4000);
      try {
        await delay(500);
        child.kill(signal);
        expect(await done).toEqual({ code: 0, signal: null });
      } finally {
        clearTimeout(timeout);
        child.kill('SIGKILL');
      }
    },
  );
});
