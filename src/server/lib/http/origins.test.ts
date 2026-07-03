import { afterEach, describe, expect, it } from 'vitest';
import {
  getPublicWebOrigins,
  isAllowedPublicWebOrigin,
  resolveCorsOrigin,
} from './origins';

const originalOrigins = process.env.PUBLIC_WEB_ORIGINS;

afterEach(() => {
  process.env.PUBLIC_WEB_ORIGINS = originalOrigins;
});

describe('public web origins', () => {
  it('parses comma-separated origins', () => {
    process.env.PUBLIC_WEB_ORIGINS =
      'https://app.example.com/, http://localhost:5173 ';

    expect(getPublicWebOrigins()).toEqual([
      'https://app.example.com',
      'http://localhost:5173',
    ]);
  });

  it('drops origins with paths', () => {
    process.env.PUBLIC_WEB_ORIGINS =
      'https://app.example.com/game, https://ok.example.com';

    expect(getPublicWebOrigins()).toEqual(['https://ok.example.com']);
  });

  it('allows missing origin for non-browser probes', () => {
    process.env.PUBLIC_WEB_ORIGINS = 'https://app.example.com';

    expect(isAllowedPublicWebOrigin(undefined)).toBe(true);
  });

  it('resolves allowed CORS origins and rejects unknown origins', () => {
    process.env.PUBLIC_WEB_ORIGINS = 'https://app.example.com';

    expect(resolveCorsOrigin('https://app.example.com')).toBe(
      'https://app.example.com',
    );
    expect(resolveCorsOrigin('https://evil.example.com')).toBe('');
  });
});
