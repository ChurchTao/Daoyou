import { Ability, AbilityContext } from '../abilities/Ability';
import { ActiveSkill } from '../abilities/ActiveSkill';
import { BasicAttack } from '../abilities/BasicAttack';
import { EventBus } from '../core/EventBus';
import {
  ActionEvent,
  ControlledSkipEvent,
  EventPriorityLevel,
  SkillPreCastEvent,
} from '../core/events';
import { GameplayTags } from '../core/GameplayTags';
import { AbilityType } from '../core/types';
import { Unit } from './Unit';

/**
 * AbilityContainer - 技能容器
 *
 * 职责：
 * - 管理单位的所有技能（存储、添加、移除）
 * - 响应 ActionEvent 进行技能筛选
 * - 发布 SkillPreCastEvent 进入施法流程
 *
 * 不负责：
 * - 目标选择（由 TargetSelectionSystem 处理）
 * - 技能执行（由 AbilityExecutionSystem 处理）
 */
export class AbilityContainer {
  private _abilities = new Map<string, Ability>();
  private _owner: Unit;
  private _defaultTarget: Unit | null = null;
  private _defaultAttack: Ability | null = null;
  private _handlers: Map<string, (event: unknown) => void> = new Map();

  constructor(owner: Unit) {
    this._owner = owner;
    this._subscribeToEvents();
  }

  private _subscribeToEvents(): void {
    const actionEventHandler = (event: unknown) =>
      this._onActionTrigger(event as ActionEvent);
    EventBus.instance.subscribe<ActionEvent>(
      'ActionEvent',
      actionEventHandler,
      EventPriorityLevel.ACTION_TRIGGER,
    );
    this._handlers.set('ActionEvent', actionEventHandler);
  }

  /**
   * 响应行动触发事件，执行技能筛选
   * 支持控制三分法：NO_ACTION 由 BattleEngineV5 拦截，此处处理 NO_SKILL / NO_BASIC
   */
  private _onActionTrigger(event: ActionEvent): void {
    // 仅当前出手单位是自己时，才执行筛选
    // 使用对象引用检查，在内存中最为稳固
    if (event.caster !== this._owner) {
      return;
    }

    // 控制三分法检查
    // NO_ACTION 已在 BattleEngineV5.executeActionPhase 中拦截，此处做防御性检查
    if (
      this._owner.tags.hasAnyTag([
        GameplayTags.STATUS.NO_ACTION,
        GameplayTags.STATUS.STUNNED,
      ])
    ) {
      return;
    }

    const isSkillBlocked = this._owner.tags.hasTag(
      GameplayTags.STATUS.NO_SKILL,
    );
    const isBasicBlocked = this._owner.tags.hasTag(
      GameplayTags.STATUS.NO_BASIC,
    );

    const opponent = this._getDefaultTarget();

    // 禁技时跳过所有主动技能，直接尝试普攻
    // 未禁技时优先匹配主动技能
    if (!isSkillBlocked) {
      const abilitiesToCast: Array<{ ability: ActiveSkill; target: Unit }> = [];

      for (const ability of this._abilities.values()) {
        if (ability.type !== AbilityType.ACTIVE_SKILL) {
          continue;
        }

        const activeSkill = ability as ActiveSkill;

        let resolvedTarget: Unit | null = null;
        const policy = activeSkill.targetPolicy;

        if (policy.team === 'self' || policy.team === 'ally') {
          resolvedTarget = this._owner;
        } else {
          resolvedTarget = opponent;
        }

        if (!resolvedTarget || !resolvedTarget.isAlive()) {
          continue;
        }

        const context: AbilityContext = {
          caster: this._owner,
          target: resolvedTarget,
        };

        if (activeSkill.canTrigger(context)) {
          abilitiesToCast.push({
            ability: activeSkill,
            target: resolvedTarget,
          });
        }
      }

      if (abilitiesToCast.length > 0) {
        const bestChoice = abilitiesToCast.sort(
          (a, b) => b.ability.priority - a.ability.priority,
        )[0];
        this._prepareCast(bestChoice.ability, bestChoice.target);
        return;
      }
    }

    // 无可用技能（或禁技状态）时回退到普攻，禁普攻则什么都不做
    if (
      !isBasicBlocked &&
      opponent &&
      opponent.id !== this._owner.id &&
      opponent.isAlive()
    ) {
      this._prepareCast(this._getDefaultAttack(), opponent);
    } else {
      EventBus.instance.publish<ControlledSkipEvent>({
        type: 'ControlledSkipEvent',
        priority: EventPriorityLevel.COMBAT_LOG,
        timestamp: Date.now(),
        unit: this._owner,
        controlTag: GameplayTags.STATUS.NO_ACTION,
      });
    }
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

  /**
   * 准备施法：发布施法前摇事件
   */
  private _prepareCast(ability: Ability, target: Unit): void {
    EventBus.instance.publish<SkillPreCastEvent>({
      type: 'SkillPreCastEvent',
      priority: EventPriorityLevel.SKILL_PRE_CAST,
      timestamp: Date.now(),
      caster: this._owner,
      target,
      ability,
      isInterrupted: false,
    });
  }

  // ===== 目标管理（简化版，由外部设置） =====

  setDefaultTarget(target: Unit): void {
    this._defaultTarget = target;
  }

  clearDefaultTarget(): void {
    this._defaultTarget = null;
  }

  private _getDefaultTarget(): Unit | null {
    return this._defaultTarget;
  }

  private _getDefaultAttack(): Ability {
    if (!this._defaultAttack) {
      this._defaultAttack = new BasicAttack();
      this._defaultAttack.setOwner(this._owner);
      this._defaultAttack.setActive(true);
    }
    return this._defaultAttack;
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

  // ===== 克隆 =====

  clone(owner: Unit): AbilityContainer {
    const clonedContainer = new AbilityContainer(owner);

    for (const ability of this._abilities.values()) {
      const clonedAbility = ability.clone();
      clonedContainer._abilities.set(clonedAbility.id, clonedAbility);
      clonedAbility.setOwner(owner);
      clonedAbility.setActive(true);
    }

    return clonedContainer;
  }

  // ===== 销毁 =====

  destroy(): void {
    // 取消所有事件订阅
    for (const [eventType, handler] of this._handlers) {
      EventBus.instance.unsubscribe(eventType, handler);
    }
    this._handlers.clear();

    // 停用所有技能
    for (const ability of this._abilities.values()) {
      ability.setActive(false);
    }
  }
}
