/**
 * 目标类型
 */
export type TargetTeam = 'enemy' | 'ally' | 'any' | 'self';

/**
 * 目标范围
 */
export type TargetScope = 'single' | 'aoe' | 'random';

/**
 * 目标过滤器
 */
export type TargetFilter =
  | 'lowest_hp' // 血量最低
  | 'highest_hp' // 血量最高
  | 'lowest_mp' // 蓝量最低
  | 'fastest' // 速度最快
  | 'slowest' // 速度最慢
  | 'nearest' // 距离最近
  | 'furthest'; // 距离最远

/**
 * 目标策略配置
 */
export interface TargetPolicyConfig {
  team: TargetTeam;
  scope: TargetScope;
  filters?: TargetFilter[];
  maxTargets?: number; // AOE 时最多目标数
}

/**
 * 目标策略类
 * 定义技能如何选择目标
 */
export class TargetPolicy {
  readonly team: TargetTeam;
  readonly scope: TargetScope;
  readonly filters: TargetFilter[];
  readonly maxTargets: number;

  constructor(config: TargetPolicyConfig) {
    this.team = config.team;
    this.scope = config.scope;
    this.filters = config.filters ?? [];
    this.maxTargets = config.maxTargets ?? 1;
  }

  /**
   * 默认目标策略：单体敌方
   */
  static default(): TargetPolicy {
    return new TargetPolicy({
      team: 'enemy',
      scope: 'single',
    });
  }

  /**
   * 自身目标策略
   */
  static self(): TargetPolicy {
    return new TargetPolicy({
      team: 'self',
      scope: 'single',
    });
  }

  /**
   * AOE 敌方策略
   */
  static aoeEnemy(maxTargets: number = 5): TargetPolicy {
    return new TargetPolicy({
      team: 'enemy',
      scope: 'aoe',
      maxTargets,
    });
  }
}
