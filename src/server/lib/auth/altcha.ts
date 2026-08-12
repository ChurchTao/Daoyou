import { redis } from '@server/lib/redis';
import {
  createChallenge,
  randomInt,
  verifySolution,
  type Payload,
} from 'altcha-lib';
import { deriveKey } from 'altcha-lib/algorithms/pbkdf2';
import { deriveHmacKeySecret } from 'altcha-lib/frameworks/hono';

export const ALTCHA_ACTIONS = [
  'sign-in',
  'sign-up',
  'password-reset',
  'email-otp',
] as const;

export type AltchaAction = (typeof ALTCHA_ACTIONS)[number];
export type AltchaVerificationResult =
  | 'verified'
  | 'invalid'
  | 'unavailable';

const ALTCHA_CHALLENGE_TTL_MS = 5 * 60 * 1_000;
const ALTCHA_PBKDF2_COST = 5_000;
const ALTCHA_COUNTER_MIN = 5_000;
const ALTCHA_COUNTER_MAX = 10_000;
const ALTCHA_MAX_PAYLOAD_LENGTH = 64 * 1_024;
const ALTCHA_REPLAY_KEY_PREFIX = 'captcha:altcha:used:v1:';

let derivedSecretSource: string | null = null;
let derivedSecretPromise: Promise<string> | null = null;

function getAltchaSecret(): string | null {
  return process.env.ALTCHA_HMAC_SECRET?.trim() || null;
}

async function getAltchaKeySignatureSecret(secret: string): Promise<string> {
  if (derivedSecretSource !== secret || !derivedSecretPromise) {
    derivedSecretSource = secret;
    derivedSecretPromise = deriveHmacKeySecret(secret);
  }

  return derivedSecretPromise;
}

function parsePayload(payload: string): Payload | null {
  if (!payload || payload.length > ALTCHA_MAX_PAYLOAD_LENGTH) {
    return null;
  }

  try {
    const parsed = JSON.parse(
      Buffer.from(payload, 'base64').toString('utf8'),
    ) as Payload;

    if (
      !parsed ||
      typeof parsed !== 'object' ||
      !parsed.challenge ||
      !parsed.solution
    ) {
      return null;
    }

    return parsed;
  } catch {
    return null;
  }
}

export function isAltchaAction(value: string): value is AltchaAction {
  return ALTCHA_ACTIONS.some((action) => action === value);
}

export function isAltchaServerEnabled(): boolean {
  return Boolean(getAltchaSecret());
}

export async function createAltchaChallenge(action: AltchaAction) {
  const secret = getAltchaSecret();
  if (!secret) {
    throw new Error('ALTCHA_HMAC_SECRET is required');
  }

  return createChallenge({
    algorithm: 'PBKDF2/SHA-256',
    cost: ALTCHA_PBKDF2_COST,
    counter: randomInt(ALTCHA_COUNTER_MAX, ALTCHA_COUNTER_MIN),
    data: { action },
    deriveKey,
    expiresAt: new Date(Date.now() + ALTCHA_CHALLENGE_TTL_MS),
    hmacSignatureSecret: secret,
    hmacKeySignatureSecret: await getAltchaKeySignatureSecret(secret),
  });
}

export async function verifyAltchaPayload(
  payloadValue: string,
  expectedAction: AltchaAction,
): Promise<AltchaVerificationResult> {
  const secret = getAltchaSecret();
  if (!secret) {
    return 'unavailable';
  }

  const payload = parsePayload(payloadValue);
  if (!payload) {
    return 'invalid';
  }

  const { challenge, solution } = payload;
  const { parameters } = challenge;
  if (
    parameters.data?.action !== expectedAction ||
    typeof parameters.expiresAt !== 'number' ||
    typeof parameters.nonce !== 'string'
  ) {
    return 'invalid';
  }

  try {
    const verification = await verifySolution({
      challenge,
      deriveKey,
      hmacSignatureSecret: secret,
      hmacKeySignatureSecret: await getAltchaKeySignatureSecret(secret),
      solution,
    });

    if (!verification.verified) {
      return 'invalid';
    }

    const ttlSeconds = Math.floor(parameters.expiresAt - Date.now() / 1_000);
    if (ttlSeconds <= 0) {
      return 'invalid';
    }

    const consumed = await redis.set(
      `${ALTCHA_REPLAY_KEY_PREFIX}${parameters.nonce}`,
      '1',
      'EX',
      ttlSeconds,
      'NX',
    );

    return consumed === 'OK' ? 'verified' : 'invalid';
  } catch (error) {
    console.error('[altcha] verification unavailable', error);
    return 'unavailable';
  }
}
