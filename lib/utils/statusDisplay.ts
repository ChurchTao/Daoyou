import { statusRegistry } from '@/engine/status/StatusRegistry';
import type { PersistentStatusSnapshot } from '@/lib/dungeon/types';
import type { StatusEffect } from '@/types/constants';

/**
 * 状态显示信息
 */
export interface StatusDisplayInfo {
  key: StatusEffect;
  name: string;
  description: string;
  icon: string;
  color: string;
  type: 'buff' | 'debuff' | 'persistent' | 'environmental' | 'combat';
  potency?: number;
}

/**
 * 获取状态显示信息
 * 统一的状态渲染逻辑，从 StatusRegistry 获取状态定义
 */
export function getStatusDisplay(
  statusKey: StatusEffect,
  potency?: number,
): StatusDisplayInfo {
  const definition = statusRegistry.getDefinition(statusKey);

  if (!definition) {
    return {
      key: statusKey,
      name: statusKey,
      description: '未知状态',
      icon: '❓',
      color: 'text-ink-secondary',
      type: 'combat',
    };
  }

  // 根据状态类型返回图标和颜色
  const iconMap: Record<string, string> = {
    buff: '⬆️',
    debuff: '⬇️',
    dot: '🔥',
    control: '⛓️',
    persistent: '💫',
    environmental: '🌍',
  };

  const colorMap: Record<string, string> = {
    buff: 'text-green-600',
    debuff: 'text-orange-600',
    dot: 'text-red-600',
    control: 'text-purple-600',
    persistent: 'text-blue-600',
    environmental: 'text-teal-600',
  };

  // 确定类型
  let displayType:
    | 'buff'
    | 'debuff'
    | 'persistent'
    | 'environmental'
    | 'combat' = 'combat';
  if (
    definition.statusType === 'buff' ||
    definition.statusType === 'debuff' ||
    definition.statusType === 'dot' ||
    definition.statusType === 'control'
  ) {
    displayType = 'combat';
  } else {
    displayType = definition.statusType as
      | 'persistent'
      | 'environmental'
      | 'combat';
  }

  return {
    key: statusKey,
    name: definition.displayName,
    description: definition.description ?? '状态效果',
    icon: iconMap[definition.statusType] ?? '⭐',
    color: colorMap[definition.statusType] ?? 'text-ink',
    type: displayType,
    potency: potency ?? definition.defaultPotency,
  };
}

/**
 * 批量获取状态显示信息
 */
export function getStatusesDisplay(
  statuses: PersistentStatusSnapshot[],
): StatusDisplayInfo[] {
  return statuses.map((s) =>
    getStatusDisplay(s.statusKey as StatusEffect, s.potency),
  );
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
