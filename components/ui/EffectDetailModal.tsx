'use client';

import { InkModal } from '@/components/layout';
import { InkButton } from '@/components/ui/InkButton';
import { formatAllEffects } from '@/lib/utils/effectDisplay';
import type { EffectConfig } from '@/engine/effect/types';
import { ReactNode } from 'react';

export interface EffectDetailModalProps {
  isOpen: boolean;
  onClose: () => void;

  // 基本信息
  icon: string; // 大图标（如 📜、🔥）
  name: string; // 名字
  badges?: ReactNode[]; // badges（包括品质、类型、元素等）

  // 内容区域
  extraInfo?: ReactNode; // 额外信息（如威力、冷却、数量等）
  effects?: EffectConfig[]; // 效果列表
  description?: string; // 描述文本

  // 可选配置
  effectTitle?: string; // 效果区域标题，默认 "效果"
  descriptionTitle?: string; // 描述区域标题，默认 "说明"

  // Footer
  footer?: ReactNode; // 自定义 footer，默认显示关闭按钮
}

/**
 * 通用详情弹窗组件
 * 用于展示命格、功法、神通、丹药、装备等物品的详细信息
 */
export function EffectDetailModal({
  isOpen,
  onClose,
  icon,
  name,
  badges = [],
  extraInfo,
  effects,
  description,
  effectTitle = '效果',
  descriptionTitle = '说明',
  footer,
}: EffectDetailModalProps) {
  const effectsList = effects ? formatAllEffects(effects) : [];

  return (
    <InkModal isOpen={isOpen} onClose={onClose}>
      <div className="space-y-2">
        {/* Header */}
        <div className="flex flex-col items-center p-4 bg-muted/20 rounded-lg">
          <div className="text-4xl mb-2">{icon}</div>
          <h4 className="text-lg font-bold">{name}</h4>
          {badges.length > 0 && (
            <div className="flex gap-2 mt-2 flex-wrap justify-center">
              {badges.map((badge, index) => (
                <div key={index}>{badge}</div>
              ))}
            </div>
          )}
        </div>

        {/* Details */}
        <div className="space-y-2 text-sm">
          {/* Extra Info */}
          {extraInfo}

          {/* Effects List */}
          {effectsList.length > 0 && (
            <div className="pt-2">
              <span className="block opacity-70 mb-1 font-bold text-ink">
                {effectTitle}
              </span>
              <ul className="list-disc list-inside space-y-1">
                {effectsList.map((effect, i) => (
                  <li key={i}>
                    {effect.icon} {effect.description}
                  </li>
                ))}
              </ul>
            </div>
          )}

          {/* Description */}
          {description && (
            <div className="pt-2">
              <span className="block opacity-70 mb-1">{descriptionTitle}</span>
              <p className="indent-4 leading-relaxed opacity-90 p-2 bg-ink/5 rounded-lg border border-ink/10">
                {description}
              </p>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="pt-4 flex justify-end">
          {footer || (
            <InkButton onClick={onClose} className="w-full">
              关闭
            </InkButton>
          )}
        </div>
      </div>
    </InkModal>
  );
}
