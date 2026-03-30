import { CombatContext, CombatStateMachine } from './core/CombatStateMachine';
import { EventBus } from './core/EventBus';
import {
  ActionEvent,
  ActionPostEvent,
  ActionPreEvent,
  ControlledSkipEvent,
  EventPriorityLevel,
} from './core/events';
import { GameplayTags } from './core/GameplayTags';
import { AttributeType, CombatPhase } from './core/types';
import { ActionExecutionSystem } from './systems/ActionExecutionSystem';
import { DamageSystem } from './systems/DamageSystem';
import { LogSpan } from './systems/log';
import { CombatLogSystem } from './systems/log/CombatLogSystem';
import { BattleStateRecorder } from './systems/state/BattleStateRecorder';
import { BattleStateTimeline } from './systems/state/types';
import { VictorySystem } from './systems/VictorySystem';
import { Unit } from './units/Unit';

export interface BattleResult {
  winner: string;
  loser?: string;
  turns: number;
  logs: string[];
  logSpans?: LogSpan[]; // 新增，支持结构化日志
  /** 状态时间线：每次行动前后的双方状态帧，含 delta */
  stateTimeline?: BattleStateTimeline;
  winnerSnapshot: unknown;
  loserSnapshot: unknown;
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
  private _logSystem: CombatLogSystem;
  private _eventBus: EventBus;
  private _actionSystem: ActionExecutionSystem;
  private _damageSystem: DamageSystem;
  private _stateRecorder: BattleStateRecorder;

  constructor(player: Unit, opponent: Unit) {
    this._player = player;
    this._opponent = opponent;
    this._eventBus = EventBus.instance;

    this._logSystem = new CombatLogSystem();
    this._logSystem.subscribe(this._eventBus);

    // 初始化事件驱动系统
    this._actionSystem = new ActionExecutionSystem();
    this._damageSystem = new DamageSystem();
    this._stateRecorder = new BattleStateRecorder();

    // 初始化战斗上下文
    const context: CombatContext = {
      turn: 0,
      maxTurns: VictorySystem.getMaxTurns(),
      units: new Map([
        [player.id, player],
        [opponent.id, opponent],
      ]),
      battleEnded: false,
      winner: null,
      currentCaster: null,
    };

    this._stateMachine = new CombatStateMachine(context);
  }

  /**
   * 执行战斗模拟
   */
  execute(): BattleResult {
    // 启动状态机（进入 INIT 状态）
    this._stateMachine.start();

    // 记录初始状态（基线快照）
    this._stateRecorder.record(
      'battle_init',
      0,
      [this._player, this._opponent],
      undefined,
      this._logSystem.getActiveSpanId(),
    );

    // 主循环
    while (!this.isBattleOver()) {
      this.executeTurn();
    }

    // 进入结束状态
    this._stateMachine.switchTo(CombatPhase.END);

    // 记录终态快照
    this._stateRecorder.record(
      'battle_end',
      this.getContext().turn,
      [this._player, this._opponent],
      undefined,
      this._logSystem.getActiveSpanId(),
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
    this._stateMachine.switchTo(CombatPhase.ROUND_START);

    // ROUND_PRE 阶段（DOT、持续效果触发）
    this._stateMachine.switchTo(CombatPhase.ROUND_PRE);

    // TURN_ORDER 阶段（行动顺序确定）
    this._stateMachine.switchTo(CombatPhase.TURN_ORDER);

    // ACTION 阶段（执行行动）
    this.executeActionPhase();

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
      // 发布行动前事件（DOT / 持续效果在此触发）
      this._eventBus.publish<ActionPreEvent>({
        type: 'ActionPreEvent',
        priority: EventPriorityLevel.ACTION_TRIGGER,
        timestamp: Date.now(),
        caster: actor,
      });

      // action_pre 帧：ActionPreEvent 处理完毕后（DOT 已结算）
      this._stateRecorder.record(
        'action_pre',
        this.getContext().turn,
        [this._player, this._opponent],
        actor.id,
        this._logSystem.getActiveSpanId(),
      );

      if (!actor.isAlive()) continue;
      // ===== 控制状态检查 =====
      // 禁行动：包括紧傅标签（向后兼容）和新式 NO_ACTION 标签
      const controlTag = actor.tags.hasTag(GameplayTags.STATUS.CONTROL);
      if (controlTag !== null) {
        this._eventBus.publish<ControlledSkipEvent>({
          type: 'ControlledSkipEvent',
          priority: EventPriorityLevel.COMBAT_LOG,
          timestamp: Date.now(),
          unit: actor,
          controlTag:
            actor.tags.getFirstMatchingTag(GameplayTags.STATUS.CONTROL) ??
            GameplayTags.STATUS.NO_ACTION,
        });
        continue;
      }
      // 设置当前出手单位
      this._stateMachine.setCurrentCaster(actor);

      // 设置默认目标（敌方单位）
      const target = actor === this._player ? this._opponent : this._player;
      if (target.isAlive()) {
        actor.abilities.setDefaultTarget(target);
      }

      // 发布行动事件，触发整个技能流程
      this._eventBus.publish<ActionEvent>({
        type: 'ActionEvent',
        priority: EventPriorityLevel.ACTION_TRIGGER,
        timestamp: Date.now(),
        caster: actor,
      });

      // 清除默认目标
      actor.abilities.clearDefaultTarget();

      // 清除当前出手单位
      this._stateMachine.clearCurrentCaster();

      // 发布行动后置事件（Buff 过期处理阶段开始）
      this._eventBus.publish<ActionPostEvent>({
        type: 'ActionPostEvent',
        priority: EventPriorityLevel.ACTION_TRIGGER,
        timestamp: Date.now(),
        caster: actor,
      });

      // 处理 Buff 过期
      this.processBuffs(actor);

      // 更新技能冷却
      actor.abilities.tickAbilitiesCooldown();

      // action_post 帧：技能执行 + Buff 过期 + CD 刷新全部完成后
      this._stateRecorder.record(
        'action_post',
        this.getContext().turn,
        [this._player, this._opponent],
        actor.id,
        this._logSystem.getActiveSpanId(),
      );
    }
  }

  /**
   * 处理 Buff 持续时间
   */
  private processBuffs(unit: Unit): void {
    const buffs = unit.buffs.getAllBuffs();
    for (const buff of buffs) {
      buff.tickDuration();
      if (buff.isExpired()) {
        unit.buffs.removeBuffExpired(buff.id);
      }
    }
  }

  /**
   * 获取按速度排序的单位
   */
  private getSortedUnits(): Unit[] {
    return [this._player, this._opponent]
      .filter((u) => u.isAlive())
      .sort((a, b) => {
        const speedA = a.attributes.getValue(AttributeType.SPEED);
        const speedB = b.attributes.getValue(AttributeType.SPEED);
        return speedB - speedA;
      });
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

    return {
      winner: winner.id,
      loser: loser?.id,
      turns: context.turn,
      logs: this._logSystem.getPlayerLogs(),
      logSpans: this._logSystem.getSpans(),
      stateTimeline: this._stateRecorder.getTimeline([
        this._player,
        this._opponent,
      ]),
      winnerSnapshot: winner.getSnapshot(),
      loserSnapshot: loser?.getSnapshot(),
    };
  }

  get logSystem(): CombatLogSystem {
    return this._logSystem;
  }

  /**
   * 销毁引擎，清理系统资源
   */
  destroy(): void {
    this._actionSystem.destroy();
    this._damageSystem.destroy();
    this._logSystem.unsubscribe(this._eventBus);
    this._logSystem.destroy();
  }
}
