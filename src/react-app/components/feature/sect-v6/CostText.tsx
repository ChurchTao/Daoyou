import type { SectV6Cost } from '@shared/contracts/combatV6Sect';
export function CostText({ cost }: { cost: SectV6Cost }) {
  return (
    <p>
      {cost.cultivationExp.toLocaleString()} 修为 ·{' '}
      {cost.spiritStones.toLocaleString()} 灵石
      {cost.comprehensionInsight ? ` · ${cost.comprehensionInsight} 感悟` : ''}
    </p>
  );
}
