import { ConsumableListCard } from '@app/components/feature/consumables';
import { GameLoadingState } from '@app/components/game-shell/GameLoadingState';
import { InkButton, InkList, InkNotice } from '@app/components/ui';
import { getResourceTypeLabel } from '@shared/lib/gameConceptDisplay';
import type { CultivatorCondition } from '@shared/types/condition';
import type { RealmType } from '@shared/types/constants';
import type { Consumable } from '@shared/types/cultivator';

interface ConsumablesTabProps {
  consumables: Consumable[];
  realm?: RealmType;
  condition?: CultivatorCondition;
  isLoading?: boolean;
  pendingId: string | null;
  onShowDetails: (item: Consumable) => void;
  onConsume: (item: Consumable) => void;
  onDiscard: (item: Consumable) => void;
}

/**
 * 消耗品 Tab 组件
 */
export function ConsumablesTab({
  consumables,
  realm,
  condition,
  isLoading = false,
  onShowDetails,
  onDiscard,
}: ConsumablesTabProps) {
  if (isLoading) {
    return (
      <GameLoadingState
        message={`正在检索${getResourceTypeLabel('consumable')}记录，请稍候……`}
        variant="inline"
      />
    );
  }

  if (!consumables || consumables.length === 0) {
    return <InkNotice>暂无{getResourceTypeLabel('consumable')}。</InkNotice>;
  }

  // 按类型排序：符箓在前，丹药在后
  const sortedItems = [...consumables].sort((a, b) => {
    if (a.type === '符箓' && b.type !== '符箓') return -1;
    if (a.type !== '符箓' && b.type === '符箓') return 1;
    return 0;
  });

  return (
    <InkList>
      {sortedItems.map((item, idx) => {
        return (
          <ConsumableListCard
            key={item.id || idx}
            consumable={item}
            realm={realm}
            condition={condition}
            showUsageHint={false}
            actions={
              <div className="flex gap-2">
                <InkButton
                  variant="secondary"
                  onClick={() => onShowDetails(item)}
                >
                  详情
                </InkButton>
                <span className="text-ink-secondary self-center text-xs">
                  从洞府宝库取出后使用
                </span>
                <InkButton variant="primary" onClick={() => onDiscard(item)}>
                  销毁
                </InkButton>
              </div>
            }
          />
        );
      })}
    </InkList>
  );
}
