import { AbilityId, AbilityType } from '../core/types';
import { Unit } from '../units/Unit';
import { Ability, AbilityContext } from './Ability';
import { TargetPolicy } from './TargetPolicy';

/**
 * 资源消耗配置
 */
export interface ResourceCost {
  type: 'mp' | 'hp' | 'rage' | 'energy';
  amount: number;
}

/**
 * 主动技能配置
 */
export interface ActiveSkillConfig {
  mpCost?: number;
  hpCost?: number;
  cooldown?: number;
  priority?: number;
  targetPolicy?: TargetPolicy;
  baseDamage?: number;
  damageCoefficient?: number;
}

/**
 * 主动技能基类
 *
 * 职责：
 * - 管理冷却时间
 * - 管理资源消耗
 * - 定义目标策略
 */
export abstract class ActiveSkill extends Ability {
  // 冷却管理
  private _cooldown: number = 0;
  private _maxCooldown: number = 0;

  // 资源消耗
  private _resourceCosts: ResourceCost[] = [];

  // 目标策略
  readonly targetPolicy: TargetPolicy;

  constructor(id: AbilityId, name: string, config: ActiveSkillConfig = {}) {
    super(id, name, AbilityType.ACTIVE_SKILL);

    // 初始化冷却
    this._maxCooldown = config.cooldown ?? 0;

    // 初始化资源消耗
    if (config.mpCost) {
      this._resourceCosts.push({ type: 'mp', amount: config.mpCost });
    }
    if (config.hpCost) {
      this._resourceCosts.push({ type: 'hp', amount: config.hpCost });
    }

    // 初始化优先级
    if (config.priority !== undefined) {
      this.setPriority(config.priority);
    }

    // 初始化目标策略
    this.targetPolicy = config.targetPolicy ?? TargetPolicy.default();
  }

  // ===== 冷却管理 =====

  get maxCooldown(): number {
    return this._maxCooldown;
  }

  get currentCooldown(): number {
    return this._cooldown;
  }

  // 兼容旧 API
  getCooldown(): number {
    return this._maxCooldown;
  }

  // 兼容旧 API
  getCurrentCooldown(): number {
    return this._cooldown;
  }

  isReady(): boolean {
    return this._cooldown === 0;
  }

  startCooldown(): void {
    this._cooldown = this._maxCooldown;
  }

  tickCooldown(): void {
    if (this._cooldown > 0) {
      this._cooldown--;
    }
  }

  /**
   * 修改当前冷却时间
   * @param delta 变化量，正数为增加，负数为减少
   */
  modifyCooldown(delta: number): void {
    this._cooldown = Math.max(0, this._cooldown + delta);
  }

  resetCooldown(): void {
    this._cooldown = 0;
  }

  // 兼容旧 API - 设置最大冷却时间
  setCooldown(value: number): void {
    this._maxCooldown = value;
  }

  // ===== 资源消耗 =====

  get resourceCosts(): ResourceCost[] {
    return [...this._resourceCosts];
  }

  // 兼容旧 API - 获取 MP 消耗
  get manaCost(): number {
    const mpCost = this._resourceCosts.find((c) => c.type === 'mp');
    return mpCost?.amount ?? 0;
  }

  // 兼容旧 API - 设置 MP 消耗
  setManaCost(value: number): void {
    const existingIndex = this._resourceCosts.findIndex((c) => c.type === 'mp');
    if (existingIndex >= 0) {
      if (value === 0) {
        this._resourceCosts.splice(existingIndex, 1);
      } else {
        this._resourceCosts[existingIndex].amount = value;
      }
    } else if (value > 0) {
      this._resourceCosts.push({ type: 'mp', amount: value });
    }
  }

  /**
   * 检查是否有足够资源
   */
  hasEnoughResources(caster: Unit): boolean {
    for (const cost of this._resourceCosts) {
      switch (cost.type) {
        case 'mp':
          if (caster.currentMp < cost.amount) return false;
          break;
        case 'hp':
          if (caster.currentHp <= cost.amount) return false;
          break;
      }
    }
    return true;
  }

  /**
   * 消耗资源
   */
  consumeResources(caster: Unit): void {
    for (const cost of this._resourceCosts) {
      switch (cost.type) {
        case 'mp':
          caster.consumeMp(cost.amount);
          break;
        case 'hp':
          caster.takeDamage(cost.amount);
          break;
      }
    }
  }

  // ===== 核心方法重写 =====

  /**
   * 检查是否可以触发
   * 包含冷却检查和资源检查
   */
  override canTrigger(context: AbilityContext): boolean {
    // 基类检查
    if (!super.canTrigger(context)) return false;

    // 冷却检查
    if (!this.isReady()) return false;

    // 资源检查
    const caster = this.getOwner() ?? context.caster;
    if (!this.hasEnoughResources(caster)) return false;

    return true;
  }

  /**
   * 执行技能
   * 负责资源消耗、冷却启动、效果执行
   */
  override execute(context: AbilityContext): void {
    // 消耗资源
    this.consumeResources(context.caster);

    // 启动冷却
    this.startCooldown();

    // 执行技能效果（子类实现）
    this.executeSkill(context.caster, context.target);
  }

  /**
   * 子类实现具体技能效果
   */
  protected abstract executeSkill(caster: Unit, target: Unit): void;

  // ===== 克隆 =====

  override clone(): ActiveSkill {
    const cloned = super.clone() as ActiveSkill;
    cloned._maxCooldown = this._maxCooldown;
    cloned._resourceCosts = [...this._resourceCosts];
    return cloned;
  }
}
