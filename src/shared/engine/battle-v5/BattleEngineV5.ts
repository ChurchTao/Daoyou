import { GameplayTags } from '@shared/engine/shared/tag-domain';
import { CombatContext, CombatStateMachine } from './core/CombatStateMachine';
import { executeEffectConfigs } from './core/effectExecutor';
import type { EventBus } from './core/EventBus';
import {
  ActionEvent,
  ActionPostEvent,
  ActionPreEvent,
  ActionStateEvent,
  ControlledSkipEvent,
  SkillPreCastEvent,
} from './core/events';
import {
  beginRuntimeAction,
  clearPendingActionStates,
  consumeQueuedAction,
  consumeSkippedAction,
  peekQueuedAction,
  setRuntimeRound,
  shouldTickBuffDuration,
} from './core/runtimeState';
import { CombatPhase } from './core/types';
import { EffectExecutionContextV3 } from './effects/Effect';
import { AbilityFactory } from './factories/AbilityFactory';
import { ActionExecutionSystem } from './systems/ActionExecutionSystem';
import { DamageSystem } from './systems/DamageSystem';
import { BattleStateRecorder } from './systems/state/BattleStateRecorder';
import { UnitStateSnapshot } from './systems/state/types';
import { VictorySystem } from './systems/VictorySystem';
import { Unit } from './units/Unit';
import {
  CombatMechanicCodeV3,
  CombatRecordBuilderV3,
  toBattleStateTimelineV3,
  type BattleStateTimelineV3,
  type CombatFactDraftV3,
  type CombatSequenceV3,
} from './v3';
import { CombatResultEmitterV3 } from './v3/CombatResultEmitterV3';
import { CombatAttributionV3, CombatSystemSourceV3 } from './v3/origin';
import type { BattleRuntime } from './runtime/BattleRuntime';
import { BattleRoster } from './core/BattleRoster';
import { InitiativeSystem } from './systems/InitiativeSystem';

export interface BattleResult {
  winner: string;
  loser: string;
  turns: number;
  sequences: CombatSequenceV3[];
  /** 状态时间线：每次行动前后的双方状态帧，含 delta */
  stateTimeline: BattleStateTimelineV3;
  winnerSnapshot: UnitStateSnapshot;
  loserSnapshot: UnitStateSnapshot;
}

/**
 * BattleEngineV5 - V5 战斗引擎主入口
 *
 * GAS+EDA 架构设计：
 * - 通过状态机驱动战斗流程
 * - 每个阶段转换自动发布对应事件
 * - 子系统（DamageSystem、Buff等）通过订阅事件响应
 *
 * 战斗流程（状态机驱动）：
 * INIT → ROUND_START → ROUND_PRE → TURN_ORDER → ACTION → ROUND_POST → VICTORY_CHECK
 *                                                          ↑                    |
 *                                                          └────────────────────┘
 */
export class BattleEngineV5 {
  private _player: Unit;
  private _opponent: Unit;
  private _stateMachine: CombatStateMachine;
  private _recordBuilder: CombatRecordBuilderV3;
  private _eventBus: EventBus;
  private _actionSystem: ActionExecutionSystem;
  private _damageSystem: DamageSystem;
  private _stateRecorder: BattleStateRecorder;
  readonly runtime: BattleRuntime;
  readonly roster: BattleRoster;

  constructor(player: Unit, opponent: Unit, runtime: BattleRuntime = player.runtime) {
    if (player.runtime !== runtime || opponent.runtime !== runtime) {
      throw new Error('All battle units must belong to the engine runtime');
    }
    this._player = player;
    this._opponent = opponent;
    this.runtime = runtime;
    this.roster = BattleRoster.fromDuel(player, opponent);
    this._eventBus = runtime.events;

    this._recordBuilder = new CombatRecordBuilderV3(this._eventBus);

    // 初始化事件驱动系统
    this._actionSystem = new ActionExecutionSystem(this._eventBus);
    this._damageSystem = new DamageSystem(this._eventBus, runtime.random);
    this._stateRecorder = new BattleStateRecorder();

    // 初始化战斗上下文
    const context: CombatContext = {
      turn: 0,
      maxTurns: VictorySystem.getMaxTurns(),
      units: new Map(this.roster.units),
      battleEnded: false,
      winner: null,
      currentCaster: null,
    };

    this._stateMachine = new CombatStateMachine(context, this._eventBus);
  }

  /**
   * 执行战斗模拟
   */
  execute(): BattleResult {
    this._recordBuilder.runInSequence(
      { phase: 'battle_init', turn: 0 },
      (sequence) => {
        this._stateMachine.start();
        this._stateRecorder.record(
          'battle_init',
          0,
          [this._player, this._opponent],
          undefined,
          sequence.id,
        );
      },
    );

    // 主循环
    while (!this.isBattleOver()) {
      this.executeTurn();
    }

    // 进入结束状态
    this._recordBuilder.runInSequence(
      {
        phase: 'battle_end',
        turn: this.getContext().turn,
        actor: this.getContext().winner
          ? {
              id: this.getContext().winner!,
              name:
                this.getContext().winner === this._player.id
                  ? this._player.name
                  : this._opponent.name,
            }
          : undefined,
      },
      (sequence) => {
        this._stateMachine.switchTo(CombatPhase.END);
        this._stateRecorder.record(
          'battle_end',
          this.getContext().turn,
          [this._player, this._opponent],
          undefined,
          sequence.id,
        );
      },
    );

    // 生成结果
    return this.generateResult();
  }

  /**
   * 执行单个回合（状态机驱动）
   */
  private executeTurn(): void {
    const context = this.getContext();
    context.turn++;
    setRuntimeRound(this._player, context.turn);
    setRuntimeRound(this._opponent, context.turn);

    // 检查回合上限
    if (context.turn > context.maxTurns) {
      context.battleEnded = true;
      const victoryResult = VictorySystem.checkVictory(
        [this._player, this._opponent],
        context.turn,
      );
      context.winner = victoryResult.winner ?? null;
      this._stateMachine.endBattle(victoryResult.winner ?? '');
      return;
    }

    // ===== 状态机驱动战斗流程 =====

    // ROUND_START 阶段
    this._recordBuilder.runInSequence(
      { phase: 'round_start', turn: context.turn },
      () => {
        this._stateMachine.switchTo(CombatPhase.ROUND_START);
        this._stateMachine.switchTo(CombatPhase.ROUND_PRE);
      },
    );

    // TURN_ORDER 阶段（行动顺序确定）
    this._stateMachine.switchTo(CombatPhase.TURN_ORDER);

    // ACTION 阶段（执行行动）
    this.executeActionPhase();
    for (const unit of [this._player, this._opponent]) {
      if (!unit.isAlive()) clearPendingActionStates(unit);
    }

    // ROUND_POST 阶段（回合后置结算）
    this._stateMachine.switchTo(CombatPhase.ROUND_POST);

    // VICTORY_CHECK 阶段（胜负判定）
    const victoryResult = VictorySystem.checkVictory(
      [this._player, this._opponent],
      context.turn,
    );

    if (victoryResult.battleEnded) {
      context.battleEnded = true;
      context.winner = victoryResult.winner ?? null;
      this._stateMachine.endBattle(victoryResult.winner ?? '');
    }

    this._stateMachine.switchTo(CombatPhase.VICTORY_CHECK);
  }

  /**
   * 执行行动阶段（事件驱动）
   */
  private executeActionPhase(): void {
    const units = this.getSortedUnits();

    for (const actor of units) {
      if (!actor.isAlive()) {
        clearPendingActionStates(actor);
        continue;
      }
      beginRuntimeAction(actor);
      this._recordBuilder.runInSequence(
        {
          phase: 'action_pre',
          turn: this.getContext().turn,
          actor: { id: actor.id, name: actor.name },
        },
        (sequence) => {
          this._eventBus.publish<ActionPreEvent>({
            type: 'ActionPreEvent',
            timestamp: this.runtime.clock.now(),
            caster: actor,
          });
          this._stateRecorder.record(
            'action_pre',
            this.getContext().turn,
            [this._player, this._opponent],
            actor.id,
            sequence.id,
          );
        },
      );

      if (!actor.isAlive()) {
        clearPendingActionStates(actor);
        continue;
      }
      this._recordBuilder.runInSequence(
        {
          phase: 'action',
          turn: this.getContext().turn,
          actor: { id: actor.id, name: actor.name },
        },
        () => {
          actor.combatResources.beginAction();
          const pendingQueue = peekQueuedAction(actor);
          const hasUninterruptibleQueue =
            pendingQueue?.interruptPolicy === 'uninterruptible';

          // 不可打断后发优先于控制和调息；调息保留到下一次自身行动。
          if (!hasUninterruptibleQueue) {
            const controlTag = this.getSkipControlTag(actor);
            const skippedAction = consumeSkippedAction(actor);
            if (skippedAction) {
              this.commitSystemResult(actor, {
                type: 'action_state',
                stateType: 'rest',
                phase: 'skipped',
                name: skippedAction.name,
                remainingActions: 0,
              });
              this._eventBus.publish<ActionStateEvent>({
                type: 'ActionStateEvent',
                timestamp: this.runtime.clock.now(),
                unit: actor,
                stateType: 'rest',
                phase: 'skipped',
                name: skippedAction.name,
                remainingActions: 0,
                sourceAbility: skippedAction.sourceAbility,
                reason: skippedAction.reason,
              });
            }
            if (controlTag) {
              const cancelledQueue = consumeQueuedAction(actor);
              this.cancelQueuedAction(actor, cancelledQueue, controlTag);
              this.commitSystemResult(actor, {
                type: 'mechanic',
                code: CombatMechanicCodeV3.CONTROL_SKIP,
                payload: {
                  kind: 'control_skip',
                  controlName: this.getControlName(actor, controlTag),
                },
              });
              this._eventBus.publish<ControlledSkipEvent>({
                type: 'ControlledSkipEvent',
                timestamp: this.runtime.clock.now(),
                unit: actor,
                controlTag,
              });
              this.finalizeActorTurn(actor, true);
              return;
            }
            if (skippedAction) {
              this.finalizeActorTurn(actor, false);
              return;
            }
          }
          // 设置当前出手单位
          this._stateMachine.setCurrentCaster(actor);

          // 设置默认目标（敌方单位）
          const target = actor === this._player ? this._opponent : this._player;
          if (target.isAlive()) {
            actor.abilities.setDefaultTarget(target);
          }

          let queuedAction = consumeQueuedAction(actor);
          if (
            queuedAction?.interruptPolicy !== 'uninterruptible' &&
            actor.tags.hasTag(GameplayTags.STATUS.CONTROL.NO_SKILL)
          ) {
            this.cancelQueuedAction(
              actor,
              queuedAction,
              GameplayTags.STATUS.CONTROL.NO_SKILL,
            );
            queuedAction = undefined;
          }
          if (queuedAction && target.isAlive()) {
            const queuedAbility = AbilityFactory.create(queuedAction.ability);
            this._eventBus.publish<SkillPreCastEvent>({
              type: 'SkillPreCastEvent',
              timestamp: this.runtime.clock.now(),
              caster: actor,
              target,
              ability: queuedAbility,
              isInterrupted: false,
              interruptPolicy: queuedAction.interruptPolicy,
              hitPolicy: queuedAction.hitPolicy,
              queuedActionState: {
                name: '蓄势',
                sourceAbility: queuedAction.sourceAbility,
              },
            });
          } else {
            // 发布行动事件，触发整个技能流程
            this._eventBus.publish<ActionEvent>({
              type: 'ActionEvent',
              timestamp: this.runtime.clock.now(),
              caster: actor,
            });
          }

          // 清除默认目标
          actor.abilities.clearDefaultTarget();

          // 清除当前出手单位
          this._stateMachine.clearCurrentCaster();

          this.finalizeActorTurn(actor, false);
        },
      );
    }
  }

  private cancelQueuedAction(
    actor: Unit,
    queuedAction: ReturnType<typeof consumeQueuedAction>,
    reason: string,
  ): void {
    if (!queuedAction) return;
    if (queuedAction.cancelEffects.length) {
      executeEffectConfigs(
        queuedAction.cancelEffects,
        EffectExecutionContextV3.system({
          owner: actor,
          caster: actor,
          target: actor,
          source: CombatSystemSourceV3.ACTION_FLOW,
          trace: this._eventBus.reserveTrace(),
        }),
      );
    }
    this.commitSystemResult(actor, {
      type: 'action_state',
      stateType: 'queued_action',
      phase: 'cancelled',
      name: '蓄势',
      remainingActions: 0,
      ability: {
        id: queuedAction.ability.slug,
        name: queuedAction.ability.name,
      },
    });
    this._eventBus.publish<ActionStateEvent>({
      type: 'ActionStateEvent',
      timestamp: this.runtime.clock.now(),
      unit: actor,
      stateType: 'queued_action',
      phase: 'cancelled',
      name: '蓄势',
      remainingActions: 0,
      sourceAbility: queuedAction.sourceAbility,
      ability: {
        id: queuedAction.ability.slug,
        name: queuedAction.ability.name,
      },
      reason,
    });
  }

  private getSkipControlTag(actor: Unit): string | null {
    if (actor.tags.hasTag(GameplayTags.STATUS.CONTROL.STUNNED)) {
      return GameplayTags.STATUS.CONTROL.STUNNED;
    }

    if (actor.tags.hasTag(GameplayTags.STATUS.CONTROL.NO_ACTION)) {
      return GameplayTags.STATUS.CONTROL.NO_ACTION;
    }

    return null;
  }

  private getControlName(actor: Unit, controlTag: string): string {
    return (
      actor.buffs.getAllBuffs().find((buff) => buff.tags.hasTag(controlTag))
        ?.name ?? '控制效果'
    );
  }

  private commitSystemResult(unit: Unit, result: CombatFactDraftV3): void {
    const attribution = CombatAttributionV3.system(
      unit,
      CombatSystemSourceV3.ACTION_FLOW,
    );
    new CombatResultEmitterV3(this._eventBus).commit(unit, result, {
      origin: attribution.origin,
      parentTrace: this._eventBus.reserveTrace(),
    });
  }

  private finalizeActorTurn(actor: Unit, controlledSkip = false): void {
    this._recordBuilder.runInSequence(
      {
        phase: 'action_after',
        turn: this.getContext().turn,
        actor: { id: actor.id, name: actor.name },
      },
      (sequence) => {
        if (actor.isAlive()) {
          this._eventBus.publish<ActionPostEvent>({
            type: 'ActionPostEvent',
            timestamp: this.runtime.clock.now(),
            caster: actor,
          });
        }
        if (actor.isAlive()) {
          actor.combatResources.finishAction(
            controlledSkip,
            actor.getCurrentShield() > 0,
          );
        }
        if (actor.isAlive()) this.processBuffs(actor);
        if (actor.isAlive()) actor.abilities.tickAbilitiesCooldown();
        this._stateRecorder.record(
          'action_post',
          this.getContext().turn,
          [this._player, this._opponent],
          actor.id,
          sequence.id,
        );
      },
    );
  }

  /**
   * 处理 Buff 持续时间
   */
  private processBuffs(unit: Unit): void {
    const buffs = unit.buffs.getAllBuffs();
    for (const buff of buffs) {
      if (!unit.isAlive()) break;
      if (!shouldTickBuffDuration(unit, buff)) continue;
      buff.tickDuration();
      if (buff.isExpired()) {
        unit.buffs.removeBuffExpired(buff.id, {
          trace: this._eventBus.reserveTrace(),
        });
      }
    }
  }

  /**
   * 获取按行动速度排序的单位
   */
  private getSortedUnits(): Unit[] {
    return InitiativeSystem.order(
      this.roster.getLivingUnits(),
      this.runtime.random,
    );
  }

  /**
   * 检查战斗是否结束
   */
  private isBattleOver(): boolean {
    return this.getContext().battleEnded;
  }

  /**
   * 获取战斗上下文
   */
  private getContext(): CombatContext {
    return this._stateMachine.getContext();
  }

  /**
   * 生成战斗结果
   */
  private generateResult(): BattleResult {
    const context = this.getContext();
    const winner =
      context.winner === this._player.id ? this._player : this._opponent;
    const loser = winner === this._player ? this._opponent : this._player;
    const rawStateTimeline = this._stateRecorder.getTimeline([
      this._player,
      this._opponent,
    ]);
    const sequences = this._recordBuilder.getSequences();
    const stateTimeline = toBattleStateTimelineV3(rawStateTimeline);
    const finalFrame = stateTimeline.frames[stateTimeline.frames.length - 1];
    const winnerSnapshot = finalFrame?.units[winner.id];
    const loserSnapshot = finalFrame?.units[loser.id];

    if (!winnerSnapshot || !loserSnapshot) {
      throw new Error('战斗终态缺少参战单位状态快照');
    }

    return {
      winner: winner.id,
      loser: loser.id,
      turns: context.turn,
      sequences,
      stateTimeline,
      winnerSnapshot,
      loserSnapshot,
    };
  }

  /**
   * 销毁引擎，清理系统资源
   */
  destroy(): void {
    this._actionSystem.destroy();
    this._damageSystem.destroy();
    this._recordBuilder.destroy();
  }
}
