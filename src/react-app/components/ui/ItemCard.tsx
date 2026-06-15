/**
 * 通用物品卡片
 *
 * 替代已下线的 EffectCard；不再承载任何旧 EffectConfig 信息，
 * 只做标题 / 徽标 / 描述 / 元信息 / 操作按钮的排版。
 */

import type { Quality } from '@shared/types/constants';
import type { ReactNode } from 'react';
import { InkBadge } from './InkBadge';
import { InkListItem } from './InkList';

export interface ItemCardProps {
  icon?: string;
  name: string;
  nameMark?: ReactNode;
  quality?: Quality;
  badgeExtra?: ReactNode;
  description?: string;
  meta?: ReactNode;
  actions?: ReactNode;
  highlight?: boolean;
  newMark?: boolean;
  layout?: 'row' | 'col';
}

export function ItemCard({
  icon,
  name,
  nameMark,
  quality,
  badgeExtra,
  description,
  meta,
  actions,
  highlight = false,
  newMark = false,
  layout = 'row',
}: ItemCardProps) {
  return (
    <InkListItem
      title={
        <div className="flex flex-wrap items-center gap-1">
          {icon && <span className="shrink-0">{icon}</span>}
          <span
            className={`text-ink-secondary relative inline-flex max-w-full items-baseline ${
              nameMark ? 'pr-7' : ''
            }`}
          >
            <span className="truncate">{name}</span>
            {nameMark && (
              <span className="absolute -top-2 right-0">{nameMark}</span>
            )}
          </span>
          {quality && <InkBadge tier={quality} />}
          {badgeExtra}
        </div>
      }
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
