import { AttributeModifier, AttributeType, ModifierType } from '../core/types';

/**
 * Represents a single attribute with base value and modifiers.
 * Modifiers are applied in 6 stages: BASE → FIXED → ADD → MULTIPLY → FINAL → OVERRIDE
 */
class Attribute {
  readonly type: AttributeType;
  private _baseValue: number;
  private _modifiers: AttributeModifier[] = [];

  constructor(type: AttributeType, baseValue: number) {
    this.type = type;
    this._baseValue = baseValue;
  }

  /**
   * Calculate the final value after applying all modifiers.
   * Modifiers are applied in 6 stages: BASE → FIXED → ADD → MULTIPLY → FINAL → OVERRIDE
   * @returns The final attribute value (non-negative)
   */
  getFinalValue(): number {
    // 6阶段计算: BASE → FIXED → ADD → MULTIPLY → FINAL → OVERRIDE
    let final = this._baseValue;

    // FIXED: 固定值加成
    final += this._modifiers
      .filter((m) => m.type === ModifierType.FIXED)
      .reduce((sum, m) => sum + m.value, 0);

    // ADD: 百分比加成
    const addBonus = this._modifiers
      .filter((m) => m.type === ModifierType.ADD)
      .reduce((sum, m) => sum + m.value, 0);
    final *= 1 + addBonus;

    // MULTIPLY: 乘法叠加
    const multBonus = this._modifiers
      .filter((m) => m.type === ModifierType.MULTIPLY)
      .reduce((product, m) => product * m.value, 1);
    final *= multBonus;

    // FINAL: 最终修正
    const finalMod = this._modifiers.find((m) => m.type === ModifierType.FINAL);
    if (finalMod) {
      final += finalMod.value;
    }

    // OVERRIDE: 覆盖
    const override = this._modifiers.find(
      (m) => m.type === ModifierType.OVERRIDE,
    );
    if (override) {
      final = override.value;
    }

    return Math.max(0, Math.floor(final));
  }

  /**
   * Add a modifier to this attribute.
   * @param modifier - The modifier to add
   */
  addModifier(modifier: AttributeModifier): void {
    this._modifiers.push(modifier);
  }

  /**
   * Remove a modifier by its ID.
   * @param modifierId - The ID of the modifier to remove
   */
  removeModifier(modifierId: string): void {
    this._modifiers = this._modifiers.filter((m) => m.id !== modifierId);
  }

  /**
   * Clear all modifiers from this attribute.
   */
  clearModifiers(): void {
    this._modifiers = [];
  }

  /**
   * Get the base value without modifiers.
   * @returns The base attribute value
   */
  getBaseValue(): number {
    return this._baseValue;
  }

  /**
   * Set the base value.
   * @param value - The new base value (must be non-negative)
   * @throws Error if value is negative
   */
  setBaseValue(value: number): void {
    if (value < 0) {
      throw new Error(`Base value cannot be negative: ${value}`);
    }
    this._baseValue = value;
  }

  /**
   * Get all modifiers (returns a copy to prevent external modification).
   * @returns Array of modifiers
   */
  getModifiers(): AttributeModifier[] {
    return [...this._modifiers];
  }

  /**
   * Set all modifiers (replaces existing modifiers).
   * @param modifiers - The new array of modifiers
   */
  setModifiers(modifiers: AttributeModifier[]): void {
    this._modifiers = modifiers;
  }
}

/**
 * 5维属性系统 (5-Attribute System):
 * - SPIRIT (灵力): 法系输出核心，影响法术伤害、MP、护盾
 * - PHYSIQUE (体魄): 生存核心，影响HP、减伤、抗性
 * - AGILITY (身法): 先手核心，影响出手顺序、暴击率、闪避
 * - CONSCIOUSNESS (神识): 控制核心，影响命中率、抗控率
 * - COMPREHENSION (悟性): 策略核心，影响技能条件、触发概率、伤害上限
 *
 * Note: CONSCIOUSNESS is defined but not used in derived attribute calculations.
 * It will be used in future systems (control mechanics, hit rate calculations, etc.)
 */
export class AttributeSet {
  private _attributes = new Map<AttributeType, Attribute>();

  /**
   * Create a new AttributeSet with optional base values.
   * @param baseValues - Partial record of attribute base values (defaults to 10 if not specified)
   */
  constructor(baseValues: Partial<Record<AttributeType, number>>) {
    Object.values(AttributeType).forEach((attrType) => {
      const baseValue = baseValues[attrType] ?? 10;
      this._attributes.set(attrType, new Attribute(attrType, baseValue));
    });
  }

  /**
   * Get the final value of an attribute after applying all modifiers.
   * Modifiers are applied in 6 stages: BASE → FIXED → ADD → MULTIPLY → FINAL → OVERRIDE
   * @param attrType - The attribute type to query
   * @returns The final attribute value (0 if attribute doesn't exist)
   */
  getValue(attrType: AttributeType): number {
    const attr = this._attributes.get(attrType);
    return attr?.getFinalValue() ?? 0;
  }

  /**
   * Get the base value of an attribute without modifiers.
   * @param attrType - The attribute type to query
   * @returns The base attribute value (0 if attribute doesn't exist)
   */
  getBaseValue(attrType: AttributeType): number {
    const attr = this._attributes.get(attrType);
    return attr?.getBaseValue() ?? 0;
  }

  /**
   * Set the base value of an attribute.
   * @param attrType - The attribute type to modify
   * @param value - The new base value (must be non-negative)
   * @throws Error if value is negative
   */
  setBaseValue(attrType: AttributeType, value: number): void {
    const attr = this._attributes.get(attrType);
    if (attr) {
      attr.setBaseValue(value);
    }
  }

  /**
   * Add a modifier to an attribute.
   * @param modifier - The modifier to add
   */
  addModifier(modifier: AttributeModifier): void {
    const attr = this._attributes.get(modifier.attrType);
    if (attr) {
      attr.addModifier(modifier);
    }
  }

  /**
   * Remove a modifier from all attributes by its ID.
   * @param modifierId - The ID of the modifier to remove
   */
  removeModifier(modifierId: string): void {
    this._attributes.forEach((attr) => {
      attr.removeModifier(modifierId);
    });
  }

  /**
   * Clear all modifiers from all attributes.
   */
  clearModifiers(): void {
    this._attributes.forEach((attr) => {
      attr.clearModifiers();
    });
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
   * Get the maximum HP based on PHYSIQUE and SPIRIT.
   * Formula: HP = 100 + physique × 10 + spirit × 2
   * @returns Maximum HP
   */
  getMaxHp(): number {
    const physique = this.getValue(AttributeType.PHYSIQUE);
    const spirit = this.getValue(AttributeType.SPIRIT);
    return 100 + physique * 10 + spirit * 2;
  }

  /**
   * Get the maximum MP based on SPIRIT and COMPREHENSION.
   * Formula: MP = 100 + spirit × 5 + comprehension × 3
   * @returns Maximum MP
   */
  getMaxMp(): number {
    const spirit = this.getValue(AttributeType.SPIRIT);
    const comprehension = this.getValue(AttributeType.COMPREHENSION);
    return 100 + spirit * 5 + comprehension * 3;
  }

  /**
   * Get the critical hit rate based on AGILITY and COMPREHENSION.
   * Formula: critRate = min(0.6, 0.05 + agility × 0.001 + comprehension × 0.0005)
   * @returns Critical hit rate (0-1)
   */
  getCritRate(): number {
    const agility = this.getValue(AttributeType.AGILITY);
    const comprehension = this.getValue(AttributeType.COMPREHENSION);
    const baseRate = 0.05;
    const bonusRate = agility * 0.001 + comprehension * 0.0005;
    return Math.min(0.6, baseRate + bonusRate);
  }

  /**
   * Get the evasion rate based on AGILITY.
   * Formula: evasion = min(0.3, agility × 0.0005)
   * @returns Evasion rate (0-1)
   */
  getEvasionRate(): number {
    const agility = this.getValue(AttributeType.AGILITY);
    return Math.min(0.3, agility * 0.0005);
  }

  /**
   * Create a deep clone of this AttributeSet.
   * @returns A new AttributeSet with the same base values and modifiers
   */
  clone(): AttributeSet {
    const cloned = new AttributeSet({});
    this._attributes.forEach((attr, type) => {
      cloned.setBaseValue(type, attr.getBaseValue());
      // Copy modifiers by re-adding them to the cloned attribute
      const modifiers = attr.getModifiers();
      modifiers.forEach((mod) => {
        cloned.addModifier({ ...mod });
      });
    });
    return cloned;
  }
}
