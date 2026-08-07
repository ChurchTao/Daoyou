import { GameplayTagContainer, GameplayTags } from '@shared/engine/shared/tag-domain';
import type { RealmStage, RealmType } from '@shared/types/constants';
import type { SpiritualRoot } from '@shared/types/cultivator';
import {
  AttributeType,
  type TeamId,
  type TeamSlot,
  UnitId,
  UnitSnapshot,
} from '../core/types';
import { AbilityContainer } from './AbilityContainer';
import { AttributeSet } from './AttributeSet';
import { BuffContainer } from './BuffContainer';
import { CombatResourceContainer } from './CombatResourceContainer';
import type { HpChangedEvent } from '../core/events';
import { BattleRuntime } from '../runtime/BattleRuntime';

export type HpChangeReason = HpChangedEvent['reason'];

interface UnitRuntimeMeta {
  spiritualRoots: SpiritualRoot[];
  realm?: RealmType;
  realmStage?: RealmStage;
  realmRank?: number;
}

export class Unit {
  readonly id: UnitId;
  readonly name: string;
  readonly attributes: AttributeSet;
  readonly abilities: AbilityContainer;
  readonly buffs: BuffContainer;
  readonly combatResources: CombatResourceContainer;
  readonly tags: GameplayTagContainer;
  readonly runtime: BattleRuntime;
  readonly teamId: TeamId;
  readonly slot: TeamSlot;

  private currentHp: number;
  private currentMp: number;
  private maxHp: number;
  private maxMp: number;
  private currentShield: number = 0; // 当前护盾值

  private isDefending: boolean = false;
  private _runtimeMeta: UnitRuntimeMeta = {
    spiritualRoots: [],
  };

  constructor(
    id: UnitId,
    name: string,
    baseAttrs: Partial<Record<AttributeType, number>>,
    options?: {
      attributes?: AttributeSet;
      abilities?: AbilityContainer;
      buffs?: BuffContainer;
      combatResources?: CombatResourceContainer;
      runtime?: BattleRuntime;
      teamId?: TeamId;
      slot?: TeamSlot;
    },
  ) {
    this.id = id;
    this.name = name;
    this.runtime = options?.runtime ?? BattleRuntime.legacy;
    this.teamId = options?.teamId ?? `legacy_team:${id}`;
    this.slot = options?.slot ?? 0;

    this.attributes = options?.attributes ?? new AttributeSet(baseAttrs);
    this.abilities = options?.abilities ?? new AbilityContainer(this);
    this.buffs = options?.buffs ?? new BuffContainer(this);
    this.combatResources =
      options?.combatResources ?? new CombatResourceContainer();
    this.combatResources.bindOwner(this);

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

  /**
   * 仅用于战斗单元组装完成后的初始状态。
   * 战斗中的派生属性刷新必须继续使用 updateDerivedStats，避免隐式治疗。
   */
  initializeCurrentResourcesToMax(): void {
    this.currentHp = this.maxHp;
    this.currentMp = this.maxMp;
  }

  initializeResources(options: {
    hp?: number;
    mp?: number;
    shield?: number;
  }): void {
    if (typeof options.hp === 'number') {
      if (!Number.isFinite(options.hp)) {
        throw new Error('初始气血必须为有限数值');
      }
      this.currentHp = Math.max(0, Math.min(this.maxHp, options.hp));
    }
    if (typeof options.mp === 'number') {
      if (!Number.isFinite(options.mp)) {
        throw new Error('初始法力必须为有限数值');
      }
      this.currentMp = Math.max(0, Math.min(this.maxMp, options.mp));
    }
    if (typeof options.shield === 'number') {
      if (!Number.isFinite(options.shield)) {
        throw new Error('初始护盾必须为有限数值');
      }
      this.currentShield = Math.max(0, Math.round(options.shield));
    }
  }

  /**
   * 增加护盾
   */
  addShield(amount: number): void {
    if (amount <= 0) return;
    this.currentShield += Math.round(amount);
  }

  setHp(amount: number, reason: HpChangeReason = 'set'): void {
    const beforeHp = this.currentHp;
    const afterHp = Math.max(0, Math.min(this.maxHp, amount));
    if (afterHp === beforeHp) return;
    this.currentHp = afterHp;
    this.runtime.events.publish<HpChangedEvent>({
      type: 'HpChangedEvent',
      timestamp: this.runtime.clock.now(),
      unit: this,
      beforeHp,
      afterHp,
      delta: afterHp - beforeHp,
      reason,
    });
  }

  setMp(amount: number): void {
    this.currentMp = Math.max(0, Math.min(this.maxMp, amount));
  }

  setShield(amount: number): void {
    this.currentShield = Math.max(0, Math.round(amount));
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
    this.setHp(this.currentHp - damage, 'damage');
  }

  heal(amount: number): number {
    const before = this.currentHp;
    const reduction = Math.max(
      0,
      Math.min(
        1,
        this.attributes.getValue(AttributeType.HEAL_RECEIVED_REDUCTION),
      ),
    );
    const received = Math.round(Math.max(0, amount) * (1 - reduction));
    this.setHp(this.currentHp + received, 'heal');
    return this.currentHp - before;
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
   * @returns 削减了多少法力（如果 amount 大于当前法力，则削减当前法力的全部）
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

  restoreMp(amount: number): number {
    const before = this.currentMp;
    this.setMp(this.currentMp + amount);
    return this.currentMp - before;
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
      { runtime: this.runtime, teamId: this.teamId, slot: this.slot },
    );

    // Clone containers with the temp unit as owner
    const clonedAttributes = this.attributes.clone();
    const clonedAbilities = this.abilities.clone(tempUnit);
    const clonedBuffs = this.buffs.clone(tempUnit);
    const clonedCombatResources = this.combatResources.clone();

    // Now create the final unit with the cloned containers
    const clone = new Unit(
      this.id + '_mirror',
      this.name + '的镜像',
      this.attributes.getAllValues(),
      {
        attributes: clonedAttributes,
        abilities: clonedAbilities,
        buffs: clonedBuffs,
        combatResources: clonedCombatResources,
        runtime: this.runtime,
        teamId: this.teamId,
        slot: this.slot,
      },
    );

    clone.currentHp = this.currentHp;
    clone.currentMp = this.currentMp;
    clone.maxHp = this.maxHp;
    clone.maxMp = this.maxMp;
    clone.currentShield = this.currentShield;
    clone.setSpiritualRoots(this.getSpiritualRoots());
    clone.setRealmMeta(this.getRealmMeta());

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
      combatResources: this.combatResources.snapshots(),
      isAlive: this.isAlive(),
      hpPercent: this.getHpPercent(),
      mpPercent: this.getMpPercent(),
      currentShield: this.currentShield,
      abilities: this.abilities.getSnapshots(),
      baseAttributes: this.attributes.getAllBaseValues(),
    };
  }

  resetTurnState(): void {
    this.isDefending = false;
  }

  setSpiritualRoots(spiritualRoots: SpiritualRoot[]): void {
    this._runtimeMeta.spiritualRoots = spiritualRoots.map((root) => ({
      ...root,
    }));
  }

  getSpiritualRoots(): SpiritualRoot[] {
    return this._runtimeMeta.spiritualRoots.map((root) => ({
      ...root,
    }));
  }

  setRealmMeta(meta: {
    realm?: RealmType;
    realmStage?: RealmStage;
    realmRank?: number;
  }): void {
    this._runtimeMeta.realm = meta.realm;
    this._runtimeMeta.realmStage = meta.realmStage;
    this._runtimeMeta.realmRank = meta.realmRank;
  }

  getRealmMeta(): {
    realm?: RealmType;
    realmStage?: RealmStage;
    realmRank?: number;
  } {
    return {
      realm: this._runtimeMeta.realm,
      realmStage: this._runtimeMeta.realmStage,
      realmRank: this._runtimeMeta.realmRank,
    };
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
