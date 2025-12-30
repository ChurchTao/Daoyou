'use client';

import {
  InkBadge,
  InkButton,
  InkList,
  InkListItem,
  InkNotice,
} from '@/components/ui';
import type { Consumable } from '@/types/cultivator';

interface ConsumablesTabProps {
  consumables: Consumable[];
  pendingId: string | null;
  onShowDetails: (item: Consumable) => void;
  onConsume: (item: Consumable) => void;
  onDiscard: (item: Consumable) => void;
}

/**
 * 丹药 Tab 组件
 */
export function ConsumablesTab({
  consumables,
  pendingId,
  onShowDetails,
  onConsume,
  onDiscard,
}: ConsumablesTabProps) {
  if (!consumables || consumables.length === 0) {
    return <InkNotice>暂无丹药储备。</InkNotice>;
  }

  return (
    <InkList>
      {consumables.map((item, idx) => {
        // 解析药效用于展示
        const effectDescriptions = item.effect
          ? item.effect
              .map((e) => {
                const bonus = e.bonus ? `+${e.bonus}` : '';
                return `${e.effect_type}${bonus}`;
              })
              .join('，')
          : '未知效果';

        return (
          <InkListItem
            key={item.id || idx}
            layout="col"
            title={
              <>
                {item.name}
                {item.quality && (
                  <InkBadge tier={item.quality} className="ml-2">
                    {item.type}
                  </InkBadge>
                )}
                <span className="ml-2 text-sm text-ink-secondary">
                  x{item.quantity}
                </span>
              </>
            }
            description={effectDescriptions}
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
                  {pendingId === item.id ? '服用中…' : '服用'}
                </InkButton>
                <InkButton variant="primary" onClick={() => onDiscard(item)}>
                  丢弃
                </InkButton>
              </div>
            }
          />
        );
      })}
    </InkList>
  );
}
