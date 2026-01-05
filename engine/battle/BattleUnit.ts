import { BuffManager, buffRegistry } from '@/engine/buff';
import type { BuffInstanceState } from '@/engine/buff/types';
import { BuffTag } from '@/engine/buff/types';
import { EffectTrigger, type IBaseEffect } from '@/engine/effect/types';
import type { StatusEffect } from '@/types/constants';
import type { Attributes, Cultivator, Skill } from '@/types/cultivator';
import { calculateFinalAttributes as calcFinalAttrs } from '@/utils/cultivatorUtils';
import { effectEngine } from '../effect';
import type { UnitId } from './types';

/**
 * 战斗单元
 * 实现 Entity 接口，属性计算完全通过 EffectEngine
 */
export class BattleUnit {
  // ===== Entity 接口属性 =====
  readonly id: string;
  readonly name: string;

  // ===== 基础标识 =====
  readonly unitId: UnitId;
  readonly cultivatorData: Cultivator;

  // ===== 动态战斗属性 =====
  currentHp: number;
  currentMp: number;
  maxHp: number;
  maxMp: number;

  // ===== Buff 管理 =====
  readonly buffManager: BuffManager;

  // ===== 技能冷却 =====
  skillCooldowns: Map<string, number>;

  // ===== 行动状态 =====
  isDefending: boolean;

  // ===== 属性缓存 =====
  private cachedAttributes?: Attributes;
  private attributesDirty: boolean = true;

  // ===== 基础 maxHp/maxMp =====
  private baseMaxHp: number;
  private baseMaxMp: number;

  constructor(
    unitId: UnitId,
    cultivatorData: Cultivator,
    hpLossPercent?: number,
    mpLossPercent?: number,
    initialBuffs?: BuffInstanceState[],
  ) {
    this.unitId = unitId;
    this.id = unitId;
    this.name = cultivatorData.name;
    this.cultivatorData = cultivatorData;
    this.isDefending = false;

    // 初始化 BuffManager
    this.buffManager = new BuffManager(this);

    // 计算基础最大 HP/MP
    const baseAttrs = calcFinalAttrs(cultivatorData);
    this.baseMaxHp = baseAttrs.maxHp;
    this.baseMaxMp = baseAttrs.maxMp;
    this.maxHp = this.baseMaxHp;
    this.maxMp = this.baseMaxMp;

    // 加载初始 Buff（如有）
    if (initialBuffs && initialBuffs.length > 0) {
      this.loadInitialBuffs(initialBuffs);
      this.recalculateMaxHpMp();
    }

    // 根据损失百分比计算初始 HP/MP
    const hpLoss = hpLossPercent ?? 0;
    const mpLoss = mpLossPercent ?? 0;
    this.currentHp = Math.max(1, Math.floor(this.maxHp * (1 - hpLoss)));
    this.currentMp = Math.max(0, Math.floor(this.maxMp * (1 - mpLoss)));

    // 初始化技能冷却
    this.skillCooldowns = new Map();
    for (const skill of cultivatorData.skills) {
      if (skill.id) {
        this.skillCooldowns.set(skill.id, 0);
      }
    }

    // 装备武器冷却
    if (cultivatorData.equipped.weapon) {
      this.skillCooldowns.set(cultivatorData.equipped.weapon, 0);
    }
  }

  // ============================================================
  // Entity 接口实现
  // ============================================================

  getAttribute(key: string): number {
    const attrs = this.getFinalAttributes();
    return (attrs as unknown as Record<string, number>)[key] ?? 0;
  }

  setAttribute(_key: string, _value: number): void {
    // 战斗中属性由 Buff 系统管理
  }

  collectAllEffects(): IBaseEffect[] {
    return this.buffManager.getAllEffects();
  }

  // ============================================================
  // 属性计算 - 完全通过 EffectEngine
  // ============================================================

  /**
   * 获取最终属性（基础 + 装备 + Buff 修正）
   * 使用 EffectEngine.process(ON_STAT_CALC) 管道
   */
  getFinalAttributes(): Attributes {
    if (this.attributesDirty || !this.cachedAttributes) {
      const baseWithEquipment = calcFinalAttrs(this.cultivatorData).final;

      // 使用 EffectEngine 计算每个属性
      const statNames = [
        'vitality',
        'spirit',
        'wisdom',
        'speed',
        'willpower',
      ] as const;
      const result: Attributes = { ...baseWithEquipment };

      for (const statName of statNames) {
        const baseValue = baseWithEquipment[statName];
        const finalValue = effectEngine.process(
          EffectTrigger.ON_STAT_CALC,
          this,
          undefined,
          baseValue,
          { statName },
        );
        result[statName] = Math.floor(finalValue);
      }

      this.cachedAttributes = result;
      this.attributesDirty = false;
    }

    return this.cachedAttributes;
  }

  /**
   * 重新计算 maxHp/maxMp
   */
  private recalculateMaxHpMp(): void {
    // 使用 EffectEngine 计算 maxHp 修正
    const hpMod = effectEngine.process(
      EffectTrigger.ON_STAT_CALC,
      this,
      undefined,
      0,
      { statName: 'maxHp' },
    );

    // 应用百分比修正
    this.maxHp = Math.max(1, Math.floor(this.baseMaxHp * (1 + hpMod)));
    this.maxMp = Math.max(0, this.baseMaxMp);

    // 确保 hp/mp 不超过新的最大值
    this.currentHp = Math.min(this.currentHp, this.maxHp);
    this.currentMp = Math.min(this.currentMp, this.maxMp);
  }

  markAttributesDirty(): void {
    this.attributesDirty = true;
    this.recalculateMaxHpMp();
  }

  // ============================================================
  // Buff 操作
  // ============================================================

  private loadInitialBuffs(states: BuffInstanceState[]): void {
    for (const state of states) {
      const config = buffRegistry.get(state.configId);
      if (!config) continue;
      this.buffManager.addBuff(config, this, {
        initialStacks: state.currentStacks,
        durationOverride: state.remainingTurns,
      });
    }
  }

  hasBuff(buffId: string): boolean {
    return this.buffManager.hasBuff(buffId);
  }

  hasStatus(statusKey: StatusEffect): boolean {
    return this.buffManager.hasBuff(statusKey);
  }

  getActiveBuffIds(): string[] {
    return this.buffManager.getActiveBuffs().map((b) => b.config.id);
  }

  getActiveStatusEffects(): StatusEffect[] {
    return this.getActiveBuffIds() as StatusEffect[];
  }

  exportPersistentBuffs(): BuffInstanceState[] {
    return this.buffManager
      .getBuffsByTag(BuffTag.PERSISTENT)
      .map((b) => b.toState());
  }

  clearTemporaryBuffs(): void {
    const persistentIds = this.buffManager
      .getBuffsByTag(BuffTag.PERSISTENT)
      .map((b) => b.config.id);

    for (const buff of this.buffManager.getActiveBuffs()) {
      if (!persistentIds.includes(buff.config.id)) {
        this.buffManager.removeBuff(buff.config.id);
      }
    }
  }

  // ============================================================
  // DOT 处理 - 通过 EffectEngine
  // ============================================================

  /**
   * 处理回合开始的 DOT 伤害
   * 使用 EffectEngine.process(ON_TURN_START)
   */
  processTurnStartEffects(): { dotDamage: number; logs: string[] } {
    const logs: string[] = [];
    let totalDotDamage = 0;

    // 收集所有 DOT Buff
    const dotBuffs = this.buffManager
      .getActiveBuffs()
      .filter((buff) =>
        buff.config.effects.some((e) => e.type === 'DotDamage'),
      );

    for (const buff of dotBuffs) {
      // 使用 EffectEngine 计算 DOT 伤害
      const ctx = effectEngine.processWithContext(
        EffectTrigger.ON_TURN_START,
        this,
        this,
        0,
        {
          casterSnapshot: buff.casterSnapshot,
          buffStacks: buff.currentStacks,
        },
      );

      const damage = Math.floor(ctx.value ?? 0);
      if (damage > 0) {
        totalDotDamage += damage;
        logs.push(
          buff.currentStacks > 1
            ? `${this.name} 受到「${buff.config.name}」影响（${buff.currentStacks}层），损失 ${damage} 点气血`
            : `${this.name} 受到「${buff.config.name}」影响，损失 ${damage} 点气血`,
        );
      }
    }

    return { dotDamage: totalDotDamage, logs };
  }

  // ============================================================
  // 战斗操作
  // ============================================================

  applyDamage(damage: number): number {
    const actualDamage = Math.max(0, Math.floor(damage));
    this.currentHp = Math.max(0, this.currentHp - actualDamage);
    return actualDamage;
  }

  applyHealing(heal: number): number {
    const actualHeal = Math.max(0, Math.floor(heal));
    const oldHp = this.currentHp;
    this.currentHp = Math.min(this.currentHp + actualHeal, this.maxHp);
    return this.currentHp - oldHp;
  }

  consumeMp(cost: number): boolean {
    if (cost <= 0) return true;
    if (this.currentMp < cost) return false;
    this.currentMp = Math.max(0, this.currentMp - cost);
    return true;
  }

  restoreMp(amount: number): number {
    const actualRestore = Math.max(0, Math.floor(amount));
    const oldMp = this.currentMp;
    this.currentMp = Math.min(this.currentMp + actualRestore, this.maxMp);
    return this.currentMp - oldMp;
  }

  canUseSkill(skill: Skill): boolean {
    if (this.hasBuff('silence')) {
      return false;
    }
    const cd = this.skillCooldowns.get(skill.id!) ?? 0;
    if (cd > 0) {
      return false;
    }
    const cost = skill.cost ?? 0;
    if (cost > 0 && this.currentMp < cost) {
      return false;
    }
    return true;
  }

  tickCooldowns(): void {
    for (const [skillId, cd] of this.skillCooldowns.entries()) {
      if (cd > 0) {
        this.skillCooldowns.set(skillId, cd - 1);
      }
    }
  }

  setCooldown(skillId: string, cooldown: number): void {
    this.skillCooldowns.set(skillId, cooldown);
  }

  isAlive(): boolean {
    return this.currentHp > 0;
  }

  getName(): string {
    return this.cultivatorData.name;
  }

  createCasterSnapshot(): {
    casterId: string;
    casterName: string;
    attributes: Attributes;
    elementMultipliers: Record<string, number>;
  } {
    const finalAttrs = this.getFinalAttributes();
    const elementMultipliers: Record<string, number> = {};

    for (const root of this.cultivatorData.spiritual_roots) {
      elementMultipliers[root.element] = 1.0 + (root.strength / 100) * 0.5;
    }

    return {
      casterId: this.unitId,
      casterName: this.cultivatorData.name,
      attributes: finalAttrs,
      elementMultipliers,
    };
  }

  /**
   * 获取 Buff 提供的暴击率加成
   */
  getCritRateBonus(): number {
    let bonus = 0;
    if (this.hasBuff('crit_rate_up')) bonus += 0.15;
    if (this.hasBuff('crit_rate_down')) bonus -= 0.15;
    return bonus;
  }

  /**
   * 获取 Buff 提供的减伤修正
   */
  getDamageReductionBonus(): number {
    let bonus = 0;
    if (this.hasBuff('armor_up')) bonus += 0.15;
    if (this.hasBuff('armor_down')) bonus -= 0.15;
    if (this.isDefending) bonus += 0.5;
    return bonus;
  }
}
