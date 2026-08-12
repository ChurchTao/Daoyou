import { REALM_ORDER, type RealmType } from '@shared/types/constants';
import { acquireRedisCooldown } from './cooldownLimiter';

const MAX_CHAT_COOLDOWN_SECONDS = 60;
const MIN_CHAT_COOLDOWN_SECONDS = 15;

function getCooldownKey(cultivatorId: string): string {
  return `world_chat:cooldown:${cultivatorId}`;
}

function getSectCooldownKey(cultivatorId: string): string {
  return `sect_chat:limiter:${cultivatorId}`;
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

async function checkAndAcquireCooldownForKey(
  key: string,
  realm: RealmType | string,
): Promise<{
  allowed: boolean;
  remainingSeconds: number;
}> {
  const cooldownSeconds = getWorldChatCooldownSeconds(realm);
  return acquireRedisCooldown({ key, cooldownSeconds });
}

export function checkAndAcquireCooldown(
  cultivatorId: string,
  realm: RealmType | string,
): Promise<{ allowed: boolean; remainingSeconds: number }> {
  return checkAndAcquireCooldownForKey(getCooldownKey(cultivatorId), realm);
}

export function checkAndAcquireSectChatCooldown(
  cultivatorId: string,
  realm: RealmType | string,
): Promise<{ allowed: boolean; remainingSeconds: number }> {
  return checkAndAcquireCooldownForKey(
    getSectCooldownKey(cultivatorId),
    realm,
  );
}
