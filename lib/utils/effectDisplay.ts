import { buffRegistry } from '@/engine/buff';
import type { Artifact, CultivationTechnique, Skill } from '@/types/cultivator';

/**
 * 从技能效果中提取显示信息
 */
export interface SkillDisplayInfo {
  /** 威力百分比（从 Damage 效果提取） */
  power: number;
  /** 附加的 Buff ID */
  buffId?: string;
  /** Buff 持续回合 */
  buffDuration?: number;
  /** Buff 显示名称 */
  buffName?: string;
  /** 治疗量百分比 */
  healPercent?: number;
}

/**
 * 从 skill.effects 中提取显示信息
 */
export function getSkillDisplayInfo(skill: Skill): SkillDisplayInfo {
  const info: SkillDisplayInfo = { power: 0 };

  for (const effect of skill.effects ?? []) {
    const params = effect.params as Record<string, unknown> | undefined;

    if (effect.type === 'Damage') {
      const multiplier = (params?.multiplier as number) ?? 0;
      info.power = Math.round(multiplier * 100);
    } else if (effect.type === 'Heal') {
      const percent = (params?.percent as number) ?? 0;
      info.healPercent = Math.round(percent * 100);
    } else if (effect.type === 'AddBuff') {
      info.buffId = params?.buffId as string;
      info.buffDuration = params?.duration as number;
      if (info.buffId) {
        const config = buffRegistry.get(info.buffId);
        info.buffName = config?.name;
      }
    }
  }

  return info;
}

/**
 * 装备效果显示信息
 */
export interface ArtifactDisplayInfo {
  /** 属性加成列表 */
  statBonuses: Array<{ attribute: string; value: number }>;
  /** 其他效果描述 */
  effects: string[];
}

const attributeNameMap: Record<string, string> = {
  vitality: '体魄',
  spirit: '灵力',
  wisdom: '悟性',
  speed: '速度',
  willpower: '神识',
};

/**
 * 从 artifact.effects 中提取显示信息
 */
export function getArtifactDisplayInfo(
  artifact: Artifact,
): ArtifactDisplayInfo {
  const info: ArtifactDisplayInfo = { statBonuses: [], effects: [] };

  for (const effect of artifact.effects ?? []) {
    const params = effect.params as Record<string, unknown> | undefined;

    if (effect.type === 'StatModifier') {
      const attr = params?.attribute as string;
      const value = params?.value as number;
      if (attr && value) {
        info.statBonuses.push({
          attribute: attributeNameMap[attr] ?? attr,
          value,
        });
      }
    } else {
      // 其他效果，生成描述文本
      info.effects.push(`${effect.type}: ${JSON.stringify(params)}`);
    }
  }

  return info;
}

/**
 * 格式化属性加成为字符串
 */
export function formatStatBonuses(
  bonuses: Array<{ attribute: string; value: number }>,
): string {
  if (bonuses.length === 0) return '无属性加成';
  return bonuses.map((b) => `${b.attribute}+${b.value}`).join(' ');
}

/**
 * 功法效果显示信息
 */
export function getCultivationDisplayInfo(
  tech: CultivationTechnique,
): ArtifactDisplayInfo {
  const info: ArtifactDisplayInfo = { statBonuses: [], effects: [] };

  for (const effect of tech.effects ?? []) {
    const params = effect.params as Record<string, unknown> | undefined;

    if (effect.type === 'StatModifier') {
      const attr = params?.attribute as string;
      const value = params?.value as number;
      if (attr && value) {
        info.statBonuses.push({
          attribute: attributeNameMap[attr] ?? attr,
          value,
        });
      }
    }
  }

  return info;
}
