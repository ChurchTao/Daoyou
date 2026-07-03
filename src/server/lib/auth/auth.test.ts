import { afterEach, describe, expect, it } from 'vitest';

const originalCookieDomain = process.env.BETTER_AUTH_COOKIE_DOMAIN;

afterEach(() => {
  process.env.BETTER_AUTH_COOKIE_DOMAIN = originalCookieDomain;
});

describe('auth config helpers', () => {
  it('builds cross-subdomain cookie config from BETTER_AUTH_COOKIE_DOMAIN', async () => {
    process.env.BETTER_AUTH_COOKIE_DOMAIN = ' .daoyou.org ';
    const { getCookieDomainConfig } = await import('./cookieDomain');

    expect(getCookieDomainConfig()).toEqual({
      enabled: true,
      domain: '.daoyou.org',
    });
  });

  it('omits cross-subdomain cookie config when the env var is empty', async () => {
    process.env.BETTER_AUTH_COOKIE_DOMAIN = ' ';
    const { getCookieDomainConfig } = await import('./cookieDomain');

    expect(getCookieDomainConfig()).toBeUndefined();
  });
});
