import { BODY_CULTIVATION_PACK } from '@daoyou/game-content/body-cultivation';


export function bodyCultivationThreshold(level: number, pack = BODY_CULTIVATION_PACK): number {
  return pack.progress.base + pack.progress.perLevel * Math.max(0, Math.floor(level));
}
