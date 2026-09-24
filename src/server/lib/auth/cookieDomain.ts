export type CrossSubDomainCookiesConfig = {
  enabled: true;
  domain: string;
};

export function getCookieDomainConfig():
  CrossSubDomainCookiesConfig | undefined {
  const domain = process.env.BETTER_AUTH_COOKIE_DOMAIN?.trim();

  if (!domain) {
    return undefined;
  }

  return {
    enabled: true,
    domain,
  };
}

export function getCrossSiteCookieConfig() {
  if (process.env.BETTER_AUTH_CROSS_SITE_COOKIES !== 'true') {
    return undefined;
  }

  if (new URL(process.env.BETTER_AUTH_URL ?? '').protocol !== 'https:') {
    throw new Error(
      'BETTER_AUTH_CROSS_SITE_COOKIES requires an HTTPS BETTER_AUTH_URL',
    );
  }
  if (getCookieDomainConfig()) {
    throw new Error(
      'Unset BETTER_AUTH_COOKIE_DOMAIN when enabling cross-site cookies',
    );
  }

  return { sameSite: 'none' as const, secure: true, httpOnly: true };
}
