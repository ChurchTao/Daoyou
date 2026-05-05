import {
  getCombatStatusTemplate,
} from '@/engine/battle-v5/setup/CombatStatusTemplateRegistry';
import type { PersistentCombatStatusV5 } from '@/engine/battle-v5/setup/types';

/**
 * 状态显示信息
 */
export interface StatusDisplayInfo {
  key: string;
  name: string;
  description: string;
  icon: string;
  color: string;
  type: 'buff' | 'debuff' | 'persistent' | 'environmental' | 'combat';
  stacks?: number;
}

/**
 * 获取状态显示信息（从 BuffRegistry）
 */
export function getStatusDisplay(
  templateId: string,
  stacks?: number,
): StatusDisplayInfo {
  const config = getCombatStatusTemplate(templateId);

  if (!config) {
    return {
      key: templateId,
      name: templateId,
      description: '未知状态',
      icon: '❓',
      color: 'text-ink-secondary',
      type: 'persistent',
    };
  }

  return {
    key: templateId,
    name: config.name,
    description: config.description,
    icon: config.display.icon,
    color: 'text-blue-600',
    type: 'persistent',
    stacks,
  };
}

/**
 * 批量获取状态显示信息
 */
export function getBuffsDisplay(
  buffs: PersistentCombatStatusV5[],
): StatusDisplayInfo[] {
  return buffs.map((buff) => getStatusDisplay(buff.templateId, buff.stacks));
}

/**
 * 获取资源类型图标
 */
export function getResourceIcon(type: string): string {
  const iconMap: Record<string, string> = {
    spirit_stones: '💎',
    lifespan: '⏳',
    cultivation_exp: '✨',
    material: '📦',
    hp_loss: '❤️',
    mp_loss: '💧',
    weak: '💫',
    battle: '⚔️',
    artifact_damage: '🔧',
  };
  return iconMap[type] ?? '❔';
}

/**
 * 获取资源类型显示名称
 */
export function getResourceDisplayName(type: string): string {
  const nameMap: Record<string, string> = {
    spirit_stones: '灵石',
    lifespan: '寿元',
    cultivation_exp: '修为',
    material: '材料',
    hp_loss: '气血损失',
    mp_loss: '灵力损失',
    weak: '虚弱',
    battle: '战斗',
    artifact_damage: '法宝损坏',
  };
  return nameMap[type] || type;
}
