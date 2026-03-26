import { GameplayTagContainer, GameplayTags } from '../core/GameplayTags';
import { AttributeType, UnitId, UnitSnapshot } from '../core/types';
import { AbilityContainer } from './AbilityContainer';
import { AttributeSet } from './AttributeSet';
import { BuffContainer } from './BuffContainer';

export class Unit {
  readonly id: UnitId;
  readonly name: string;
  readonly attributes: AttributeSet;
  readonly abilities: AbilityContainer;
  readonly buffs: BuffContainer;
  readonly tags: GameplayTagContainer;

  currentHp: number;
  currentMp: number;
  maxHp: number;
  maxMp: number;
  currentShield: number = 0; // 当前护盾值

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

    // Initialize tag container
    this.tags = new GameplayTagContainer();
    this.tags.addTags([GameplayTags.UNIT.COMBATANT]);

    this.maxHp = this.attributes.getMaxHp();
    this.maxMp = this.attributes.getMaxMp();
    this.currentHp = this.maxHp;
    this.currentMp = this.maxMp;
    this.currentShield = 0;
  }

  updateDerivedStats(): void {
    this.maxHp = this.attributes.getMaxHp();
    this.maxMp = this.attributes.getMaxMp();
    this.currentHp = Math.min(this.currentHp, this.maxHp);
    this.currentMp = Math.min(this.currentMp, this.maxMp);
  }

  /**
   * 增加护盾
   */
  addShield(amount: number): void {
    if (amount <= 0) return;
    this.currentShield += Math.round(amount);
  }

  /**
   * 扣除护盾
   * @returns 剩余未被护盾抵扣的伤害
   */
  absorbDamage(damage: number): number {
    if (this.currentShield <= 0) return damage;

    if (this.currentShield >= damage) {
      this.currentShield -= damage;
      return 0;
    } else {
      const remainingDamage = damage - this.currentShield;
      this.currentShield = 0;
      return remainingDamage;
    }
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
      console.warn(
        `Unit.consumeMp: 负数输入 ${amount}，应使用 restoreMp() 方法`,
      );
      amount = 0;
    }
    if (this.currentMp < amount) return false;
    this.currentMp -= amount;
    return true;
  }

  takeMp(amount: number): void {
    if (amount < 0) {
      console.warn(`Unit.takeMp: 负数输入 ${amount}，应使用 restoreMp() 方法`);
      amount = 0;
    }
    this.currentMp = Math.max(0, this.currentMp - amount);
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

    // Clone tags (clear default tags from constructor, then copy all tags from original)
    clone.tags.clear();
    clone.tags.addTags(this.tags.getTags());

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
