import { getResourceText } from '@shared/lib/resourceText';

/**
 * 获取资源类型图标
 */
export function getResourceIcon(type: string): string {
  const iconMap: Record<string, string> = {
    spirit_stones: '💎',
    lifespan: '⏳',
    cultivation_exp: '✨',
    comprehension_insight: '🧠',
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
    cultivation_exp: getResourceText('cultivation_exp'),
    comprehension_insight: '道心感悟',
    material: '材料',
    hp_loss: getResourceText('hp_loss'),
    mp_loss: getResourceText('mp_loss'),
    weak: '虚弱',
    battle: '战斗',
    artifact_damage: '法宝损坏',
  };
  return nameMap[type] || type;
}
