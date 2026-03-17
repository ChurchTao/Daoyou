import { UnitId, UnitSnapshot } from '../core/types';
import { AttributeSet } from './AttributeSet';
import { AbilityContainer } from './AbilityContainer';
import { BuffContainer } from './BuffContainer';
import { AttributeType } from '../core/types';

export class Unit {
  readonly id: UnitId;
  readonly name: string;
  readonly attributes: AttributeSet;
  readonly abilities: AbilityContainer;
  readonly buffs: BuffContainer;

  currentHp: number;
  currentMp: number;
  maxHp: number;
  maxMp: number;

  isDefending: boolean = false;
  isControlled: boolean = false;

  constructor(
    id: UnitId,
    name: string,
    baseAttrs: Partial<Record<AttributeType, number>>,
    options?: {
      attributes?: AttributeSet;
      abilities?: AbilityContainer;
      buffs?: BuffContainer;
    },
  ) {
    this.id = id;
    this.name = name;

    this.attributes = options?.attributes ?? new AttributeSet(baseAttrs);
    this.abilities = options?.abilities ?? new AbilityContainer(this);
    this.buffs = options?.buffs ?? new BuffContainer(this);

    this.maxHp = this.attributes.getMaxHp();
    this.maxMp = this.attributes.getMaxMp();
    this.currentHp = this.maxHp;
    this.currentMp = this.maxMp;
  }

  updateDerivedStats(): void {
    this.maxHp = this.attributes.getMaxHp();
    this.maxMp = this.attributes.getMaxMp();
    this.currentHp = Math.min(this.currentHp, this.maxHp);
    this.currentMp = Math.min(this.currentMp, this.maxMp);
  }

  takeDamage(damage: number): void {
    if (damage < 0) {
      console.warn(`Unit.takeDamage: 负数输入 ${damage}，应使用 heal() 方法`);
      damage = 0;
    }
    this.currentHp = Math.max(0, this.currentHp - damage);
  }

  heal(amount: number): void {
    this.currentHp = Math.min(this.maxHp, this.currentHp + amount);
  }

  consumeMp(amount: number): boolean {
    if (amount < 0) {
      console.warn(`Unit.consumeMp: 负数输入 ${amount}，应使用 restoreMp() 方法`);
      amount = 0;
    }
    if (this.currentMp < amount) return false;
    this.currentMp -= amount;
    return true;
  }

  restoreMp(amount: number): void {
    this.currentMp = Math.min(this.maxMp, this.currentMp + amount);
  }

  isAlive(): boolean {
    return this.currentHp > 0;
  }

  getHpPercent(): number {
    return this.maxHp > 0 ? this.currentHp / this.maxHp : 0;
  }

  getMpPercent(): number {
    return this.maxMp > 0 ? this.currentMp / this.maxMp : 0;
  }

  clone(): Unit {
    // Create a minimal unit first to get a valid Unit reference
    const tempUnit = new Unit(
      this.id + '_mirror',
      this.name + '的镜像',
      this.attributes.getAllValues(),
    );

    // Clone containers with the temp unit as owner
    const clonedAttributes = this.attributes.clone();
    const clonedAbilities = this.abilities.clone(tempUnit);
    const clonedBuffs = this.buffs.clone(tempUnit);

    // Now create the final unit with the cloned containers
    const clone = new Unit(
      this.id + '_mirror',
      this.name + '的镜像',
      this.attributes.getAllValues(),
      {
        attributes: clonedAttributes,
        abilities: clonedAbilities,
        buffs: clonedBuffs,
      },
    );

    clone.currentHp = this.currentHp;
    clone.currentMp = this.currentMp;
    clone.maxHp = this.maxHp;
    clone.maxMp = this.maxMp;

    return clone;
  }

  getSnapshot(): UnitSnapshot {
    return {
      unitId: this.id,
      name: this.name,
      attributes: this.attributes.getAllValues(),
      currentHp: this.currentHp,
      maxHp: this.maxHp,
      currentMp: this.currentMp,
      maxMp: this.maxMp,
      buffs: this.buffs.getAllBuffIds(),
      isAlive: this.isAlive(),
      hpPercent: this.getHpPercent(),
      mpPercent: this.getMpPercent(),
    };
  }

  resetTurnState(): void {
    this.isDefending = false;
    this.isControlled = false;
  }
}
