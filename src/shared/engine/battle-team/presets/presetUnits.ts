import { AttributeType } from '@shared/engine/battle-v5/core/types';
import type { TeamUnit } from '../TeamUnit';
import { TeamUnit as TeamUnitClass } from '../TeamUnit';
import type { TeamAbility } from '../TeamAbility';
import {
  createAttackAura,
  createMagicAura,
  createCombo,
  createCounter,
  createLastStand,
} from './presetAbilities';

export interface PresetUnitConfig {
  id: string;
  name: string;
  side: 'A' | 'B';
  position: 'front' | 'back';
  baseAttrs: Partial<Record<AttributeType, number>>;
}

/**
 * 4 个预设角色配置。
 *
 * A 队：
 * - 前排：剑修（力道高，带攻击光环）
 * - 后排：灵修（灵力高，带反击）
 *
 * B 队：
 * - 前排：体修（体魄高，带连击）
 * - 后排：法修（神识高，带法力光环 + 绝境爆发）
 */
export const PRESET_UNITS: PresetUnitConfig[] = [
  {
    id: 'a_front_sword',
    name: '剑修·青云',
    side: 'A',
    position: 'front',
    baseAttrs: {
      [AttributeType.VITALITY]: 22,
      [AttributeType.STRENGTH]: 30,
      [AttributeType.SPIRIT]: 10,
      [AttributeType.ENDURANCE]: 18,
      [AttributeType.SPEED]: 20,
      [AttributeType.WILLPOWER]: 12,
    },
  },
  {
    id: 'a_back_spirit',
    name: '灵修·玄机',
    side: 'A',
    position: 'back',
    baseAttrs: {
      [AttributeType.VITALITY]: 16,
      [AttributeType.STRENGTH]: 8,
      [AttributeType.SPIRIT]: 28,
      [AttributeType.ENDURANCE]: 12,
      [AttributeType.SPEED]: 18,
      [AttributeType.WILLPOWER]: 20,
    },
  },
  {
    id: 'b_front_brute',
    name: '体修·蛮山',
    side: 'B',
    position: 'front',
    baseAttrs: {
      [AttributeType.VITALITY]: 28,
      [AttributeType.STRENGTH]: 24,
      [AttributeType.SPIRIT]: 8,
      [AttributeType.ENDURANCE]: 26,
      [AttributeType.SPEED]: 14,
      [AttributeType.WILLPOWER]: 10,
    },
  },
  {
    id: 'b_back_mage',
    name: '法修·幽冥',
    side: 'B',
    position: 'back',
    baseAttrs: {
      [AttributeType.VITALITY]: 14,
      [AttributeType.STRENGTH]: 6,
      [AttributeType.SPIRIT]: 30,
      [AttributeType.ENDURANCE]: 10,
      [AttributeType.SPEED]: 22,
      [AttributeType.WILLPOWER]: 24,
    },
  },
];

/**
 * 根据单位 ID 构建新技能实例（避免跨战斗状态泄漏）。
 */
function buildFreshAbilities(unitId: string): TeamAbility[] {
  switch (unitId) {
    case 'a_front_sword':
      return [createAttackAura()];
    case 'a_back_spirit':
      return [createCounter()];
    case 'b_front_brute':
      return [createCombo()];
    case 'b_back_mage':
      return [createMagicAura(), createLastStand()];
    default:
      return [];
  }
}

/**
 * 构建预设的 4 个 TeamUnit 实例。
 * 每次调用都创建新实例（避免跨战斗状态泄漏）。
 */
export function buildPresetUnits(): [TeamUnit, TeamUnit, TeamUnit, TeamUnit] {
  return PRESET_UNITS.map((config) => {
    const freshAbilities = buildFreshAbilities(config.id);
    return new TeamUnitClass({
      id: config.id,
      name: config.name,
      side: config.side,
      position: config.position,
      baseAttrs: config.baseAttrs,
      abilities: freshAbilities,
    });
  }) as [TeamUnit, TeamUnit, TeamUnit, TeamUnit];
}
