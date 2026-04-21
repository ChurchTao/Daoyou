'use client';

import type { AffixView } from './abilityDisplay';

interface AffixChipProps {
  affix: AffixView;
  compact?: boolean;
}

/**
 * 词缀 chip：统一在法宝 / 神通 / 功法详情/列表里渲染一个 RolledAffix。
 */
export function AffixChip({ affix, compact = false }: AffixChipProps) {
  if (compact) {
    return (
      <span className="border-ink/15 bg-paper text-ink-secondary inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-xs">
        <span className={affix.isPerfect ? 'text-amber-500' : 'text-ink/50'}>
          {affix.isPerfect ? '✦' : '◆'}
        </span>
        <span>{affix.name}</span>
        {affix.isPerfect && <span className="text-amber-500">完美</span>}
      </span>
    );
  }

  return (
    <li className="border-ink/10 flex items-start gap-2 rounded-lg border p-2 text-sm">
      <span
        className={
          affix.isPerfect
            ? 'mt-0.5 text-amber-500'
            : 'text-ink-secondary mt-0.5'
        }
      >
        {affix.isPerfect ? '✦' : '◆'}
      </span>
      <div className="flex-1 space-y-0.5">
        <div className="flex items-center gap-2">
          <span className="text-ink-primary font-medium">{affix.name}</span>
          {affix.isPerfect && (
            <span className="rounded bg-amber-50 px-1.5 py-0.5 text-[10px] text-amber-600">
              完美
            </span>
          )}
        </div>
        {affix.description && (
          <p className="text-ink-secondary text-xs leading-relaxed">
            {affix.description}
          </p>
        )}
        <p className="text-ink/50 text-[10px]">
          {affix.category} · 效率 {(affix.rollEfficiency * 100).toFixed(0)}% ·
          倍率 {affix.finalMultiplier.toFixed(2)}
        </p>
      </div>
    </li>
  );
}
