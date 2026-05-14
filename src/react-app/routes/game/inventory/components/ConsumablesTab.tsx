import { InkBadge, InkButton, InkList, InkNotice } from '@app/components/ui';
import { ItemCard } from '@app/components/ui/ItemCard';
import { buildManualDrawHref } from '@shared/types/manualDraw';
import type { Consumable } from '@shared/types/cultivator';

interface ConsumablesTabProps {
  consumables: Consumable[];
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
  isLoading = false,
  pendingId,
  onShowDetails,
  onConsume,
  onDiscard,
}: ConsumablesTabProps) {
  if (isLoading) {
    return <InkNotice>正在检索消耗品记录，请稍候……</InkNotice>;
  }

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
        const isTalisman = item.category === 'talisman_key' || item.type === '符箓';
        const isFateReshapeTalisman =
          item.mechanicKey === 'fate_reshape_access' ||
          item.name === '天机逆命符';
        const isGongfaDrawTalisman =
          item.mechanicKey === 'gongfa_draw_access' ||
          item.name === '悟道演法符';
        const isSkillDrawTalisman =
          item.mechanicKey === 'skill_draw_access' ||
          item.name === '神通衍化符';
        const isDirectlyUsable =
          !isTalisman && Boolean(item.id && item.category && item.useSpec);
        const scenarioHref = isFateReshapeTalisman
          ? '/game/fate-reshape'
          : isGongfaDrawTalisman
            ? buildManualDrawHref('gongfa')
            : isSkillDrawTalisman
              ? buildManualDrawHref('skill')
              : undefined;
        const scenarioActionLabel = isFateReshapeTalisman
          ? '前往重塑'
          : isGongfaDrawTalisman
            ? '抽功法秘籍'
            : isSkillDrawTalisman
              ? '抽神通秘籍'
              : null;
        const canNavigateToScenario = Boolean(item.id && scenarioHref);
        const usageHint = isTalisman
          ? isFateReshapeTalisman
            ? '【前往命格重塑功能页启封，开启时立即扣除】'
            : isGongfaDrawTalisman
              ? '【前往问法寻卷，直接消耗符箓抽取功法秘籍】'
              : isSkillDrawTalisman
                ? '【前往问法寻卷，直接消耗符箓抽取神通秘籍】'
                : '【需在对应玩法入口校验并锁定，终局结算后扣除】'
          : isDirectlyUsable
            ? null
            : '【旧制数据，暂未接入新版本使用规则】';

        return (
          <ItemCard
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
              usageHint ? (
                <div className="text-ink-primary text-xs">
                  {usageHint}
                </div>
              ) : null
            }
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
                    ? '服用中…'
                    : canNavigateToScenario
                      ? scenarioActionLabel
                      : isTalisman
                      ? '场外使用'
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
