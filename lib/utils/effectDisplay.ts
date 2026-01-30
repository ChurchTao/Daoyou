import { buffRegistry } from '@/engine/buff';
import { EffectConfig, EffectFactory } from '@/engine/effect';
import { ElementType } from '@/types/constants';
import type { Artifact, CultivationTechnique, Skill } from '@/types/cultivator';

// ============================================================
// 效果显示信息类型
// ============================================================

export interface EffectDisplayInfo {
  label: string;
  icon?: string;
  description: string;
}

// ============================================================
// 核心工具函数
// ============================================================

/**
 * 获取单个效果的显示信息
 */
export function getEffectDisplayInfo(effect: EffectConfig): EffectDisplayInfo {
  try {
    return EffectFactory.create(effect).displayInfo();
  } catch {
    return {
      label: '未知效果',
      icon: '❓',
      description: `${effect.type}`,
    };
  }
}

/**
 * 统一渲染效果列表，所有类型都通过 displayInfo() 获取描述
 */
export function formatAllEffects(
  effects: EffectConfig[] | undefined,
): EffectDisplayInfo[] {
  if (!effects || effects.length === 0) return [];
  return effects.map((effect) => getEffectDisplayInfo(effect));
}

/**
 * 格式化为单行文本（用于命格、装备简介等）
 */
export function formatEffectsText(effects: EffectConfig[] | undefined): string {
  const infos = formatAllEffects(effects);
  if (infos.length === 0) return '无特殊效果';
  return infos.map((info) => info.description).join('，');
}

// ============================================================
// 技能相关
// ============================================================

/**
 * 技能显示信息
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
      const multiplier = (params?.multiplier as number) ?? 0;
      info.healPercent = Math.round(multiplier * 100);
    } else if (effect.type === 'AddBuff') {
      info.buffId = params?.buffId as string;
      info.buffDuration = params?.durationOverride as number;
      if (info.buffId) {
        const config = buffRegistry.get(info.buffId);
        info.buffName = config?.name;
      }
    }
  }

  return info;
}

/**
 * 元素图标映射
 */
const elementInfoMap: Record<ElementType, { icon: string; name: string }> = {
  火: { icon: '🔥', name: '火系' },
  水: { icon: '💧', name: '水系' },
  木: { icon: '🌿', name: '木系' },
  金: { icon: '⚔️', name: '金系' },
  土: { icon: '🪨', name: '土系' },
  风: {
    icon: '💨',
    name: '风系',
  },
  雷: {
    icon: '⚡',
    name: '雷系',
  },
  冰: {
    icon: '❄️',
    name: '冰系',
  },
};

/**
 * 获取技能元素图标和类型名
 */
export function getSkillElementInfo(skill: Skill): {
  icon: string;
  typeName: string;
} {
  const info = elementInfoMap[skill.element] ?? { icon: '🌟', name: '神通' };
  return { icon: info.icon, typeName: info.name };
}

// ============================================================
// 装备相关
// ============================================================

/**
 * 装备效果显示信息
 */
export interface ArtifactDisplayInfo {
  /** 效果描述列表 */
  effects: string[];
}

/**
 * 从 artifact.effects 中提取显示信息
 */
export function getArtifactDisplayInfo(
  artifact: Artifact,
): ArtifactDisplayInfo {
  const effects = formatAllEffects(artifact.effects);
  return {
    effects: effects.map((e) => e.description),
  };
}

// ============================================================
// 功法相关
// ============================================================

/**
 * 从 cultivation.effects 中提取显示信息
 */
export function getCultivationDisplayInfo(
  tech: CultivationTechnique,
): ArtifactDisplayInfo {
  const effects = formatAllEffects(tech.effects);
  return {
    effects: effects.map((e) => e.description),
  };
}
