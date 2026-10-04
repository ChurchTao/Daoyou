import type { DivineFortune } from '@daoyou/game-domain/divination';
import { FALLBACK_FORTUNES } from '@daoyou/game-content/divination';

export function getRandomFallbackFortune(): DivineFortune {
  const index = Math.floor(Math.random() * FALLBACK_FORTUNES.length);
  return FALLBACK_FORTUNES[index];
}
