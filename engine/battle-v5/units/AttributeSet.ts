import { AttributeType, AttributeModifier, ModifierType } from '../core/types';

class Attribute {
  readonly type: AttributeType;
  private _baseValue: number;
  private _modifiers: AttributeModifier[] = [];

  constructor(type: AttributeType, baseValue: number) {
    this.type = type;
    this._baseValue = baseValue;
  }

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
    final *= (1 + addBonus);

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
    const override = this._modifiers.find((m) => m.type === ModifierType.OVERRIDE);
    if (override) {
      final = override.value;
    }

    return Math.max(0, Math.floor(final));
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

  getBaseValue(): number {
    return this._baseValue;
  }

  setBaseValue(value: number): void {
    this._baseValue = value;
  }

  getModifiers(): AttributeModifier[] {
    return [...this._modifiers];
  }

  setModifiers(modifiers: AttributeModifier[]): void {
    this._modifiers = modifiers;
  }
}

export class AttributeSet {
  private _attributes = new Map<AttributeType, Attribute>();

  constructor(baseValues: Partial<Record<AttributeType, number>>) {
    Object.values(AttributeType).forEach((attrType) => {
      const baseValue = baseValues[attrType] ?? 10;
      this._attributes.set(attrType, new Attribute(attrType, baseValue));
    });
  }

  getValue(attrType: AttributeType): number {
    const attr = this._attributes.get(attrType);
    return attr?.getFinalValue() ?? 0;
  }

  getBaseValue(attrType: AttributeType): number {
    const attr = this._attributes.get(attrType);
    return attr?.getBaseValue() ?? 0;
  }

  setBaseValue(attrType: AttributeType, value: number): void {
    const attr = this._attributes.get(attrType);
    if (attr) {
      attr.setBaseValue(value);
    }
  }

  addModifier(modifier: AttributeModifier): void {
    const attr = this._attributes.get(modifier.attrType);
    if (attr) {
      attr.addModifier(modifier);
    }
  }

  removeModifier(modifierId: string): void {
    this._attributes.forEach((attr) => {
      attr.removeModifier(modifierId);
    });
  }

  clearModifiers(): void {
    this._attributes.forEach((attr) => {
      attr.clearModifiers();
    });
  }

  getAllValues(): Record<AttributeType, number> {
    const result = {} as Record<AttributeType, number>;
    this._attributes.forEach((attr, type) => {
      result[type] = attr.getFinalValue();
    });
    return result;
  }

  getMaxHp(): number {
    const physique = this.getValue(AttributeType.PHYSIQUE);
    const spirit = this.getValue(AttributeType.SPIRIT);
    return 100 + physique * 10 + spirit * 2;
  }

  getMaxMp(): number {
    const spirit = this.getValue(AttributeType.SPIRIT);
    const comprehension = this.getValue(AttributeType.COMPREHENSION);
    return 100 + spirit * 5 + comprehension * 3;
  }

  getCritRate(): number {
    const agility = this.getValue(AttributeType.AGILITY);
    const comprehension = this.getValue(AttributeType.COMPREHENSION);
    const baseRate = 0.05;
    const bonusRate = agility * 0.001 + comprehension * 0.0005;
    return Math.min(0.6, baseRate + bonusRate);
  }

  getEvasionRate(): number {
    const agility = this.getValue(AttributeType.AGILITY);
    return Math.min(0.3, agility * 0.0005);
  }

  clone(): AttributeSet {
    const cloned = new AttributeSet({});
    this._attributes.forEach((attr, type) => {
      cloned.setBaseValue(type, attr.getBaseValue());
      // Copy modifiers by re-adding them to the cloned attribute
      const modifiers = attr.getModifiers();
      modifiers.forEach(mod => {
        cloned.addModifier({ ...mod });
      });
    });
    return cloned;
  }
}
