import { formatFullGameNumber } from '@daoyou/game-rules/presentation/numbers';
import { tierColorMap } from './inkBadgeTiers';

export function formatCompactSpiritStones(amount: number): string {
  if (amount < 10_000) return formatFullGameNumber(amount);
  return `${(Math.floor(amount / 100) / 100).toFixed(2)}万`;
}

export function getSpiritStoneColor(amount: number): string {
  if (amount >= 10_000_000) return tierColorMap['神品'];
  if (amount >= 1_000_000) return tierColorMap['仙品'];
  if (amount >= 100_000) return tierColorMap['地品'];
  return 'text-ink';
}
