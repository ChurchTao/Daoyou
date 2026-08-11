import { Ability } from '../abilities/Ability';
import {
  AbilitySelectionStrategy,
  DefaultAbilitySelectionStrategy,
} from '../abilities/AbilitySelectionStrategy';
import { ActiveSkill } from '../abilities/ActiveSkill';
import { BasicAttack } from '../abilities/BasicAttack';
import { AbilityType } from '../core/types';
import { Unit } from './Unit';

/**
 * AbilityContainer - 技能容器
 *
 * 职责：
 * - 管理单位的所有技能（存储、添加、移除）
 * - 保存自动战斗的技能选择策略
 *
 * 不负责：
 * - 目标选择（由 TargetSelectionSystem 处理）
 * - 技能执行（由 AbilityExecutionSystem 处理）
 */
export class AbilityContainer {
  private _abilities = new Map<string, Ability>();
  private _owner: Unit;
  private _defaultAttack: Ability | null = null;
  private _fallbackBasicAttack: Ability | null = null;
  private _selectionStrategy: AbilitySelectionStrategy =
    new DefaultAbilitySelectionStrategy();

  constructor(owner: Unit) {
    this._owner = owner;
  }

  /**
   * 获取所有可用技能（供外部查询使用，保留兼容性并优化逻辑）
   */
  getAvailableAbilities(target: Unit): Ability[] {
    return Array.from(this._abilities.values())
      .filter(
        (ability): ability is ActiveSkill => ability instanceof ActiveSkill,
      )
      .filter((ability) => {
        // 简单校验：如果传入目标与策略不符，则认为不可用（在复杂 AI 中由外部控制）
        const policy = ability.targetPolicy;
        const isSelfTarget = policy.team === 'self' || policy.team === 'ally';
        const actualTarget = isSelfTarget ? this._owner : target;

        return ability.canTrigger({
          caster: this._owner,
          target: actualTarget,
        });
      });
  }

  setSelectionStrategy(strategy: AbilitySelectionStrategy): void {
    this._selectionStrategy = strategy;
  }

  getSelectionStrategy(): AbilitySelectionStrategy {
    return this._selectionStrategy;
  }

  private _getDefaultAttack(): Ability {
    if (!this._defaultAttack) {
      this._defaultAttack = new BasicAttack();
      this._defaultAttack.setOwner(this._owner);
      this._defaultAttack.setActive(true);
    }
    return this._defaultAttack;
  }

  getDefaultAttackForSnapshot(): Ability | null {
    return this._defaultAttack;
  }

  getDefaultAttack(): Ability {
    return this._getDefaultAttack();
  }

  getFallbackBasicAttack(): Ability {
    if (!this._fallbackBasicAttack) {
      this._fallbackBasicAttack = new BasicAttack();
      this._fallbackBasicAttack.setOwner(this._owner);
      this._fallbackBasicAttack.setActive(true);
    }
    return this._fallbackBasicAttack;
  }

  setDefaultAttack(ability: Ability): void {
    if (this._defaultAttack) {
      this._defaultAttack.setActive(false);
    }
    this._defaultAttack = ability;
    this._defaultAttack.setOwner(this._owner);
    this._defaultAttack.setActive(true);
  }

  /**
   * 更新所有技能的冷却时间
   */
  tickAbilitiesCooldown(): void {
    for (const ability of this._abilities.values()) {
      if (ability instanceof ActiveSkill) {
        ability.tickCooldown();
      }
    }
  }

  // ===== 技能管理 =====

  addAbility(ability: Ability): void {
    this._abilities.set(ability.id, ability);
    ability.setOwner(this._owner);
    ability.setActive(true);
  }

  removeAbility(abilityId: string): void {
    const ability = this._abilities.get(abilityId);
    if (ability) {
      ability.setActive(false);
      this._abilities.delete(abilityId);
    }
  }

  getAbility(abilityId: string): Ability | undefined {
    return this._abilities.get(abilityId);
  }

  getAllAbilities(): Ability[] {
    return Array.from(this._abilities.values());
  }

  /**
   * 获取所有技能的快照
   */
  getSnapshots(): Array<{
    id: string;
    name: string;
    currentCd: number;
    maxCd: number;
    mpCost: number;
    type: AbilityType;
  }> {
    return Array.from(this._abilities.values()).map((ability) => {
      if (ability instanceof ActiveSkill) {
        return {
          id: ability.id,
          name: ability.name,
          currentCd: ability.currentCooldown,
          maxCd: ability.maxCooldown,
          mpCost: ability.manaCost,
          type: ability.type,
        };
      }
      return {
        id: ability.id,
        name: ability.name,
        currentCd: 0,
        maxCd: 0,
        mpCost: 0,
        type: ability.type,
      };
    });
  }

  // ===== 克隆 =====

  clone(owner: Unit): AbilityContainer {
    const clonedContainer = new AbilityContainer(owner);
    clonedContainer._selectionStrategy = this._selectionStrategy;

    for (const ability of this._abilities.values()) {
      const clonedAbility = ability.clone();
      clonedContainer._abilities.set(clonedAbility.id, clonedAbility);
      clonedAbility.setOwner(owner);
      clonedAbility.setActive(true);
    }
    if (this._defaultAttack) {
      clonedContainer.setDefaultAttack(this._defaultAttack.clone());
    }

    return clonedContainer;
  }

  // ===== 销毁 =====

  destroy(): void {
    // 停用所有技能
    for (const ability of this._abilities.values()) {
      ability.setActive(false);
    }
  }
}
