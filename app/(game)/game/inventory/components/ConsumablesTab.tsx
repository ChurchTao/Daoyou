'use client';

import { InkBadge, InkButton, InkList, InkNotice } from '@/components/ui';
import { EffectCard } from '@/components/ui/EffectCard';
import type { Consumable } from '@/types/cultivator';

interface ConsumablesTabProps {
  consumables: Consumable[];
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
  pendingId,
  onShowDetails,
  onConsume,
  onDiscard,
}: ConsumablesTabProps) {
  if (!consumables || consumables.length === 0) {
    return <InkNotice>暂无消耗品。</InkNotice>;
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
        const isTalisman = item.type === '符箓';

        return (
          <EffectCard
            key={item.id || idx}
            layout="col"
            name={item.name}
            quality={item.quality}
            badgeExtra={
              <>
                <InkBadge tone="default">
                  {isTalisman ? '符箓' : '丹药'}
                </InkBadge>
                <span className="text-ink-secondary text-sm">
                  x{item.quantity}
                </span>
              </>
            }
            meta={
              isTalisman ? (
                <div className="text-ink-primary text-xs">
                  【使用后获得特殊增益】
                </div>
              ) : null
            }
            effects={item.effects}
            description={item.description}
            actions={
              <div className="flex gap-2">
                <InkButton
                  variant="secondary"
                  onClick={() => onShowDetails(item)}
                >
                  详情
                </InkButton>
                <InkButton
                  disabled={!item.id || pendingId === item.id}
                  onClick={() => onConsume(item)}
                  variant="primary"
                >
                  {pendingId === item.id
                    ? isTalisman
                      ? '祭炼中…'
                      : '服用中…'
                    : isTalisman
                      ? '祭炼'
                      : '服用'}
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
