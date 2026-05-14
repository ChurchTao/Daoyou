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
