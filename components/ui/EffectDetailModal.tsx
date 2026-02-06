'use client';

import { InkModal } from '@/components/layout';
import { InkButton } from '@/components/ui/InkButton';
import type { EffectConfig } from '@/engine/effect/types';
import { formatAllEffects } from '@/lib/utils/effectDisplay';
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

        {/* Details */}
        <div className="space-y-2 text-sm">
          {/* Extra Info */}
          {extraInfo}

          {/* Effects List */}
          {effectsList.length > 0 && (
            <div className="pt-2">
              <span className="text-ink mb-1 block font-bold opacity-70">
                {effectTitle}
              </span>
              <ul className="list-inside list-disc space-y-1">
                {effectsList.map((effect, i) => (
                  <li key={i}>
                    {effect.icon} {effect.description}
                    {effect.isPerfect && (
                      <span className="border-tier-tian/30 text-tier-tian/80 ml-1 inline-flex items-center rounded-sm border px-1 text-[0.7rem]">
                        闪光
                      </span>
                    )}
                  </li>
                ))}
              </ul>
            </div>
          )}

          {/* Description */}
          {description && (
            <div className="pt-2">
              <span className="mb-1 block opacity-70">{descriptionTitle}</span>
              <p className="bg-ink/5 border-ink/10 rounded-lg border p-2 indent-4 leading-relaxed opacity-90">
                {description}
              </p>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="flex justify-end pt-4">
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
