import {
  PillKeywordLine,
  toPillDisplayModel,
} from '@app/components/feature/consumables';
import { InkBadge, InkButton, InkList, InkNotice } from '@app/components/ui';
import { ItemCard } from '@app/components/ui/ItemCard';
import {
  isPillConsumable,
  isTalismanConsumable,
} from '@shared/lib/consumables';
import type { CultivatorCondition } from '@shared/types/condition';
import type { RealmType } from '@shared/types/constants';
import type { Consumable } from '@shared/types/cultivator';
import {
  getConsumableTypeLabel,
  getResourceTypeLabel,
} from '@shared/lib/gameConceptDisplay';
import {
  getTalismanActionHref,
  getTalismanActionLabel,
  getTalismanUsageHint,
  isQiRestoreTalisman,
} from './talismanDisplay';

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
          isPillConsumable(item) || isQiRestoreTalisman(item);
        const scenarioHref = getTalismanActionHref(item);
        const scenarioActionLabel = getTalismanActionLabel(item);
        const canNavigateToScenario = Boolean(item.id && scenarioHref);
        const pillDisplay = isPillConsumable(item)
          ? toPillDisplayModel(item, { realm, condition })
          : null;
        const usageHint = isTalisman
          ? getTalismanUsageHint(item)
          : '【仅可在场外服用，药力会直接回写当前状态】';

        return (
          <ItemCard
            key={item.id || idx}
            layout="col"
            name={item.name}
            quality={item.quality}
            badgeExtra={
              <>
                <InkBadge tone="default">
                  {getConsumableTypeLabel(isTalisman ? '符箓' : '丹药')}
                </InkBadge>
                <span className="text-ink-secondary text-sm">
                  x{item.quantity}
                </span>
              </>
            }
            meta={
              isDirectlyUsable && pillDisplay ? (
                <PillKeywordLine labels={pillDisplay.keywordLabels} />
              ) : usageHint ? (
                <div className="text-ink-primary text-xs">{usageHint}</div>
              ) : null
            }
            description={
              isDirectlyUsable && pillDisplay
                ? pillDisplay.effectSummary
                : item.description
            }
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
