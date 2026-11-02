import { describe, expect, it } from 'vitest';
import { getDevelopmentUrl } from './getDevelopmentUrl';

describe('getDevelopmentUrl', () => {
  it('uses local files in a packaged app even if an environment URL is present', () => {
    expect(getDevelopmentUrl(true, 'https://example.com')).toBeUndefined();
    expect(getDevelopmentUrl(false, undefined)).toBeUndefined();
  });

  it('allows the configured loopback development server', () => {
    expect(getDevelopmentUrl(false, 'http://127.0.0.1:5173')).toBe(
      'http://127.0.0.1:5173/',
    );
  });

  it.each([
    'https://example.com',
    'http://127.0.0.1:5173.example.com',
    'http://127.0.0.1:5174',
    'file:///tmp/index.html',
    'http://user:password@127.0.0.1:5173',
    'http://127.0.0.1:5173/other',
    'http://127.0.0.1:5173/?redirect=remote',
    'invalid',
  ])('rejects unexpected development input: %s', (value) => {
    expect(() => getDevelopmentUrl(false, value)).toThrow();
  });
});
