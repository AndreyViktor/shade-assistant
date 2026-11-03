import { rm } from 'node:fs/promises';
import {
  failStorage,
  isMissingFile,
  readBoundedFile,
  writePrivateFile,
} from './privateFile';

export interface SecretEncryption {
  isAsyncEncryptionAvailable(): Promise<boolean>;
  encryptStringAsync(value: string): Promise<Buffer>;
  decryptStringAsync(
    value: Buffer,
  ): Promise<{ result: string; shouldReEncrypt: boolean }>;
}

export function isValidSecret(value: unknown): value is string {
  return (
    typeof value === 'string' &&
    value.length > 0 &&
    value.length <= 4096 &&
    !/\s/.test(value)
  );
}

// Main-only: neither plaintext nor encrypted bytes belong in a public DTO.
export class SecretStore {
  constructor(
    private readonly path: string,
    private readonly encryption: SecretEncryption,
    private readonly platform: string,
  ) {}

  async has(): Promise<boolean> {
    try {
      await readBoundedFile(this.path, 16384);
      return true;
    } catch (error) {
      if (isMissingFile(error)) return false;
      return failStorage('SECRET_UNAVAILABLE');
    }
  }

  private async requireEncryption(): Promise<void> {
    // No fallback cipher or unsupported OS backend in the Mac MVP.
    if (
      this.platform !== 'darwin' ||
      !(await this.encryption.isAsyncEncryptionAvailable())
    ) {
      return failStorage('SECRET_UNAVAILABLE');
    }
  }

  async set(value: string): Promise<void> {
    try {
      if (!isValidSecret(value)) throw new Error('INVALID_SECRET');
      await this.requireEncryption();
      await writePrivateFile(
        this.path,
        await this.encryption.encryptStringAsync(value),
      );
    } catch {
      return failStorage('SECRET_UNAVAILABLE');
    }
  }

  async get(): Promise<string | null> {
    try {
      let encrypted: Buffer;
      try {
        encrypted = await readBoundedFile(this.path, 16384);
      } catch (error) {
        if (isMissingFile(error)) return null;
        throw error;
      }
      await this.requireEncryption();
      const decrypted = await this.encryption.decryptStringAsync(encrypted);
      if (!isValidSecret(decrypted.result)) throw new Error('INVALID_SECRET');
      if (decrypted.shouldReEncrypt) await this.set(decrypted.result);
      return decrypted.result;
    } catch {
      return failStorage('SECRET_UNAVAILABLE');
    }
  }

  async remove(): Promise<void> {
    try {
      await rm(this.path, { force: true });
    } catch {
      return failStorage('SECRET_UNAVAILABLE');
    }
  }
}
