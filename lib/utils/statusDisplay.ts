import { buffRegistry } from '@/engine/buff';
import type { BuffInstanceState } from '@/engine/buff/types';
import { BuffTag } from '@/engine/buff/types';

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
  configId: string,
  stacks?: number,
): StatusDisplayInfo {
  const config = buffRegistry.get(configId);

  if (!config) {
    return {
      key: configId,
      name: configId,
      description: '未知状态',
      icon: '❓',
      color: 'text-ink-secondary',
      type: 'combat',
    };
  }

  // 根据标签确定类型
  const tags = config.tags || [];
  let displayType: StatusDisplayInfo['type'] = 'combat';
  if (tags.includes(BuffTag.PERSISTENT)) displayType = 'persistent';
  else if (tags.includes(BuffTag.BUFF)) displayType = 'buff';
  else if (tags.includes(BuffTag.DEBUFF)) displayType = 'debuff';

  const iconMap: Record<string, string> = {
    buff: '⬆️',
    debuff: '⬇️',
    persistent: '💫',
    combat: '⚔️',
    environmental: '🌍',
  };

  const colorMap: Record<string, string> = {
    buff: 'text-green-600',
    debuff: 'text-orange-600',
    persistent: 'text-blue-600',
    combat: 'text-purple-600',
    environmental: 'text-teal-600',
  };

  return {
    key: configId,
    name: config.name,
    description: config.description ?? '状态效果',
    icon: iconMap[displayType] ?? '⭐',
    color: colorMap[displayType] ?? 'text-ink',
    type: displayType,
    stacks,
  };
}

/**
 * 批量获取状态显示信息
 */
export function getBuffsDisplay(
  buffs: BuffInstanceState[],
): StatusDisplayInfo[] {
  return buffs.map((b) => getStatusDisplay(b.configId, b.currentStacks));
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
