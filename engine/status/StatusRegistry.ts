import type { StatusEffect } from '@/types/constants';
import type {
  EffectCalculator,
  StatusDefinition,
  StatusDuration,
  StatusType,
} from './types';

/**
 * 状态注册表
 * 维护所有状态的元信息,作为状态引擎的配置中心
 */
export class StatusRegistry {
  private definitions: Map<StatusEffect, StatusDefinition> = new Map();
  private calculators: Map<StatusEffect, EffectCalculator> = new Map();

  /**
   * 注册状态定义
   */
  registerStatus(definition: StatusDefinition): void {
    this.definitions.set(definition.statusKey, definition);
  }

  /**
   * 批量注册状态定义
   */
  registerStatuses(definitions: StatusDefinition[]): void {
    definitions.forEach((def) => this.registerStatus(def));
  }

  /**
   * 获取状态定义
   */
  getDefinition(statusKey: StatusEffect): StatusDefinition | undefined {
    return this.definitions.get(statusKey);
  }

  /**
   * 注册效果计算器
   */
  registerCalculator(
    statusKey: StatusEffect,
    calculator: EffectCalculator,
  ): void {
    this.calculators.set(statusKey, calculator);
  }

  /**
   * 获取效果计算器
   */
  getCalculator(statusKey: StatusEffect): EffectCalculator | undefined {
    return this.calculators.get(statusKey);
  }

  /**
   * 检查状态是否已注册
   */
  hasStatus(statusKey: StatusEffect): boolean {
    return this.definitions.has(statusKey);
  }

  /**
   * 获取所有已注册的状态键
   */
  getAllStatusKeys(): StatusEffect[] {
    return Array.from(this.definitions.keys());
  }

  /**
   * 按类型获取状态定义
   */
  getStatusesByType(statusType: StatusType): StatusDefinition[] {
    return Array.from(this.definitions.values()).filter(
      (def) => def.statusType === statusType,
    );
  }
}

// 创建全局单例
export const statusRegistry = new StatusRegistry();

// ===== 预定义状态注册 =====

/**
 * 注册战斗状态
 */
function registerCombatStatuses(): void {
  const combatStatuses: StatusDefinition[] = [
    // Buff类
    {
      statusKey: 'armor_up',
      statusType: 'buff',
      displayName: '护体',
      description: '减伤提升15%',
      defaultDuration: { durationType: 'turn', remaining: 2, total: 2 },
      defaultPotency: 15,
      stackable: false,
      maxStack: 1,
      conflictsWith: ['armor_down'],
    },
    {
      statusKey: 'speed_up',
      statusType: 'buff',
      displayName: '疾行',
      description: '速度提升20点',
      defaultDuration: { durationType: 'turn', remaining: 2, total: 2 },
      defaultPotency: 20,
      stackable: false,
      maxStack: 1,
    },
    {
      statusKey: 'crit_rate_up',
      statusType: 'buff',
      displayName: '锋锐',
      description: '暴击率提升15%',
      defaultDuration: { durationType: 'turn', remaining: 2, total: 2 },
      defaultPotency: 15,
      stackable: false,
      maxStack: 1,
      conflictsWith: ['crit_rate_down'],
    },

    // Debuff类
    {
      statusKey: 'armor_down',
      statusType: 'debuff',
      displayName: '破防',
      description: '减伤降低15%',
      defaultDuration: { durationType: 'turn', remaining: 2, total: 2 },
      defaultPotency: 15,
      stackable: false,
      maxStack: 1,
      conflictsWith: ['armor_up'],
    },
    {
      statusKey: 'crit_rate_down',
      statusType: 'debuff',
      displayName: '暴击压制',
      description: '暴击率降低15%',
      defaultDuration: { durationType: 'turn', remaining: 2, total: 2 },
      defaultPotency: 15,
      stackable: false,
      maxStack: 1,
      conflictsWith: ['crit_rate_up'],
    },

    // Control类
    {
      statusKey: 'stun',
      statusType: 'control',
      displayName: '眩晕',
      description: '无法行动',
      defaultDuration: { durationType: 'turn', remaining: 1, total: 1 },
      defaultPotency: 0,
      stackable: false,
      maxStack: 1,
    },
    {
      statusKey: 'silence',
      statusType: 'control',
      displayName: '沉默',
      description: '无法使用技能',
      defaultDuration: { durationType: 'turn', remaining: 2, total: 2 },
      defaultPotency: 0,
      stackable: false,
      maxStack: 1,
    },
    {
      statusKey: 'root',
      statusType: 'control',
      displayName: '定身',
      description: '无法闪避',
      defaultDuration: { durationType: 'turn', remaining: 2, total: 2 },
      defaultPotency: 0,
      stackable: false,
      maxStack: 1,
    },

    // DOT类
    {
      statusKey: 'burn',
      statusType: 'dot',
      displayName: '灼烧',
      description: '火元素持续伤害',
      defaultDuration: { durationType: 'turn', remaining: 3, total: 3 },
      defaultPotency: 60,
      stackable: true,
      maxStack: 3,
      element: '火',
    },
    {
      statusKey: 'bleed',
      statusType: 'dot',
      displayName: '流血',
      description: '物理持续伤害',
      defaultDuration: { durationType: 'turn', remaining: 3, total: 3 },
      defaultPotency: 60,
      stackable: true,
      maxStack: 3,
      element: '金',
    },
    {
      statusKey: 'poison',
      statusType: 'dot',
      displayName: '中毒',
      description: '毒素持续伤害',
      defaultDuration: { durationType: 'turn', remaining: 3, total: 3 },
      defaultPotency: 60,
      stackable: true,
      maxStack: 5,
      element: '木',
    },
  ];

  statusRegistry.registerStatuses(combatStatuses);
}

/**
 * 注册持久状态
 */
function registerPersistentStatuses(): void {
  const persistentStatuses: StatusDefinition[] = [
    {
      statusKey: 'weakness' as StatusEffect,
      statusType: 'persistent',
      displayName: '虚弱',
      description: '全属性降低10%',
      defaultDuration: { durationType: 'permanent', remaining: -1, total: -1 },
      defaultPotency: 10,
      stackable: false,
      maxStack: 1,
    },
    {
      statusKey: 'minor_wound' as StatusEffect,
      statusType: 'persistent',
      displayName: '轻伤',
      description: '最大气血降低10%',
      defaultDuration: { durationType: 'permanent', remaining: -1, total: -1 },
      defaultPotency: 10,
      stackable: false,
      maxStack: 1,
    },
    {
      statusKey: 'major_wound' as StatusEffect,
      statusType: 'persistent',
      displayName: '重伤',
      description: '最大气血大幅降低30%',
      defaultDuration: { durationType: 'permanent', remaining: -1, total: -1 },
      defaultPotency: 30,
      stackable: false,
      maxStack: 1,
    },
    {
      statusKey: 'near_death' as StatusEffect,
      statusType: 'persistent',
      displayName: '濒死',
      description: '全属性与气血大幅降低50%',
      defaultDuration: { durationType: 'permanent', remaining: -1, total: -1 },
      defaultPotency: 50,
      stackable: false,
      maxStack: 1,
    },
    {
      statusKey: 'mana_depleted' as StatusEffect,
      statusType: 'persistent',
      displayName: '灵力枯竭',
      description: '最大灵力降低20%',
      defaultDuration: { durationType: 'permanent', remaining: -1, total: -1 },
      defaultPotency: 20,
      stackable: false,
      maxStack: 1,
    },
    {
      statusKey: 'hp_deficit' as StatusEffect,
      statusType: 'persistent',
      displayName: '气血亏空',
      description: '治疗效果降低30%',
      defaultDuration: { durationType: 'permanent', remaining: -1, total: -1 },
      defaultPotency: 30,
      stackable: false,
      maxStack: 1,
    },
    {
      statusKey: 'enlightenment' as StatusEffect,
      statusType: 'persistent',
      displayName: '顿悟',
      description: '悟性大幅提升50%',
      defaultDuration: { durationType: 'permanent', remaining: -1, total: -1 },
      defaultPotency: 50,
      stackable: false,
      maxStack: 1,
    },
    {
      statusKey: 'willpower_enhanced' as StatusEffect,
      statusType: 'persistent',
      displayName: '神识增强',
      description: '神识提升30%',
      defaultDuration: { durationType: 'permanent', remaining: -1, total: -1 },
      defaultPotency: 30,
      stackable: false,
      maxStack: 1,
    },
    {
      statusKey: 'fate_blessing' as StatusEffect,
      statusType: 'persistent',
      displayName: '命格加持',
      description: '全属性小幅提升10%',
      defaultDuration: { durationType: 'permanent', remaining: -1, total: -1 },
      defaultPotency: 10,
      stackable: false,
      maxStack: 1,
    },
  ];

  statusRegistry.registerStatuses(persistentStatuses);
}

/**
 * 注册环境状态
 */
function registerEnvironmentalStatuses(): void {
  const environmentalStatuses: StatusDefinition[] = [
    {
      statusKey: 'scorching' as StatusEffect,
      statusType: 'environmental',
      displayName: '炎热',
      description: '火元素加强20%，水元素削弱20%',
      defaultDuration: { 
        durationType: 'conditional', 
        remaining: -1, 
        total: -1,
        condition: { conditionType: 'custom' },
      },
      defaultPotency: 20,
      stackable: false,
      maxStack: 1,
      element: '火',
    },
    {
      statusKey: 'freezing' as StatusEffect,
      statusType: 'environmental',
      displayName: '冰冻',
      description: '冰元素加强20%，火元素削弱20%',
      defaultDuration: { 
        durationType: 'conditional', 
        remaining: -1, 
        total: -1,
        condition: { conditionType: 'custom' },
      },
      defaultPotency: 20,
      stackable: false,
      maxStack: 1,
      element: '冰',
    },
    {
      statusKey: 'toxic_air' as StatusEffect,
      statusType: 'environmental',
      displayName: '瘴气',
      description: '每回合损失最大气蠀2%',
      defaultDuration: { 
        durationType: 'conditional', 
        remaining: -1, 
        total: -1,
        condition: { conditionType: 'custom' },
      },
      defaultPotency: 2,
      stackable: false,
      maxStack: 1,
      element: '木',
    },
    {
      statusKey: 'formation_suppressed' as StatusEffect,
      statusType: 'environmental',
      displayName: '阵法压制',
      description: '全属性降低20%',
      defaultDuration: { 
        durationType: 'conditional', 
        remaining: -1, 
        total: -1,
        condition: { conditionType: 'custom' },
      },
      defaultPotency: 20,
      stackable: false,
      maxStack: 1,
    },
    {
      statusKey: 'abundant_qi' as StatusEffect,
      statusType: 'environmental',
      displayName: '灵气充裕',
      description: 'MP恢复增强50%',
      defaultDuration: { 
        durationType: 'conditional', 
        remaining: -1, 
        total: -1,
        condition: { conditionType: 'custom' },
      },
      defaultPotency: 50,
      stackable: false,
      maxStack: 1,
    },
  ];

  statusRegistry.registerStatuses(environmentalStatuses);
}

/**
 * 初始化状态注册表
 */
export function initializeStatusRegistry(): void {
  registerCombatStatuses();
  registerPersistentStatuses();
  registerEnvironmentalStatuses();
}

// 自动初始化
initializeStatusRegistry();
