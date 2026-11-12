import { parseEnv } from 'node:util';
import { readBoundedFile } from '../../infrastructure/settings/privateFile';
import { isValidSecret } from '../../infrastructure/settings/SecretStore';

// Main-only. Never populate process.env: child processes must not inherit the file.
export async function readDevelopmentApiKey(
  path: string,
  exportedKey: string | undefined,
): Promise<string | null> {
  if (isValidSecret(exportedKey)) return exportedKey;
  try {
    const content = (await readBoundedFile(path, 16384)).toString('utf8');
    const key = parseEnv(content).OPENAI_API_KEY;
    return isValidSecret(key) ? key : null;
  } catch {
    // Missing/unreadable/invalid development configuration leaves local STT usable.
    // Do not log parser or filesystem errors: they may contain private data.
    return null;
  }
}
