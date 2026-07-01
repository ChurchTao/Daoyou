import {
  ConsumableListCard,
  getTalismanActionHref,
  getTalismanActionLabel,
  isAttributeResetTalisman,
  isQiRestoreTalisman,
} from '@app/components/feature/consumables';
import { InkButton, InkList, InkNotice } from '@app/components/ui';
import { isPillConsumable, isTalismanConsumable } from '@shared/lib/consumables';
import type { CultivatorCondition } from '@shared/types/condition';
import type { RealmType } from '@shared/types/constants';
import type { Consumable } from '@shared/types/cultivator';
import { getResourceTypeLabel } from '@shared/lib/gameConceptDisplay';

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
  pendingId,
  onShowDetails,
  onConsume,
  onDiscard,
}: ConsumablesTabProps) {
  if (isLoading) {
    return (
      <InkNotice>
        正在检索{getResourceTypeLabel('consumable')}记录，请稍候……
      </InkNotice>
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
        const isTalisman = isTalismanConsumable(item);
        const isDirectlyUsable =
          isPillConsumable(item) ||
          isQiRestoreTalisman(item) ||
          isAttributeResetTalisman(item);
        const scenarioHref = getTalismanActionHref(item);
        const scenarioActionLabel = getTalismanActionLabel(item);
        const canNavigateToScenario = Boolean(item.id && scenarioHref);

        return (
          <ConsumableListCard
            key={item.id || idx}
            consumable={item}
            realm={realm}
            condition={condition}
            actions={
              <div className="flex gap-2">
                <InkButton
                  variant="secondary"
                  onClick={() => onShowDetails(item)}
                >
                  详情
                </InkButton>
                <InkButton
                  disabled={
                    !item.id ||
                    pendingId === item.id ||
                    (!isDirectlyUsable && !canNavigateToScenario)
                  }
                  onClick={
                    canNavigateToScenario ? undefined : () => onConsume(item)
                  }
                  href={canNavigateToScenario ? scenarioHref : undefined}
                  variant="primary"
                >
                  {pendingId === item.id
                    ? '使用中…'
                    : canNavigateToScenario
                      ? scenarioActionLabel
                      : isTalisman
                        ? isDirectlyUsable
                          ? '使用'
                          : '需前往玩法'
                        : isDirectlyUsable
                          ? '服用'
                          : '暂未开放'}
                </InkButton>
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
