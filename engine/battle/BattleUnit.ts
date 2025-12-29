import { StatusContainer } from '@/engine/status/StatusContainer';
import type {
  CalculationContext,
  CasterSnapshot,
  UnitSnapshot,
} from '@/engine/status/types';
import type { StatusEffect } from '@/types/constants';
import type { Attributes, Cultivator, Skill } from '@/types/cultivator';
import { calculateFinalAttributes as calcFinalAttrs } from '@/utils/cultivatorUtils';
import { attributeCalculator } from './calculators/AttributeCalculator';
import type { UnitId } from './types';

/**
 * 战斗单元
 * 封装战斗中的单位状态，集成状态容器
 */
export class BattleUnit {
  // 基础标识
  readonly unitId: UnitId;
  readonly cultivatorData: Cultivator;

  // 动态战斗属性
  currentHp: number;
  currentMp: number;
  maxHp: number;
  maxMp: number;

  // 状态管理
  readonly statusContainer: StatusContainer;

  // 技能冷却
  skillCooldowns: Map<string, number>;

  // 行动状态
  isDefending: boolean;

  // 属性缓存（性能优化）
  private cachedAttributes?: Attributes;
  private attributesDirty: boolean = true;

  // 基础maxHp/maxMp（用于计算修正）
  private baseMaxHp!: number;
  private baseMaxMp!: number;

  constructor(
    unitId: UnitId,
    cultivatorData: Cultivator,
    hpLossPercent?: number, // HP损失百分比，0-1之间
    mpLossPercent?: number, // MP损失百分比，0-1之间
    initialStatuses?: Array<{
      statusKey: string;
      potency: number;
      createdAt: number;
      metadata: Record<string, unknown>;
    }>,
  ) {
    this.unitId = unitId;
    this.cultivatorData = cultivatorData;
    this.statusContainer = new StatusContainer();
    this.isDefending = false;

    // 计算基础最大HP/MP
    const baseAttrs = calcFinalAttrs(cultivatorData);
    this.baseMaxHp = baseAttrs.maxHp;
    this.baseMaxMp = baseAttrs.maxMp;
    this.maxHp = this.baseMaxHp;
    this.maxMp = this.baseMaxMp;

    // 加载初始状态（如有）
    if (initialStatuses && initialStatuses.length > 0) {
      this.statusContainer.loadPersistentStatuses(
        initialStatuses,
        this.createUnitSnapshot(),
      );
      // 重新计算maxHp/maxMp以应用状态修正
      this.updateMaxHpMp();
    }

    // 根据损失百分比计算初始HP/MP
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

    // 如果有装备武器，也要初始化武器冷却
    if (cultivatorData.equipped.weapon) {
      this.skillCooldowns.set(cultivatorData.equipped.weapon, 0);
    }
  }

  /**
   * 获取最终属性（基础+装备+状态修正）
   */
  getFinalAttributes(): Attributes {
    if (this.attributesDirty || !this.cachedAttributes) {
      // 获取基础属性+装备加成
      const baseWithEquipment = calcFinalAttrs(this.cultivatorData).final;

      // 获取状态修正
      const statusMods = this.getStatusModifications();

      // 应用状态修正
      this.cachedAttributes = attributeCalculator.applyStatusModifications(
        baseWithEquipment,
        statusMods,
      );

      this.attributesDirty = false;
    }

    return this.cachedAttributes;
  }

  /**
   * 获取状态修正
   */
  private getStatusModifications(): Partial<Attributes> {
    const context: CalculationContext = {
      target: this.createUnitSnapshot(),
      battleContext: {
        turnNumber: 0, // 由外部设置
        isPlayerTurn: this.unitId === 'player',
      },
    };

    const mods = this.statusContainer.calculateAttributeModifications(context);

    return {
      vitality: mods.vitality,
      spirit: mods.spirit,
      wisdom: mods.wisdom,
      speed: mods.speed,
      willpower: mods.willpower,
    };
  }

  /**
   * 标记属性为脏（需要重新计算）
   */
  markAttributesDirty(): void {
    this.attributesDirty = true;
    this.updateMaxHpMp();
  }

  /**
   * 更新maxHp和maxMp（基于状态修正）
   */
  private updateMaxHpMp(): void {
    const context: CalculationContext = {
      target: this.createUnitSnapshot(),
      battleContext: {
        turnNumber: 0,
        isPlayerTurn: this.unitId === 'player',
      },
    };

    const mods = this.statusContainer.calculateAttributeModifications(context);

    // 应用maxHp修正
    this.maxHp = this.baseMaxHp + (mods.maxHp ?? 0);
    this.maxHp = Math.max(1, Math.floor(this.maxHp)); // 确保至少1

    // 应用maxMp修正
    this.maxMp = this.baseMaxMp + (mods.maxMp ?? 0);
    this.maxMp = Math.max(0, Math.floor(this.maxMp));

    // 确保hp/mp不超过新的最大值
    this.currentHp = Math.min(this.currentHp, this.maxHp);
    this.currentMp = Math.min(this.currentMp, this.maxMp);
  }

  /**
   * 创建单元快照（供状态系统使用）
   */
  createUnitSnapshot(): UnitSnapshot {
    const baseAttrs = calcFinalAttrs(this.cultivatorData).final;

    return {
      unitId: this.unitId,
      currentHp: this.currentHp,
      currentMp: this.currentMp,
      maxHp: this.maxHp,
      maxMp: this.maxMp,
      baseAttributes: baseAttrs,
    };
  }

  /**
   * 创建施法者快照（供状态系统使用）
   */
  createCasterSnapshot(): CasterSnapshot {
    const finalAttrs = this.getFinalAttributes();

    // 计算元素倍率
    const elementMultipliers: Partial<Record<string, number>> = {};
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
   * 应用伤害
   */
  applyDamage(damage: number): number {
    const actualDamage = Math.max(0, Math.floor(damage));
    this.currentHp = Math.max(0, this.currentHp - actualDamage);
    return actualDamage;
  }

  /**
   * 应用治疗
   */
  applyHealing(heal: number): number {
    const actualHeal = Math.max(0, Math.floor(heal));
    const oldHp = this.currentHp;
    this.currentHp = Math.min(this.currentHp + actualHeal, this.maxHp);
    return this.currentHp - oldHp;
  }

  /**
   * 消耗灵力
   */
  consumeMp(cost: number): boolean {
    if (cost <= 0) return true;
    if (this.currentMp < cost) return false;

    this.currentMp = Math.max(0, this.currentMp - cost);
    return true;
  }

  /**
   * 恢复灵力
   */
  restoreMp(amount: number): number {
    const actualRestore = Math.max(0, Math.floor(amount));
    const oldMp = this.currentMp;
    this.currentMp = Math.min(this.currentMp + actualRestore, this.maxMp);
    return this.currentMp - oldMp;
  }

  /**
   * 检查是否可使用技能
   */
  canUseSkill(skill: Skill): boolean {
    // 检查沉默状态
    if (this.statusContainer.hasStatus('silence') && skill.type !== 'heal') {
      return false;
    }

    // 检查冷却
    const cd = this.skillCooldowns.get(skill.id!) ?? 0;
    if (cd > 0) {
      return false;
    }

    // 检查MP是否足够
    const cost = skill.cost ?? 0;
    if (cost > 0 && this.currentMp < cost) {
      return false;
    }

    return true;
  }

  /**
   * 递减技能冷却
   */
  tickCooldowns(): void {
    for (const [skillId, cd] of this.skillCooldowns.entries()) {
      if (cd > 0) {
        this.skillCooldowns.set(skillId, cd - 1);
      }
    }
  }

  /**
   * 设置技能冷却
   */
  setCooldown(skillId: string, cooldown: number): void {
    this.skillCooldowns.set(skillId, cooldown);
  }

  /**
   * 检查是否有特定状态
   */
  hasStatus(statusKey: StatusEffect): boolean {
    return this.statusContainer.hasStatus(statusKey);
  }

  /**
   * 检查是否存活
   */
  isAlive(): boolean {
    return this.currentHp > 0;
  }

  /**
   * 获取当前状态效果列表（用于快照）
   */
  getActiveStatusEffects(): StatusEffect[] {
    return this.statusContainer.getActiveStatuses().map((s) => s.statusKey);
  }

  /**
   * 获取单元名称
   */
  getName(): string {
    return this.cultivatorData.name;
  }
}
