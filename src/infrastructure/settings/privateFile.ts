import { randomUUID } from 'node:crypto';
import { mkdir, open, rename, rm } from 'node:fs/promises';
import { dirname } from 'node:path';

export async function readBoundedFile(
  path: string,
  limit: number,
): Promise<Buffer> {
  const file = await open(path, 'r');
  try {
    if (!(await file.stat()).isFile()) throw new Error('INVALID_FILE');
    const buffer = Buffer.alloc(limit + 1);
    let size = 0;
    while (size < buffer.length) {
      const { bytesRead } = await file.read(
        buffer,
        size,
        buffer.length - size,
        null,
      );
      if (bytesRead === 0) break;
      size += bytesRead;
    }
    if (size > limit) throw new Error('INVALID_FILE');
    return buffer.subarray(0, size);
  } finally {
    await file.close();
  }
}

export async function writePrivateFile(
  path: string,
  data: string | Buffer,
): Promise<void> {
  await mkdir(dirname(path), { recursive: true, mode: 0o700 });
  const temporary = `${path}.${randomUUID()}.tmp`;
  try {
    const file = await open(temporary, 'wx', 0o600);
    try {
      await file.writeFile(data);
      await file.sync();
    } finally {
      await file.close();
    }
    await rename(temporary, path);
  } finally {
    await rm(temporary, { force: true });
  }
}

export function isMissingFile(error: unknown): boolean {
  return (
    typeof error === 'object' &&
    error !== null &&
    'code' in error &&
    error.code === 'ENOENT'
  );
}

// Storage errors can carry a secret, ciphertext or private path in their cause.
// Deliberately replace the entire error at this boundary, including its cause.
export function failStorage(
  code: 'PREFERENCES_UNAVAILABLE' | 'SECRET_UNAVAILABLE',
): never {
  throw new Error(code);
}
