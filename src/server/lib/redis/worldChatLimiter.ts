import { REALM_ORDER, type RealmType } from '@shared/types/constants';
import { redis } from './index';

const MAX_CHAT_COOLDOWN_SECONDS = 60;
const MIN_CHAT_COOLDOWN_SECONDS = 15;

function getCooldownKey(cultivatorId: string): string {
  return `world_chat:cooldown:${cultivatorId}`;
}

export function getWorldChatCooldownSeconds(realm: RealmType | string): number {
  const highestRealmOrder = Math.max(...Object.values(REALM_ORDER));
  const currentRealmOrder =
    realm in REALM_ORDER ? REALM_ORDER[realm as RealmType] : 0;
  const cooldownRange = MAX_CHAT_COOLDOWN_SECONDS - MIN_CHAT_COOLDOWN_SECONDS;
  const reduction = (cooldownRange * currentRealmOrder) / highestRealmOrder;

  return Math.max(
    MIN_CHAT_COOLDOWN_SECONDS,
    Math.round(MAX_CHAT_COOLDOWN_SECONDS - reduction),
  );
}

export async function checkAndAcquireCooldown(
  cultivatorId: string,
  realm: RealmType | string,
): Promise<{
  allowed: boolean;
  remainingSeconds: number;
}> {
  const cooldownSeconds = getWorldChatCooldownSeconds(realm);
  const key = getCooldownKey(cultivatorId);
  const result = await redis.set(key, '1', 'EX', cooldownSeconds, 'NX');

  if (result === 'OK') {
    return {
      allowed: true,
      remainingSeconds: 0,
    };
  }

  const ttl = await redis.ttl(key);
  const remainingSeconds =
    typeof ttl === 'number' && ttl > 0 ? ttl : cooldownSeconds;

  return {
    allowed: false,
    remainingSeconds,
  };
}
