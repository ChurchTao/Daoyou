import {
  Quality,
  RealmType,
  SkillGrade,
  SpiritualRootGrade,
} from '@daoyou/shared/types/constants';
import type { DungeonDifficultyTier } from '@daoyou/shared/lib/game/mapSystem';

/**
 * 品阶类型：品质、灵根等级、技能等级、境界
 */
export type Tier = Quality | SpiritualRootGrade | SkillGrade | RealmType;

/**
 * 品阶到 Tailwind 颜色类的映射
 */
export const tierColorMap: Record<Tier, string> = {
  凡品: 'text-tier-fan',
  灵品: 'text-tier-ling',
  玄品: 'text-tier-xuan',
  真品: 'text-tier-zhen',
  地品: 'text-tier-di',
  天品: 'text-tier-tian',
  仙品: 'text-tier-xian',
  神品: 'text-tier-shen',
  天灵根: 'text-tier-tian',
  真灵根: 'text-tier-zhen',
  伪灵根: 'text-tier-fan',
  变异灵根: 'text-tier-shen',
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

export const dungeonDifficultyColorMap: Record<DungeonDifficultyTier, string> =
  {
    easy: 'text-tier-fan',
    normal: 'text-tier-ling',
    hard: 'text-tier-xuan',
    elite: 'text-tier-zhen',
    boss: 'text-tier-shen',
  };
