export type CrossSubDomainCookiesConfig = {
  enabled: true;
  domain: string;
};

export function getCookieDomainConfig(): CrossSubDomainCookiesConfig | undefined {
  const domain = process.env.BETTER_AUTH_COOKIE_DOMAIN?.trim();

  if (!domain) {
    return undefined;
  }

  return {
    enabled: true,
    domain,
  };
}
