import { UnitId } from '../core/types';
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
  ) {
    this.id = id;
    this.name = name;

    this.attributes = new AttributeSet(baseAttrs);
    this.abilities = new AbilityContainer(this);
    this.buffs = new BuffContainer(this);

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
    this.currentHp = Math.max(0, this.currentHp - damage);
  }

  heal(amount: number): void {
    this.currentHp = Math.min(this.maxHp, this.currentHp + amount);
  }

  consumeMp(amount: number): boolean {
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
    const clone = new Unit(
      this.id + '_mirror',
      this.name + '的镜像',
      this.attributes.getAllValues(),
    );

    (clone as any).attributes = this.attributes.clone();
    (clone as any).abilities = this.abilities.clone(clone);
    (clone as any).buffs = this.buffs.clone(clone);

    clone.currentHp = this.currentHp;
    clone.currentMp = this.currentMp;
    clone.maxHp = this.maxHp;
    clone.maxMp = this.maxMp;

    return clone;
  }

  getSnapshot(): object {
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
