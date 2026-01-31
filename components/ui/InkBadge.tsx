'use client';

import { cn } from '@/lib/cn';
import {
  Quality,
  RealmType,
  SkillGrade,
  SpiritualRootGrade,
} from '@/types/constants';

/**
 * 品阶类型：品质、灵根等级、技能等级、境界
 */
export type Tier = Quality | SpiritualRootGrade | SkillGrade | RealmType;

/**
 * 品阶到 Tailwind 颜色类的映射
 */
export const tierColorMap: Record<Tier, string> = {
  // 品质
  凡品: 'text-tier-fan',
  灵品: 'text-tier-ling',
  玄品: 'text-tier-xuan',
  真品: 'text-tier-zhen',
  地品: 'text-tier-di',
  天品: 'text-tier-tian',
  仙品: 'text-tier-xian',
  神品: 'text-tier-shen',
  // 灵根等级
  天灵根: 'text-tier-tian',
  真灵根: 'text-tier-zhen',
  伪灵根: 'text-tier-fan',
  变异灵根: 'text-tier-shen',
  // 技能等级
  天阶上品: 'text-tier-shen',
  天阶中品: 'text-tier-xian',
  天阶下品: 'text-tier-xian',
  地阶上品: 'text-tier-di',
  地阶中品: 'text-tier-di',
  地阶下品: 'text-tier-di',
  玄阶上品: 'text-tier-xuan',
  玄阶中品: 'text-tier-xuan',
  玄阶下品: 'text-tier-xuan',
  黄阶上品: 'text-tier-ling',
  黄阶中品: 'text-tier-ling',
  黄阶下品: 'text-tier-ling',
  // 境界
  炼气: 'text-tier-fan',
  筑基: 'text-tier-ling',
  金丹: 'text-tier-xuan',
  元婴: 'text-tier-zhen',
  化神: 'text-tier-shen',
  炼虚: 'text-tier-di',
  合体: 'text-tier-tian',
  大乘: 'text-tier-xian',
  渡劫: 'text-tier-shen',
};

/**
 * 色调类型映射
 */
const toneColorMap = {
  default: 'text-ink-secondary',
  accent: 'text-crimson',
  warning: 'text-amber-600',
  danger: 'text-red-800',
};

export interface InkBadgeProps {
  children?: string;
  tier?: Tier;
  tierText?: string;
  tone?: 'default' | 'accent' | 'warning' | 'danger';
  compact?: boolean;
  className?: string;
  hideTierText?: boolean;
}

/**
 * 品阶徽记组件
 * 根据品阶显示对应颜色的「品阶」标记
 */
export function InkBadge({
  children,
  tier,
  tierText,
  tone = 'default',
  compact = false,
  className = '',
  hideTierText = false,
}: InkBadgeProps) {
  // 优先使用品阶颜色，否则使用色调颜色
  const colorClass = tier ? tierColorMap[tier] : toneColorMap[tone];

  const combinedClass = cn(
    'inline-flex items-center leading-[1.4] px-1 mr-1',
    compact ? 'text-[0.75rem]' : 'text-[0.85rem]',
    colorClass,
    className,
  );

  // 构建显示内容
  const displayContent = hideTierText
    ? children
    : tier
      ? `「${tierText || tier}」${children || ''}`
      : children || '';

  return <span className={combinedClass}>{displayContent}</span>;
}
