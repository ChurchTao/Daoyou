import { cn } from '@app/lib/cn';
import { formatFullGameNumber } from '@daoyou/game-rules/presentation/numbers';
import { GameIcon } from './GameIcon';
import {
  formatCompactSpiritStones,
  getSpiritStoneColor,
} from './spiritStoneFormat';

export function SpiritStones({
  amount,
  mode = 'exact',
  className,
}: {
  amount: number;
  mode?: 'compact' | 'exact';
  className?: string;
}) {
  const fullAmount = formatFullGameNumber(amount);
  return (
    <span
      className={cn(
        'inline-flex items-center gap-1 whitespace-nowrap',
        className,
      )}
      title={mode === 'compact' ? `💰 ${fullAmount}` : undefined}
    >
      {mode === 'exact' && <GameIcon value="💰" />}
      {mode === 'compact' && <span className="sr-only">{fullAmount} 灵石</span>}
      <span
        aria-hidden={mode === 'compact' ? true : undefined}
        className={cn('font-mono tabular-nums', getSpiritStoneColor(amount))}
      >
        {mode === 'compact' ? formatCompactSpiritStones(amount) : fullAmount}
      </span>
    </span>
  );
}
