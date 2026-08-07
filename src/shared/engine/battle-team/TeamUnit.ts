import { AttributeSet } from '@shared/engine/battle-v5/units/AttributeSet';
import { AttributeType, type AttributeModifier } from '@shared/engine/battle-v5/core/types';
import type { TeamSide, Position, TeamUnitSnapshot, TeamUnitRef, PendingCast } from './types';
import type { TeamAbility } from './TeamAbility';

export interface TeamUnitOptions {
  id: string;
  name: string;
  side: TeamSide;
  position: Position;
  baseAttrs: Partial<Record<AttributeType, number>>;
  abilities?: TeamAbility[];
}

/**
 * 多人战斗单位。
 *
 * 与 battle-v5 Unit 的区别：
 * - 无 mp（多人模式去除法力消耗）
 * - 冷却/次数状态由单位持有（Ability 本身无状态）
 * - 不依赖 EventBus 单例
 */
export class TeamUnit implements TeamUnitRef {
  readonly id: string;
  readonly name: string;
  readonly side: TeamSide;
  readonly attributes: AttributeSet;
  readonly abilities: TeamAbility[];

  private _position: Position;
  private _currentHp: number;
  private _maxHp: number;
  private _shield: number = 0;
  private _alive: boolean = true;

  // 技能冷却与次数状态（abilityId → 状态）
  private _cooldowns: Map<string, number> = new Map();
  private _remainingUses: Map<string, number> = new Map();
  // 光环 modifier id 列表（用于 snapshot）
  private _activeAuras: string[] = [];
  // 蓄力状态（跨回合延迟释放）
  private _pendingCast: PendingCast | null = null;
  // 嘲讽状态（本回合敌方普攻只能以自己为目标）
  private _isTaunting = false;

  constructor(opts: TeamUnitOptions) {
    this.id = opts.id;
    this.name = opts.name;
    this.side = opts.side;
    this._position = opts.position;
    this.attributes = new AttributeSet(opts.baseAttrs);
    this._maxHp = this.attributes.getMaxHp();
    this._currentHp = this._maxHp;
    this.abilities = opts.abilities ?? [];
  }

  get position(): Position {
    return this._position;
  }

  get currentHp(): number {
    return this._currentHp;
  }

  get maxHp(): number {
    return this._maxHp;
  }

  get shield(): number {
    return this._shield;
  }

  isAlive(): boolean {
    return this._alive;
  }

  getHpPercent(): number {
    if (this._maxHp <= 0) return 0;
    return this._currentHp / this._maxHp;
  }

  get pendingCast(): PendingCast | null {
    return this._pendingCast;
  }

  set pendingCast(cast: PendingCast | null) {
    this._pendingCast = cast;
  }

  get isTaunting(): boolean {
    return this._isTaunting;
  }

  set isTaunting(value: boolean) {
    this._isTaunting = value;
  }

  takeDamage(amount: number): { absorbed: number; hpLost: number } {
    if (!this._alive || amount <= 0) return { absorbed: 0, hpLost: 0 };

    let remaining = amount;
    let absorbed = 0;

    // 先抵护盾
    if (this._shield > 0) {
      const shieldAbsorb = Math.min(this._shield, remaining);
      this._shield -= shieldAbsorb;
      absorbed += shieldAbsorb;
      remaining -= shieldAbsorb;
    }

    // 再扣血
    const hpLost = Math.min(this._currentHp, remaining);
    this._currentHp -= hpLost;

    if (this._currentHp <= 0) {
      this._currentHp = 0;
      this._alive = false;
      this._pendingCast = null;
      this._isTaunting = false;
    }

    return { absorbed, hpLost };
  }

  heal(amount: number): number {
    if (!this._alive || amount <= 0) return 0;
    const healed = Math.min(this._maxHp - this._currentHp, amount);
    this._currentHp += healed;
    return healed;
  }

  addShield(amount: number): void {
    if (amount > 0) this._shield += amount;
  }

  addModifier(modifier: AttributeModifier): void {
    this.attributes.addModifier(modifier);
  }

  removeModifier(modifierId: string): void {
    this.attributes.removeModifier(modifierId);
  }

  removeModifierBySource(source: unknown): void {
    this.attributes.removeModifierBySource(source);
  }

  addAura(auraId: string): void {
    if (!this._activeAuras.includes(auraId)) {
      this._activeAuras.push(auraId);
    }
  }

  removeAura(auraId: string): void {
    this._activeAuras = this._activeAuras.filter((id) => id !== auraId);
  }

  tickCooldowns(): void {
    for (const [id, turns] of this._cooldowns) {
      if (turns > 0) this._cooldowns.set(id, turns - 1);
    }
  }

  resetRoundUses(): void {
    this._remainingUses.clear();
  }

  canUse(ability: TeamAbility): boolean {
    if (!this._alive) return false;
    if (this._cooldowns.get(ability.id) && (this._cooldowns.get(ability.id) ?? 0) > 0) return false;
    if (ability.maxUsesPerRound > 0) {
      const used = this._remainingUses.get(ability.id) ?? 0;
      if (used >= ability.maxUsesPerRound) return false;
    }
    return true;
  }

  consumeUse(ability: TeamAbility): void {
    if (ability.maxUsesPerRound > 0) {
      const used = this._remainingUses.get(ability.id) ?? 0;
      this._remainingUses.set(ability.id, used + 1);
    }
    if (ability.cooldown > 0) {
      this._cooldowns.set(ability.id, ability.cooldown);
    }
  }

  snapshot(): TeamUnitSnapshot {
    const cooldowns: Record<string, number> = {};
    for (const [id, turns] of this._cooldowns) cooldowns[id] = turns;

    const remainingUses: Record<string, number> = {};
    for (const [id, uses] of this._remainingUses) remainingUses[id] = uses;

    return {
      unitId: this.id,
      name: this.name,
      side: this.side,
      position: this._position,
      currentHp: this._currentHp,
      maxHp: this._maxHp,
      shield: this._shield,
      alive: this._alive,
      activeAuras: [...this._activeAuras],
      cooldowns,
      remainingUses,
      pendingCast: this._pendingCast,
      isTaunting: this._isTaunting,
    };
  }
}
