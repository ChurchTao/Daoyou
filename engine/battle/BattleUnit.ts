import { BuffManager, buffRegistry } from '@/engine/buff';
import type { BuffInstanceState } from '@/engine/buff/types';
import { BuffTag } from '@/engine/buff/types';
import {
  EffectTrigger,
  EffectType,
  type IBaseEffect,
} from '@/engine/effect/types';
import type { StatusEffect } from '@/types/constants';
import type { Attributes, Cultivator, Skill } from '@/types/cultivator';
import { calculateFinalAttributes as calcFinalAttrs } from '@/utils/cultivatorUtils';
import {
  CriticalEffect,
  DamageReductionEffect,
  effectEngine,
  EffectFactory,
} from '../effect';
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
    const effects: IBaseEffect[] = [];

    // 0. 基础战斗效果（暂击、减伤）
    effects.push(this.getBaseCritEffect());
    effects.push(this.getBaseDamageReductionEffect());

    // 1. Buff 效果
    effects.push(...this.buffManager.getAllEffects());

    // 2. 装备效果
    effects.push(...this.getEquipmentEffects());

    // 3. 功法效果
    effects.push(...this.getCultivationEffects());

    // 4. 命格效果
    effects.push(...this.getFateEffects());

    return effects;
  }

  /**
   * 获取基础暂击效果
   * 基础暂击率 5%，基础暂击伤害 1.5x
   * 装备/功法/命格可通过 StatModifierEffect 修改 critRate/critDamage 属性
   */
  private getBaseCritEffect(): CriticalEffect {
    return new CriticalEffect();
  }

  /**
   * 获取基础减伤效果
   * 无基础减伤，依赖装备/功法/命格通过 StatModifierEffect 提供
   */
  private getBaseDamageReductionEffect(): DamageReductionEffect {
    return new DamageReductionEffect({
      flatReduction: 0,
      percentReduction: 0,
      maxReduction: 0.75,
    });
  }

  /**
   * 获取装备提供的效果
   */
  private getEquipmentEffects(): IBaseEffect[] {
    const effects: IBaseEffect[] = [];
    const { equipped, inventory } = this.cultivatorData;

    // 获取已装备的法宝 ID 列表
    const equippedIds = [
      equipped.weapon,
      equipped.armor,
      equipped.accessory,
    ].filter(Boolean) as string[];

    // 创建法宝 ID -> 法宝对象的映射
    const artifactsById = new Map(inventory.artifacts.map((a) => [a.id!, a]));

    // 遍历已装备的法宝，收集效果
    for (const id of equippedIds) {
      const artifact = artifactsById.get(id);
      if (!artifact?.effects) continue;

      // 使用 EffectFactory 创建效果实例
      for (const effectConfig of artifact.effects) {
        try {
          const effect = EffectFactory.create(effectConfig);
          effects.push(effect);
        } catch (err) {
          console.warn(`[BattleUnit] 加载装备效果失败: ${artifact.name}`, err);
        }
      }
    }

    return effects;
  }

  /**
   * 获取功法提供的效果
   */
  private getCultivationEffects(): IBaseEffect[] {
    const effects: IBaseEffect[] = [];
    const { cultivations } = this.cultivatorData;

    for (const technique of cultivations) {
      if (!technique.effects) continue;

      for (const effectConfig of technique.effects) {
        try {
          const effect = EffectFactory.create(effectConfig);
          effects.push(effect);
        } catch (err) {
          console.warn(`[BattleUnit] 加载功法效果失败: ${technique.name}`, err);
        }
      }
    }

    return effects;
  }

  /**
   * 获取命格提供的效果
   * 将 attribute_mod 转换为 StatModifierEffect
   */
  private getFateEffects(): IBaseEffect[] {
    const effects: IBaseEffect[] = [];
    const { pre_heaven_fates } = this.cultivatorData;

    for (const fate of pre_heaven_fates) {
      if (!fate.effects) continue;
      for (const effectConfig of fate.effects) {
        try {
          const effect = EffectFactory.create(effectConfig);
          effects.push(effect);
        } catch (err) {
          console.warn(`[BattleUnit] 加载命格效果失败: ${fate.name}`, err);
        }
      }
    }

    return effects;
  }

  // ============================================================
  // 属性计算 - 完全通过 EffectEngine
  // ============================================================
  /**
   * 获取最终属性（基础 + 装备 + Buff 修正）
   * 使用 EffectEngine.process(ON_STAT_CALC) 管道
   * 计算所有效果需要的属性，包括暴击、减伤等
   */
  getFinalAttributes(): Attributes {
    if (this.attributesDirty || !this.cachedAttributes) {
      const baseAttrs = this.cultivatorData.attributes;

      // 基础五维属性
      const coreStats = [
        'vitality',
        'spirit',
        'wisdom',
        'speed',
        'willpower',
      ] as const;

      // 战斗相关属性（基础值为 0，完全由装备/功法/命格/Buff 提供）
      const combatStats = [
        'critRate', // 暴击率加成
        'critDamage', // 暴击伤害加成
        'damageReduction', // 百分比减伤
        'flatDamageReduction', // 固定减伤
        'hitRate', // 命中率加成
        'dodgeRate', // 闪避率加成
      ] as const;

      const result: Attributes = { ...baseAttrs };

      // 计算基础五维
      for (const statName of coreStats) {
        const baseValue = baseAttrs[statName];
        const finalValue = effectEngine.process(
          EffectTrigger.ON_STAT_CALC,
          this,
          undefined,
          baseValue,
          { statName },
        );
        result[statName] = Math.floor(finalValue);
      }

      // 计算战斗属性（基础值 0）
      for (const statName of combatStats) {
        const finalValue = effectEngine.process(
          EffectTrigger.ON_STAT_CALC,
          this,
          undefined,
          0, // 基础值为 0
          { statName },
        );
        // 战斗属性保留小数（如暴击率 0.15 = 15%）
        (result as unknown as Record<string, number>)[statName] = finalValue;
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
      this.buffManager.addBuff(config, this, 0, {
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
        buff.config.effects.some((e) => e.type === EffectType.DotDamage),
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
}
