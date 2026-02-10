import { InkPageShell } from '@/components/layout';
import { InkButton } from '@/components/ui/InkButton';
import { InkCard } from '@/components/ui/InkCard';
import { InkList, InkListItem } from '@/components/ui/InkList';
import { DungeonSettlement as DungeonSettlementType } from '@/lib/dungeon/types';

interface DungeonSettlementProps {
  settlement: DungeonSettlementType | undefined;
  onConfirm?: () => void;
}

/**
 * 副本结算组件
 * 展示副本探索的最终结果和奖励
 */
export function DungeonSettlement({
  settlement,
  onConfirm,
}: DungeonSettlementProps) {
  const handleConfirm = () => {
    if (onConfirm) {
      onConfirm();
    } else {
      // 默认行为：跳转首页
      window.location.href = '/';
    }
  };

  return (
    <InkPageShell title="探索结束" backHref="/game">
      <InkCard className="space-y-4 p-4">
        <p className="text-ink/80 leading-relaxed">
          {settlement?.ending_narrative}
        </p>

        <div className="bg-paper-dark rounded p-4 text-center">
          <div className="text-ink-secondary text-base">评价</div>
          <div className="text-crimson my-2 text-4xl">
            {settlement?.settlement?.reward_tier}
          </div>
          <div className="text-ink-secondary text-base">获得机缘</div>
        </div>

        {settlement?.settlement &&
          settlement.settlement.reward_blueprints?.length > 0 && (
            <InkList dense>
              {settlement.settlement.reward_blueprints.map(
                (reward, idx: number) => (
                  <InkListItem
                    key={idx}
                    title={reward.name}
                    description={reward.description}
                  />
                ),
              )}
            </InkList>
          )}

        <InkButton
          onClick={handleConfirm}
          variant="primary"
          className="mt-4 block w-full text-center"
        >
          收入囊中
        </InkButton>
      </InkCard>
    </InkPageShell>
  );
}
