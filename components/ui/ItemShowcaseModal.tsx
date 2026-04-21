'use client';

/**
 * 通用物品展示弹窗
 *
 * 替代已下线的 EffectDetailModal；用于材料/消耗品等非 CreationProduct 的物品详情。
 * 能力（skill/artifact/gongfa）的详情请使用 AbilityDetailModal。
 */

import { InkModal } from '@/components/layout';
import type { ReactNode } from 'react';

export interface ItemShowcaseModalProps {
  isOpen: boolean;
  onClose: () => void;
  icon: string;
  name: string;
  badges?: ReactNode[];
  extraInfo?: ReactNode;
  description?: string;
  descriptionTitle?: string;
  footer?: ReactNode;
}

export function ItemShowcaseModal({
  isOpen,
  onClose,
  icon,
  name,
  badges = [],
  extraInfo,
  description,
  descriptionTitle = '说明',
  footer,
}: ItemShowcaseModalProps) {
  return (
    <InkModal isOpen={isOpen} onClose={onClose}>
      <div className="space-y-2">
        <div className="bg-muted/20 flex flex-col items-center rounded-lg p-4">
          <div className="mb-2 text-4xl">{icon}</div>
          <h4 className="text-lg font-bold">{name}</h4>
          {badges.length > 0 && (
            <div className="mt-2 flex flex-wrap justify-center gap-2">
              {badges.map((badge, index) => (
                <div key={index}>{badge}</div>
              ))}
            </div>
          )}
        </div>

        <div className="space-y-2 text-sm">
          {extraInfo}

          {description && (
            <div className="pt-2">
              <span className="text-ink mb-1 block font-bold opacity-70">
                {descriptionTitle}
              </span>
              <p className="text-ink-secondary">{description}</p>
            </div>
          )}
        </div>

        {footer}
      </div>
    </InkModal>
  );
}
