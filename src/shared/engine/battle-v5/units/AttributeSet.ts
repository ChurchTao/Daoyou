import { AttributeModifier, AttributeType, ModifierType } from '../core/types';

/**
 * 外部注入型二级属性（base=0，isFloat=true，完全由装备/Buff/命格提供）
 */
const EXTERNAL_SECONDARY_ATTRS = new Set<AttributeType>([
  AttributeType.ARMOR_PENETRATION,
  AttributeType.MAGIC_PENETRATION,
  AttributeType.CRIT_RESIST,
  AttributeType.CRIT_DAMAGE_REDUCTION,
  AttributeType.HEAL_AMPLIFY,
  AttributeType.HEAL_RECEIVED_REDUCTION,
]);

function curve(x: number, scale: number, cap: number): number {
  const value = Math.max(0, x);
  return cap * value / (value + scale);
}

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
    const override = this._modifiers.find(
      (m) => m.type === ModifierType.OVERRIDE,
    );
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
 * 六维属性系统 + 派生二级属性体系
 *
 * 主属性（六维，整数，默认 10）：
 * - VITALITY  (体魄)    — 气血上限、少量法术防御
 * - STRENGTH  (力道)    — 物理攻击
 * - SPIRIT    (灵力)    — 法术攻击、少量法力
 * - ENDURANCE (根骨)    — 物理防御、少量气血上限
 * - SPEED     (身法)    — 行动速度、闪避率、命中
 * - WILLPOWER (神识)    — 法防、法力、控制命中与抗性
 *
 * 派生型二级属性（浮点，base=公式，modifier 可叠加）：
 * - ATK                物理攻击   = 40 + STRENGTH×3.5
 * - DEF                物理防御   = 10 + ENDURANCE×1.75
 * - MAGIC_ATK          法术攻击   = 40 + SPIRIT×3.5
 * - MAGIC_DEF          法术防御   = 10 + WILLPOWER×1.75 + VITALITY×0.25
 * - ACTION_SPEED       行动速度   = SPEED
 * - CRIT_RATE          暴击率     = 0.05
 * - CRIT_DAMAGE_MULT   暴击伤害   = 1.5
 * - EVASION_RATE       闪避率     = 0.02 + curve(SPEED, 240, 0.24)
 * - ACCURACY           命中       = 0.05 + curve(SPEED, 240, 0.27)
 * - CONTROL_HIT        控制命中   = 0.04 + curve(WILLPOWER, 240, 0.30)
 * - CONTROL_RESISTANCE 控制抗性   = 0.04 + curve(WILLPOWER, 240, 0.34)
 * - MAX_HP             最大气血   = 400 + VITALITY×20 + ENDURANCE×3
 * - MAX_MP             最大法力   = 200 + SPIRIT×4 + WILLPOWER×10
 *
 * 外部注入型二级属性（浮点，base=0，由装备/Buff/命格提供）：
 * - ARMOR_PENETRATION、MAGIC_PENETRATION、CRIT_RESIST、CRIT_DAMAGE_REDUCTION、HEAL_AMPLIFY
 */
export class AttributeSet {
  private _attributes = new Map<AttributeType, Attribute>();

  /**
   * Create a new AttributeSet with optional base values.
   * @param baseValues - Partial record of primary attribute base values
   */
  constructor(baseValues: Partial<Record<AttributeType, number>>) {
    // ── 主属性（六维，整数，默认 10）──
    const primaryAttrs = [
      AttributeType.VITALITY,
      AttributeType.STRENGTH,
      AttributeType.SPIRIT,
      AttributeType.ENDURANCE,
      AttributeType.SPEED,
      AttributeType.WILLPOWER,
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
      new Attribute(
        AttributeType.ATK,
        0,
        true,
        () =>
          Math.floor(
            40 + this.getValue(AttributeType.STRENGTH) * 3.5,
          ),
      ),
    );

    this._attributes.set(
      AttributeType.DEF,
      new Attribute(
        AttributeType.DEF,
        0,
        true,
        () =>
          Math.floor(
            10 + this.getValue(AttributeType.ENDURANCE) * 1.75,
          ),
      ),
    );

    this._attributes.set(
      AttributeType.MAGIC_ATK,
      new Attribute(
        AttributeType.MAGIC_ATK,
        0,
        true,
        () =>
          Math.floor(
            40 + this.getValue(AttributeType.SPIRIT) * 3.5,
          ),
      ),
    );

    this._attributes.set(
      AttributeType.MAGIC_DEF,
      new Attribute(
        AttributeType.MAGIC_DEF,
        0,
        true,
        () =>
          Math.floor(
            10 +
              this.getValue(AttributeType.WILLPOWER) * 1.75 +
              this.getValue(AttributeType.VITALITY) * 0.25,
          ),
      ),
    );

    this._attributes.set(
      AttributeType.ACTION_SPEED,
      new Attribute(
        AttributeType.ACTION_SPEED,
        0,
        true,
        () => this.getValue(AttributeType.SPEED),
      ),
    );

    this._attributes.set(
      AttributeType.CRIT_RATE,
      new Attribute(AttributeType.CRIT_RATE, 0, true, () => 0.05),
    );

    this._attributes.set(
      AttributeType.CRIT_DAMAGE_MULT,
      new Attribute(AttributeType.CRIT_DAMAGE_MULT, 0, true, () => 1.5),
    );

    this._attributes.set(
      AttributeType.EVASION_RATE,
      new Attribute(AttributeType.EVASION_RATE, 0, true, () =>
        0.02 + curve(this.getValue(AttributeType.SPEED), 240, 0.24),
      ),
    );

    this._attributes.set(
      AttributeType.ACCURACY,
      new Attribute(AttributeType.ACCURACY, 0, true, () =>
        0.05 + curve(this.getValue(AttributeType.SPEED), 240, 0.27),
      ),
    );

    this._attributes.set(
      AttributeType.CONTROL_HIT,
      new Attribute(AttributeType.CONTROL_HIT, 0, true, () =>
        0.04 + curve(this.getValue(AttributeType.WILLPOWER), 240, 0.30),
      ),
    );

    this._attributes.set(
      AttributeType.CONTROL_RESISTANCE,
      new Attribute(AttributeType.CONTROL_RESISTANCE, 0, true, () =>
        0.04 + curve(this.getValue(AttributeType.WILLPOWER), 240, 0.34),
      ),
    );

    this._attributes.set(
      AttributeType.MAX_HP,
      new Attribute(
        AttributeType.MAX_HP,
        0,
        false,
        () =>
          Math.floor(
            400 +
              this.getValue(AttributeType.VITALITY) * 20 +
              this.getValue(AttributeType.ENDURANCE) * 3,
          ),
      ),
    );

    this._attributes.set(
      AttributeType.MAX_MP,
      new Attribute(
        AttributeType.MAX_MP,
        0,
        false,
        () =>
          Math.floor(
            200 +
              this.getValue(AttributeType.SPIRIT) * 4 +
              this.getValue(AttributeType.WILLPOWER) * 10,
          ),
      ),
    );

    // ── 外部注入型二级属性（base=0）──
    for (const attrType of EXTERNAL_SECONDARY_ATTRS) {
      this._attributes.set(attrType, new Attribute(attrType, 0, true));
    }
  }

  /**
   * Get all base attribute values as a record.
   * For derived attributes, returns the formula-computed base.
   * @returns Record mapping attribute types to their base values
   */
  getAllBaseValues(): Record<AttributeType, number> {
    const result = {} as Record<AttributeType, number>;
    this._attributes.forEach((attr, type) => {
      result[type] = attr.getBaseValue();
    });
    return result;
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

  getModifiers(): AttributeModifier[] {
    return [...this._attributes.values()].flatMap((attribute) =>
      attribute.getModifiers(),
    );
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
   * 气血 = 340 + VITALITY×16.2
   */
  getMaxHp(): number {
    return this.getValue(AttributeType.MAX_HP);
  }

  /**
   * 法力 = 200 + SPIRIT×10.8 + WILLPOWER×5.4
   */
  getMaxMp(): number {
    return this.getValue(AttributeType.MAX_MP);
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
