import { AttributeModifier, AttributeType, ModifierType } from '../core/types';

/**
 * 外部注入型二级属性（base=0，isFloat=true，完全由装备/Buff/命格提供）
 */
const EXTERNAL_SECONDARY_ATTRS = new Set<AttributeType>([
  AttributeType.ARMOR_PENETRATION,
  AttributeType.MAGIC_PENETRATION,
  AttributeType.CRIT_RESIST,
  AttributeType.CRIT_DAMAGE_REDUCTION,
  AttributeType.ACCURACY,
  AttributeType.HEAL_AMPLIFY,
]);

/**
 * 属性类 - 管理单个属性的基础值和修改器
 *
 * 修改器计算流程（6阶段）：
 * OVERRIDE（直接覆盖）> BASE(固定值或派生公式) → FIXED → ADD → MULTIPLY → FINAL
 *
 * 对于派生型属性（baseValueFn 存在），getBaseValue() 返回公式结算值，
 * setBaseValue() 无效（公式由构造时绑定，不可外部覆写）。
 */
class Attribute {
  readonly type: AttributeType;
  private _baseValue: number;
  private _baseValueFn?: () => number;
  private _modifiers: AttributeModifier[] = [];
  private _isFloat: boolean;

  constructor(
    type: AttributeType,
    baseValue: number,
    isFloat = false,
    baseValueFn?: () => number,
  ) {
    this.type = type;
    this._baseValue = baseValue;
    this._isFloat = isFloat;
    this._baseValueFn = baseValueFn;
  }

  /** 是否为派生型属性（base 由公式推算） */
  isDerived(): boolean {
    return !!this._baseValueFn;
  }

  private _computeBase(): number {
    return this._baseValueFn ? this._baseValueFn() : this._baseValue;
  }

  getFinalValue(): number {
    const override = this._modifiers.find((m) => m.type === ModifierType.OVERRIDE);
    if (override) {
      return this._isFloat
        ? Math.max(0, override.value)
        : Math.max(0, Math.floor(override.value));
    }

    let final = this._computeBase();

    // FIXED: 固定值加成（累加）
    final += this._modifiers
      .filter((m) => m.type === ModifierType.FIXED)
      .reduce((sum, m) => sum + m.value, 0);

    // ADD: 百分比加成（累加后乘）
    const addBonus = this._modifiers
      .filter((m) => m.type === ModifierType.ADD)
      .reduce((sum, m) => sum + m.value, 0);
    final *= 1 + addBonus;

    // MULTIPLY: 乘法叠加（累乘）
    const multBonus = this._modifiers
      .filter((m) => m.type === ModifierType.MULTIPLY)
      .reduce((product, m) => product * m.value, 1);
    final *= multBonus;

    // FINAL: 最终修正（取首个）
    const finalMod = this._modifiers.find((m) => m.type === ModifierType.FINAL);
    if (finalMod) final += finalMod.value;

    return this._isFloat ? Math.max(0, final) : Math.max(0, Math.floor(final));
  }

  /**
   * 返回不含 modifier 的基础值。
   * 派生属性返回公式结算值（即玩家面板的"底座"）。
   */
  getBaseValue(): number {
    return this._computeBase();
  }

  /**
   * 设置存储的基础值。
   * 派生属性（有 baseValueFn）调用此方法无效，其 base 由公式决定。
   */
  setBaseValue(value: number): void {
    if (this._baseValueFn) return;
    if (value < 0) throw new Error(`Base value cannot be negative: ${value}`);
    this._baseValue = value;
  }

  addModifier(modifier: AttributeModifier): void {
    this._modifiers.push(modifier);
  }

  removeModifier(modifierId: string): void {
    this._modifiers = this._modifiers.filter((m) => m.id !== modifierId);
  }

  clearModifiers(): void {
    this._modifiers = [];
  }

  getModifiers(): AttributeModifier[] {
    return [...this._modifiers];
  }

  setModifiers(modifiers: AttributeModifier[]): void {
    this._modifiers = modifiers;
  }
}

/**
 * 5维属性系统 + 派生二级属性体系
 *
 * 主属性（5维，整数，默认 10）：
 * - SPIRIT    (灵力)    — 法系输出、MP、护盾
 * - VITALITY  (体魄)    — 气血上限、物攻、物防
 * - SPEED     (身法)    — 出手顺序、暴击率基础、闪避率
 * - WILLPOWER (神识)    — 控制命中、控制抗性、法防
 * - WISDOM    (悟性)    — 暴击率加成、暴击伤害上限、MP上限
 *
 * 派生型二级属性（浮点，base=公式，modifier 可叠加）：
 * - ATK                物理攻击   = VITALITY×5
 * - DEF                物理防御   = VITALITY×3
 * - MAGIC_ATK          法术攻击   = SPIRIT×5
 * - MAGIC_DEF          法术防御   = WILLPOWER×3
 * - CRIT_RATE          暴击率     = min(0.60, 0.05 + SPEED×0.0002 + WISDOM×0.0001)
 * - CRIT_DAMAGE_MULT   暴击伤害   = min(2.00, 1.25 + WISDOM×0.0005)
 * - EVASION_RATE       闪避率     = min(0.50, SPEED×0.0003)
 * - CONTROL_HIT        控制命中   = min(0.80, WILLPOWER×0.0003)
 * - CONTROL_RESISTANCE 控制抗性   = min(0.80, WILLPOWER×0.0003)
 *
 * 外部注入型二级属性（浮点，base=0，由装备/Buff/命格提供）：
 * - ARMOR_PENETRATION、MAGIC_PENETRATION、CRIT_RESIST、CRIT_DAMAGE_REDUCTION、ACCURACY、HEAL_AMPLIFY
 */
export class AttributeSet {
  private _attributes = new Map<AttributeType, Attribute>();

  /**
   * Create a new AttributeSet with optional base values.
   * @param baseValues - Partial record of primary attribute base values
   */
  constructor(baseValues: Partial<Record<AttributeType, number>>) {
    // ── 主属性（5维，整数，默认 10）──
    const primaryAttrs = [
      AttributeType.SPIRIT,
      AttributeType.VITALITY,
      AttributeType.SPEED,
      AttributeType.WILLPOWER,
      AttributeType.WISDOM,
    ];
    for (const attrType of primaryAttrs) {
      this._attributes.set(
        attrType,
        new Attribute(attrType, baseValues[attrType] ?? 10, false),
      );
    }

    // ── 派生型二级属性（base 由主属性公式推算）──
    this._attributes.set(
      AttributeType.ATK,
      new Attribute(AttributeType.ATK, 0, true, () =>
        this.getValue(AttributeType.VITALITY) * 4 + this.getValue(AttributeType.SPEED) * 1,
      ),
    );

    this._attributes.set(
      AttributeType.DEF,
      new Attribute(AttributeType.DEF, 0, true, () =>
        this.getValue(AttributeType.VITALITY) * 2 + this.getValue(AttributeType.SPEED) * 1,
      ),
    );

    this._attributes.set(
      AttributeType.MAGIC_ATK,
      new Attribute(AttributeType.MAGIC_ATK, 0, true, () =>
        this.getValue(AttributeType.SPIRIT) * 4 + this.getValue(AttributeType.WILLPOWER) * 1,
      ),
    );

    this._attributes.set(
      AttributeType.MAGIC_DEF,
      new Attribute(AttributeType.MAGIC_DEF, 0, true, () =>
        this.getValue(AttributeType.SPIRIT) * 3 + this.getValue(AttributeType.WILLPOWER) * 1,
      ),
    );

    this._attributes.set(
      AttributeType.CRIT_RATE,
      new Attribute(AttributeType.CRIT_RATE, 0, true, () =>
        Math.min(
          0.6,
          0.05 +
            this.getValue(AttributeType.SPEED) * 0.0002 +
            this.getValue(AttributeType.WISDOM) * 0.0001,
        ),
      ),
    );

    this._attributes.set(
      AttributeType.CRIT_DAMAGE_MULT,
      new Attribute(AttributeType.CRIT_DAMAGE_MULT, 0, true, () =>
        Math.min(2.0, 1.25 + this.getValue(AttributeType.WISDOM) * 0.0005),
      ),
    );

    this._attributes.set(
      AttributeType.EVASION_RATE,
      new Attribute(AttributeType.EVASION_RATE, 0, true, () =>
        Math.min(0.5, this.getValue(AttributeType.SPEED) * 0.0003),
      ),
    );

    this._attributes.set(
      AttributeType.CONTROL_HIT,
      new Attribute(AttributeType.CONTROL_HIT, 0, true, () =>
        Math.min(0.8, this.getValue(AttributeType.WILLPOWER) * 0.0003),
      ),
    );

    this._attributes.set(
      AttributeType.CONTROL_RESISTANCE,
      new Attribute(AttributeType.CONTROL_RESISTANCE, 0, true, () =>
        Math.min(0.8, this.getValue(AttributeType.WILLPOWER) * 0.0003),
      ),
    );

    // ── 外部注入型二级属性（base=0）──
    for (const attrType of EXTERNAL_SECONDARY_ATTRS) {
      this._attributes.set(attrType, new Attribute(attrType, 0, true));
    }
  }

  /**
   * Get the final value of an attribute after applying all modifiers.
   * @param attrType - The attribute type to query
   * @returns The final attribute value (0 if attribute doesn't exist)
   */
  getValue(attrType: AttributeType): number {
    return this._attributes.get(attrType)?.getFinalValue() ?? 0;
  }

  /**
   * Get the base value of an attribute without modifiers.
   * For derived attributes, returns the formula-computed base (panel floor value).
   * @param attrType - The attribute type to query
   * @returns The base attribute value (0 if attribute doesn't exist)
   */
  getBaseValue(attrType: AttributeType): number {
    return this._attributes.get(attrType)?.getBaseValue() ?? 0;
  }

  /**
   * Set the base value of a primary attribute.
   * Has no effect on derived attributes (their base is formula-driven).
   * @param attrType - The attribute type to modify
   * @param value - The new base value (must be non-negative)
   */
  setBaseValue(attrType: AttributeType, value: number): void {
    this._attributes.get(attrType)?.setBaseValue(value);
  }

  /**
   * Add a modifier to an attribute.
   * @param modifier - The modifier to add
   */
  addModifier(modifier: AttributeModifier): void {
    this._attributes.get(modifier.attrType)?.addModifier(modifier);
  }

  /**
   * Remove a modifier from all attributes by its ID.
   * @param modifierId - The ID of the modifier to remove
   */
  removeModifier(modifierId: string): void {
    this._attributes.forEach((attr) => attr.removeModifier(modifierId));
  }

  /**
   * Remove modifiers by source object reference.
   * @param source - The source object to match
   */
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  removeModifierBySource(source: any): void {
    this._attributes.forEach((attr) => {
      attr.setModifiers(attr.getModifiers().filter((m) => m.source !== source));
    });
  }

  /**
   * Clear all modifiers from all attributes.
   */
  clearModifiers(): void {
    this._attributes.forEach((attr) => attr.clearModifiers());
  }

  /**
   * Get all final attribute values as a record.
   * @returns Record mapping attribute types to their final values
   */
  getAllValues(): Record<AttributeType, number> {
    const result = {} as Record<AttributeType, number>;
    this._attributes.forEach((attr, type) => {
      result[type] = attr.getFinalValue();
    });
    return result;
  }

  /**
   * HP = 200 + VITALITY×12 + SPIRIT×4
   */
  getMaxHp(): number {
    return (
      200 +
      this.getValue(AttributeType.VITALITY) * 16
    );
  }

  /**
   * MP = 100 + SPIRIT×5 + WISDOM×3
   */
  getMaxMp(): number {
    return (
      100 +
      this.getValue(AttributeType.SPIRIT) * 5 +
      this.getValue(AttributeType.WILLPOWER) * 3
    );
  }

  /**
   * Create a deep clone of this AttributeSet.
   * Derived attribute formulas are re-bound automatically via constructor.
   * Only primary attribute base values and all modifiers need to be copied.
   */
  clone(): AttributeSet {
    const cloned = new AttributeSet({});
    this._attributes.forEach((attr, type) => {
      // Only copy base values for primary (non-derived) attributes
      if (!attr.isDerived()) {
        cloned.setBaseValue(type, attr.getBaseValue());
      }
      // Always copy all modifiers (Buff-applied modifiers affect any attribute)
      attr.getModifiers().forEach((mod) => cloned.addModifier({ ...mod }));
    });
    return cloned;
  }
}
