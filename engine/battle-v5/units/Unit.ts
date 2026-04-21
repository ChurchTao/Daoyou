import { GameplayTagContainer, GameplayTags } from '@/engine/shared/tag-domain';
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

  private currentHp: number;
  private currentMp: number;
  private maxHp: number;
  private maxMp: number;
  private currentShield: number = 0; // 当前护盾值

  private isDefending: boolean = false;

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
    this.tags.addTags([GameplayTags.UNIT.TYPE.COMBATANT]);

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

  overrideResourceCaps(maxHp?: number, maxMp?: number): void {
    if (typeof maxHp === 'number' && maxHp > 0) {
      this.maxHp = maxHp;
      this.currentHp = Math.min(this.currentHp, this.maxHp);
    }

    if (typeof maxMp === 'number' && maxMp > 0) {
      this.maxMp = maxMp;
      this.currentMp = Math.min(this.currentMp, this.maxMp);
    }
  }

  /**
   * 增加护盾
   */
  addShield(amount: number): void {
    if (amount <= 0) return;
    this.currentShield += Math.round(amount);
  }

  setHp(amount: number): void {
    this.currentHp = Math.max(0, Math.min(this.maxHp, amount));
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
    this.setHp(this.currentHp - damage);
  }

  heal(amount: number): void {
    this.setHp(this.currentHp + amount);
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

  /**
   * @param amount
   * @returns 削减了多少 MP（如果 amount 大于当前 MP，则削减当前 MP 的全部）
   */
  takeMp(amount: number): number {
    if (amount < 0) {
      console.warn(`Unit.takeMp: 负数输入 ${amount}，应使用 restoreMp() 方法`);
      amount = 0;
    }
    const actualTaken = Math.min(this.currentMp, amount);
    this.currentMp = Math.max(0, this.currentMp - actualTaken);
    return actualTaken;
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
      currentShield: this.currentShield,
    };
  }

  resetTurnState(): void {
    this.isDefending = false;
  }

  getCurrentShield(): number {
    return this.currentShield;
  }

  getMaxHp(): number {
    return this.maxHp;
  }

  getMaxMp(): number {
    return this.maxMp;
  }

  getCurrentHp(): number {
    return this.currentHp;
  }

  getCurrentMp(): number {
    return this.currentMp;
  }
}
