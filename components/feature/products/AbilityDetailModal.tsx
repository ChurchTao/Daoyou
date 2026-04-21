'use client';

import { InkBadge, InkButton } from '@/components/ui';
import { AffixChip } from './AffixChip';
import { AttributeModifierList } from './AttributeModifierList';
import type { ProductDisplayModel } from './abilityDisplay';

const SLOT_LABELS: Record<string, string> = {
  weapon: '武器',
  armor: '防具',
  accessory: '饰品',
};

interface AbilityDetailModalProps {
  isOpen: boolean;
  onClose: () => void;
  product: ProductDisplayModel | null;
  actions?: React.ReactNode;
}

/**
 * 通用产物详情弹窗：神通 / 功法 / 法宝 均使用此组件。
 *
 * 与旧 EffectDetailModal 的区别：
 * - 基于 battle-v5 原生 AbilityConfig / AttributeModifierConfig 渲染，不再经 effects 适配
 * - 词缀 / 属性修正 / 招式参数 各司其职展示
 */
export function AbilityDetailModal({
  isOpen,
  onClose,
  product,
  actions,
}: AbilityDetailModalProps) {
  if (!isOpen || !product) return null;

  const projection = product.projection;
  const mpCostText =
    projection?.mpCost !== undefined ? `灵力消耗 ${projection.mpCost}` : null;
  const cooldownText =
    projection?.cooldown !== undefined ? `冷却 ${projection.cooldown}回合` : null;

  return (
    <div
      className="bg-paper/80 fixed inset-0 z-50 flex items-end justify-center p-0 backdrop-blur-sm sm:items-center sm:p-4"
      onClick={onClose}
    >
      <div
        className="border-ink/20 bg-paper w-full max-w-lg space-y-4 rounded-t-2xl border p-6 shadow-xl sm:rounded-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-start justify-between gap-3">
          <div className="space-y-0.5">
            <h2 className="text-ink-primary text-xl font-bold">
              {product.name}
            </h2>
            {product.originalName && product.originalName !== product.name && (
              <p className="text-ink/50 text-xs">原名：{product.originalName}</p>
            )}
          </div>
          {product.isEquipped && (
            <span className="rounded bg-green-100 px-2 py-0.5 text-xs text-green-700">
              已装备
            </span>
          )}
        </div>

        <div className="flex flex-wrap gap-1.5">
          {projection && (
            <InkBadge tone="default">{projection.kindLabel}</InkBadge>
          )}
          {product.quality && (
            <InkBadge tier={product.quality as never}>
              {product.quality}
            </InkBadge>
          )}
          {product.slot && (
            <InkBadge tone="default">
              {SLOT_LABELS[product.slot] ?? product.slot}
            </InkBadge>
          )}
          {product.element && (
            <InkBadge tone="default">{product.element}</InkBadge>
          )}
          <InkBadge tone="default">{`评分 ${product.score}`}</InkBadge>
        </div>

        {product.description && (
          <p className="text-ink-secondary text-sm leading-relaxed">
            {product.description}
          </p>
        )}

        {projection && projection.projectionKind === 'active_skill' && (
          <div className="text-ink-secondary flex flex-wrap gap-x-3 gap-y-1 text-xs">
            {mpCostText && <span>{mpCostText}</span>}
            {cooldownText && <span>{cooldownText}</span>}
            {projection.priority !== undefined && (
              <span>优先级 {projection.priority}</span>
            )}
          </div>
        )}

        <AttributeModifierList modifiers={product.modifiers} />

        {product.affixes.length > 0 && (
          <div className="space-y-1.5">
            <h3 className="text-ink-secondary text-xs font-semibold tracking-wide uppercase">
              词缀
            </h3>
            <ul className="space-y-1.5">
              {product.affixes.map((a) => (
                <AffixChip key={a.id} affix={a} />
              ))}
            </ul>
          </div>
        )}

        {projection && projection.tags.length > 0 && (
          <div className="flex flex-wrap gap-1">
            {projection.tags.map((t) => (
              <span
                key={t}
                className="border-ink/10 text-ink-secondary rounded-full border px-2 py-0.5 text-[10px]"
              >
                {t}
              </span>
            ))}
          </div>
        )}

        <div className="flex gap-2 pt-2">
          {actions}
          <InkButton onClick={onClose} className="flex-1">
            关闭
          </InkButton>
        </div>
      </div>
    </div>
  );
}
