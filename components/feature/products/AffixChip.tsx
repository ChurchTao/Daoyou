'use client';

import type { AffixView } from './abilityDisplay';

interface AffixChipProps {
  affix: AffixView;
  compact?: boolean;
}

/**
 * 词缀 chip：统一在法宝 / 神通 / 功法详情/列表里渲染一条 AffixView。
 *
 * 视觉契约：
 *   - 稀有度 → 文字颜色（common/uncommon/rare/legendary）。
 *   - 完美触发 → 名称前冠以「极」字样。
 *   - 整行结构：`[极?] {name}：{bodyText}`，避免散装徽章干扰阅读。
 */
export function AffixChip({ affix, compact = false }: AffixChipProps) {
  const rarityColorStyle =
    affix.rarityTone === 'legendary'
      ? { color: 'var(--color-tier-shen)' }
      : affix.rarityTone === 'rare'
        ? { color: 'var(--color-tier-xian)' }
        : affix.rarityTone === 'info'
          ? { color: 'var(--color-tier-zhen)' }
          : { color: 'var(--color-tier-ling)' };

  const perfectBadge = affix.isPerfect ? (
    <span className="mr-1 inline-flex h-4 min-w-[1rem] items-center justify-center rounded bg-amber-100 px-1 text-[10px] font-bold text-amber-700">
      极
    </span>
  ) : null;

  if (compact) {
    return (
      <span className="inline-flex items-center text-xs leading-snug">
        {perfectBadge}
        <span className="font-medium" style={rarityColorStyle}>
          {affix.name}
        </span>
        <span className="text-ink-secondary">：{affix.bodyText}</span>
      </span>
    );
  }

  return (
    <li className="flex items-start text-sm leading-relaxed">
      {perfectBadge}
      <div className="flex-1">
        <span className="font-medium" style={rarityColorStyle}>
          {affix.name}
        </span>
        <span className="text-ink-secondary">：{affix.bodyText}</span>
      </div>
    </li>
  );
}
