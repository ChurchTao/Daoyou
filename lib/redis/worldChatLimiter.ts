import { redis } from './index';

const CHAT_COOLDOWN_SECONDS = 60;

function getCooldownKey(cultivatorId: string): string {
  return `world_chat:cooldown:${cultivatorId}`;
}

export async function checkAndAcquireCooldown(cultivatorId: string): Promise<{
  allowed: boolean;
  remainingSeconds: number;
}> {
  const key = getCooldownKey(cultivatorId);
  const result = await redis.set(key, '1', {
    nx: true,
    ex: CHAT_COOLDOWN_SECONDS,
  });

  if (result === 'OK') {
    return {
      allowed: true,
      remainingSeconds: 0,
    };
  }

  const ttl = await redis.ttl(key);
  const remainingSeconds =
    typeof ttl === 'number' && ttl > 0 ? ttl : CHAT_COOLDOWN_SECONDS;

  return {
    allowed: false,
    remainingSeconds,
  };
}
