import { AbilityId, AbilityType } from '../core/types';
import type {
  AbilityCostConfig,
  AbilitySelectionProfile,
  ConditionConfig,
} from '../core/configs';
import { checkConditions } from '../core/conditionEvaluator';
import { EventBus } from '../core/EventBus';
import type { AbilityCostPaidEvent } from '../core/events';
import {
  beginAbilityTransform,
  endAbilityTransform,
  peekAbilityTransform,
} from '../core/runtimeState';
import { Unit } from '../units/Unit';
import { Ability, AbilityContext, type AbilityCastSnapshot } from './Ability';
import { TargetPolicy } from './TargetPolicy';

/**
 * 资源消耗配置
 */
export interface ResourceCost {
  type: 'mp' | 'hp' | 'rage' | 'energy';
  amount: number;
  mode?: AbilityCostConfig['mode'];
  retain?: number;
}

/**
 * 主动技能配置
 */
export interface ActiveSkillConfig {
  description?: string;
  mpCost?: number;
  hpCost?: number;
  costs?: AbilityCostConfig[];
  cooldown?: number;
  priority?: number;
  targetPolicy?: TargetPolicy;
  baseDamage?: number;
  damageCoefficient?: number;
  selectionProfile?: AbilitySelectionProfile;
  castConditions?: ConditionConfig[];
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

  // 目标策略
  private readonly _targetPolicy: TargetPolicy;
  private readonly _selectionProfile?: AbilitySelectionProfile;
  private readonly _castConditions: ConditionConfig[];

  constructor(id: AbilityId, name: string, config: ActiveSkillConfig = {}) {
    super(id, name, AbilityType.ACTIVE_SKILL, config.description);

    // 初始化冷却
    this._maxCooldown = this.normalizeCooldownValue(config.cooldown ?? 0);

    // 初始化资源消耗
    if (config.costs?.length) {
      this._costConfigs = config.costs.map((cost) => ({ ...cost }));
    } else {
      if (config.mpCost) {
        this._costConfigs.push({ resource: 'mp', mode: 'flat', amount: config.mpCost });
      }
      if (config.hpCost) {
        this._costConfigs.push({ resource: 'hp', mode: 'flat', amount: config.hpCost });
      }
    }

    // 初始化优先级
    if (config.priority !== undefined) {
      this.setPriority(config.priority);
    }

    // 初始化目标策略
    this._targetPolicy = config.targetPolicy ?? TargetPolicy.default();
    this._selectionProfile = config.selectionProfile;
    this._castConditions = config.castConditions ?? [];
  }

  private _costConfigs: AbilityCostConfig[] = [];
  private _preparedCosts?: ResourceCost[];
  private _preparedTarget?: Unit;
  private _castSnapshot?: AbilityCastSnapshot;

  get targetPolicy(): TargetPolicy {
    return this._targetPolicy;
  }

  get selectionProfile(): AbilitySelectionProfile | undefined {
    return this._selectionProfile;
  }

  get castConditions(): ConditionConfig[] {
    return this._castConditions;
  }

  protected getCostConfigs(_caster: Unit): AbilityCostConfig[] {
    void _caster;
    return this._costConfigs;
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
    return this._cooldown <= 0;
  }

  startCooldown(): void {
    this._cooldown = this._maxCooldown;
  }

  tickCooldown(): void {
    if (this._cooldown > 0) {
      this._cooldown = Math.max(0, this._cooldown - 1);
    }
  }

  /**
   * 修改当前冷却时间
   * @param delta 变化量，正数为增加，负数为减少
   */
  modifyCooldown(delta: number): void {
    this._cooldown = Math.max(
      0,
      this._cooldown + this.normalizeCooldownValue(delta),
    );
  }

  resetCooldown(): void {
    this._cooldown = 0;
  }

  // 兼容旧 API - 设置最大冷却时间
  setCooldown(value: number): void {
    this._maxCooldown = this.normalizeCooldownValue(value);
  }

  // ===== 资源消耗 =====

  get resourceCosts(): ResourceCost[] {
    const owner = this.getOwner();
    if (owner) return this.resolveCosts(owner);
    return this._costConfigs.flatMap((cost) =>
      cost.mode === 'flat'
        ? [{ type: cost.resource, amount: Math.max(0, Math.ceil(cost.amount)), mode: cost.mode }]
        : [],
    );
  }

  get costConfigs(): AbilityCostConfig[] {
    const owner = this.getOwner();
    return (owner ? this.getCostConfigs(owner) : this._costConfigs).map((cost) => ({ ...cost }));
  }

  // 兼容旧 API - 获取法力消耗
  get manaCost(): number {
    const mpCost = this.resourceCosts.find((c) => c.type === 'mp');
    return mpCost?.amount ?? 0;
  }

  // 兼容旧 API - 设置法力消耗
  setManaCost(value: number): void {
    const existingIndex = this._costConfigs.findIndex((cost) => cost.resource === 'mp');
    if (existingIndex >= 0) {
      if (value === 0) {
        this._costConfigs.splice(existingIndex, 1);
      } else {
        this._costConfigs[existingIndex] = {
          resource: 'mp',
          mode: 'flat',
          amount: value,
        };
      }
    } else if (value > 0) {
      this._costConfigs.push({ resource: 'mp', mode: 'flat', amount: value });
    }
  }

  /**
   * 检查是否有足够资源
   */
  hasEnoughResources(caster: Unit): boolean {
    const transform = peekAbilityTransform(caster, this);
    let hpRequired = 0;
    let hpRetain = 0;
    let mpRequired = 0;
    for (const cost of this._preparedCosts ?? this.resolveCosts(caster)) {
      switch (cost.type) {
        case 'mp':
          if (transform?.freeManaCost) break;
          if (transform?.mpCostToHp) {
            hpRequired += cost.amount;
            hpRetain = Math.max(hpRetain, cost.retain ?? 1);
            break;
          }
          mpRequired += cost.amount;
          break;
        case 'hp':
          hpRequired += cost.amount;
          hpRetain = Math.max(hpRetain, cost.retain ?? 1);
          break;
      }
    }
    return (
      caster.getCurrentMp() >= mpRequired &&
      caster.getCurrentHp() - hpRequired >= hpRetain
    );
  }

  /**
   * 消耗资源
   */
  consumeResources(caster: Unit): void {
    const transform = peekAbilityTransform(caster, this);
    const costs = this._preparedCosts ?? this.resolveCosts(caster);
    const beforeHp = caster.getCurrentHp();
    const beforeMp = caster.getCurrentMp();
    for (const cost of costs) {
      switch (cost.type) {
        case 'mp':
          if (transform?.freeManaCost) break;
          if (transform?.mpCostToHp) {
            caster.setHp(caster.getCurrentHp() - cost.amount);
          } else {
            caster.consumeMp(cost.amount);
          }
          break;
        case 'hp':
          caster.setHp(caster.getCurrentHp() - cost.amount);
          break;
      }
    }
    const afterHp = caster.getCurrentHp();
    const afterMp = caster.getCurrentMp();
    const beforeRatio = caster.getMaxHp() > 0 ? beforeHp / caster.getMaxHp() : 0;
    const afterRatio = caster.getMaxHp() > 0 ? afterHp / caster.getMaxHp() : 0;
    const crossedHpRatios = [0.7, 0.45, 0.25].filter(
      (ratio) => beforeRatio >= ratio && afterRatio < ratio,
    );
    EventBus.instance.publish<AbilityCostPaidEvent>({
      type: 'AbilityCostPaidEvent',
      timestamp: Date.now(),
      caster,
      ability: this,
      beforeHp,
      afterHp,
      beforeMp,
      afterMp,
      hpPaid: beforeHp - afterHp,
      mpPaid: beforeMp - afterMp,
      crossedHpRatios,
    });
  }

  private resolveCosts(caster: Unit): ResourceCost[] {
    return this.getCostConfigs(caster).map((cost) => {
      if (cost.mode === 'flat') {
        return {
          type: cost.resource,
          amount: Math.max(0, Math.ceil(cost.amount)),
          mode: cost.mode,
          retain: cost.retain,
        };
      }
      return {
        type: 'hp' as const,
        amount: Math.max(cost.minimum ?? 1, Math.ceil(caster.getCurrentHp() * cost.ratio)),
        mode: cost.mode,
        retain: cost.retain ?? 1,
      };
    });
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
    if (
      this.castConditions.length > 0 &&
      !checkConditions(
        { caster, target: context.target, ability: this },
        this.castConditions,
      )
    ) return false;

    return true;
  }

  override prepareCast(context: AbilityContext): void {
    this._preparedCosts = this.resolveCosts(context.caster);
    this._preparedTarget = context.target;
  }

  override cancelPreparedCast(): void {
    this._preparedCosts = undefined;
    this._preparedTarget = undefined;
    this._castSnapshot = undefined;
  }

  get preparedTarget(): Unit | undefined {
    return this._preparedTarget;
  }

  canExecutePreparedCast(caster: Unit): boolean {
    return this.hasEnoughResources(caster);
  }

  protected get castSnapshot(): AbilityCastSnapshot | undefined {
    return this._castSnapshot;
  }

  /**
   * 执行技能
   * 负责资源消耗、冷却启动、效果执行
   */
  override execute(context: AbilityContext): void {
    if (!this.canExecutePreparedCast(context.caster)) {
      this.cancelPreparedCast();
      return;
    }
    const beforeCostHp = context.caster.getCurrentHp();
    const target = this._preparedTarget ?? context.target;
    // 消耗资源
    this.consumeResources(context.caster);
    const afterCostHp = context.caster.getCurrentHp();
    this._castSnapshot = {
      variantId: this.runtimeVariantId,
      casterHpBeforeCost: beforeCostHp,
      casterHpAfterCost: afterCostHp,
      casterHpRatioAfterCost:
        context.caster.getMaxHp() > 0 ? afterCostHp / context.caster.getMaxHp() : 0,
      targetHpBeforeEffects: target.getCurrentHp(),
      targetHpRatioBeforeEffects:
        target.getMaxHp() > 0
          ? target.getCurrentHp() / target.getMaxHp()
          : 0,
    };

    // 启动冷却
    this.startCooldown();
    const transform = peekAbilityTransform(context.caster, this);
    if (transform?.cooldownModify) {
      this.modifyCooldown(transform.cooldownModify);
    }

    const activeTransform = beginAbilityTransform(context.caster, this);
    try {
      // 施法承诺在 MP/CD 结算后必定执行，例如调息或登记后发攻击。
      this.executeCastEffects(context.caster, target);
      if (context.shouldApplyEffects === false) {
        return;
      }

      // 执行技能效果（子类实现）
      this.executeSkill(context.caster, target);
    } finally {
      if (activeTransform) {
        endAbilityTransform(this);
      }
      this.onCastFinished();
      this._preparedCosts = undefined;
      this._preparedTarget = undefined;
      this._castSnapshot = undefined;
    }
  }

  protected onCastFinished(): void {}

  /**
   * 子类实现具体技能效果
   */
  protected abstract executeSkill(caster: Unit, target: Unit): void;

  protected executeCastEffects(_caster: Unit, _target: Unit): void {
    void _caster;
    void _target;
  }

  private normalizeCooldownValue(value: number): number {
    if (!Number.isFinite(value)) {
      return 0;
    }

    return Math.round(value);
  }

  // ===== 克隆 =====

  override clone(): ActiveSkill {
    const cloned = super.clone() as ActiveSkill;
    cloned._maxCooldown = this._maxCooldown;
    cloned._costConfigs = this._costConfigs.map((cost) => ({ ...cost }));
    cloned._preparedCosts = undefined;
    cloned._preparedTarget = undefined;
    cloned._castSnapshot = undefined;
    return cloned;
  }
}
