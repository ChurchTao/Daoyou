const TURNSTILE_VERIFY_URL =
  'https://challenges.cloudflare.com/turnstile/v0/siteverify';

function getTurnstileSecret(): string | null {
  return (
    process.env.TURNSTILE_SECRET_KEY ??
    process.env.TURNSTILE_SECRET ??
    null
  );
}

export function isTurnstileServerEnabled(): boolean {
  return Boolean(getTurnstileSecret());
}

export async function verifyTurnstileToken(
  token: string,
  remoteIp?: string,
): Promise<boolean> {
  const secret = getTurnstileSecret();

  if (!secret) {
    return true;
  }

  const formData = new FormData();
  formData.set('secret', secret);
  formData.set('response', token);

  if (remoteIp) {
    formData.set('remoteip', remoteIp);
  }

  const response = await fetch(TURNSTILE_VERIFY_URL, {
    method: 'POST',
    body: formData,
  });

  if (!response.ok) {
    return false;
  }

  const result = (await response.json()) as {
    success?: boolean;
  };

  return result.success === true;
}
