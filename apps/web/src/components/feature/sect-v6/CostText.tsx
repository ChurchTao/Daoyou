import type { SectV6Cost } from '@daoyou/game-domain/sects/commands';
import { SpiritStones } from '@app/components/ui/SpiritStones';
export function CostText({ cost }: { cost: SectV6Cost }) {
  return (
    <p>
      {cost.cultivationExp.toLocaleString()} 修为 ·{' '}
      <SpiritStones amount={cost.spiritStones} />
      {cost.comprehensionInsight ? ` · ${cost.comprehensionInsight} 感悟` : ''}
    </p>
  );
}
