import {
  InkButton,
  InkCard,
  InkList,
  InkListItem,
} from '@/components/InkComponents';
import { InkPageShell } from '@/components/InkLayout';
import { DungeonSettlement as DungeonSettlementType } from '@/lib/dungeon/types';

interface DungeonSettlementProps {
  settlement: DungeonSettlementType | undefined;
}

/**
 * 副本结算组件
 * 展示副本探索的最终结果和奖励
 */
export function DungeonSettlement({ settlement }: DungeonSettlementProps) {
  return (
    <InkPageShell title="探索结束" backHref="/">
      <InkCard className="p-4 space-y-4">
        <p className="text-ink/80 leading-relaxed">
          {settlement?.ending_narrative}
        </p>

        <div className="bg-paper-dark p-4 rounded text-center">
          <div className="text-base text-ink-secondary">评价</div>
          <div className="text-4xl text-crimson my-2">
            {settlement?.settlement?.reward_tier}
          </div>
          <div className="text-base text-ink-secondary">获得机缘</div>
        </div>

        {settlement?.settlement &&
          settlement.settlement.potential_items?.length > 0 && (
            <InkList dense>
              {settlement.settlement.potential_items.map(
                (item: string, idx: number) => (
                  <InkListItem key={idx} title={item} />
                ),
              )}
            </InkList>
          )}

        <InkButton
          href="/"
          variant="primary"
          className="w-full text-center block mt-4"
        >
          返回
        </InkButton>
      </InkCard>
    </InkPageShell>
  );
}
