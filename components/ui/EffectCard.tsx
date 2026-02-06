'use client';

import type { EffectConfig } from '@/engine/effect';
import { cn } from '@/lib/cn';
import { formatAllEffects } from '@/lib/utils/effectDisplay';
import type { Quality, SkillGrade } from '@/types/constants';
import type { ReactNode } from 'react';
import { InkBadge } from './InkBadge';
import { InkListItem } from './InkList';

// ============================================================
// 类型定义
// ============================================================

export interface EffectCardProps {
  // 基本信息
  icon?: string; // 图标（如 📜、🔥）
  name: string; // 名字
  quality?: Quality | SkillGrade; // 品质
  badgeExtra?: ReactNode; // 额外的 badge（如元素、境界需求）

  // 效果和描述
  effects?: EffectConfig[]; // 效果列表
  description?: string; // 描述文本
  meta?: ReactNode; // 额外的元信息（如冷却、消耗）

  // 可选操作
  actions?: ReactNode;

  // 状态
  highlight?: boolean;
  newMark?: boolean;
  layout?: 'row' | 'col'; // 布局方式：row=横向（内容与操作并排），col=纵向（内容与操作堆叠）
}

// ============================================================
// 组件
// ============================================================

/**
 * 统一展示具有效果列表的项目（命格、功法、神通等）
 *
 * 展示格式：
 * - 第一行：icon + 名字 + 品质
 * - meta：效果列表
 * - description：描述文本
 */
export function EffectCard({
  icon,
  name,
  quality,
  badgeExtra,
  effects,
  description,
  meta,
  actions,
  highlight = false,
  newMark = false,
  layout = 'row',
}: EffectCardProps) {
  // 渲染效果列表
  const effectsList =
    effects && effects.length > 0 ? formatAllEffects(effects) : [];

  const renderEffects = () => {
    if (effectsList.length === 0) return null;
    return (
      <ul className="list-inside list-disc space-y-1">
        {effectsList.map((e, i) => (
          <li key={i}>
            {e.isPerfect && (
              <span
                className={cn(
                  'mr-1 inline-flex h-4 w-4 items-center justify-center rounded-xs border text-xs',
                  'border-tier-shen/70 bg-tier-shen/10 text-tier-shen',
                )}
              >
                极
              </span>
            )}
            <span
              className={cn(
                'rounded-xs px-1 py-px',
                e.isPerfect && 'bg-tier-shen/10',
              )}
            >
              {e.icon} {e.description}
            </span>
          </li>
        ))}
      </ul>
    );
  };

  return (
    <InkListItem
      title={
        <div className="flex flex-wrap items-center gap-1">
          {icon && <span>{icon}</span>}
          <span className="text-ink-secondary">{name}</span>
          {quality && <InkBadge tier={quality} />}
          {badgeExtra}
        </div>
      }
      meta={renderEffects()}
      description={
        <>
          {meta && <div className="mb-1">{meta}</div>}
          {description && (
            <div className="text-ink-secondary text-sm opacity-80">
              {description}
            </div>
          )}
        </>
      }
      actions={actions}
      highlight={highlight}
      newMark={newMark}
      layout={layout}
    />
  );
}
