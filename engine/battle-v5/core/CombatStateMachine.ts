/**
 * CombatStateMachine - 战斗状态机
 *
 * GAS+EDA 架构设计：
 * - 管理战斗的阶段流转
 * - 状态转换时自动发布对应事件
 * - 每个阶段职责单一，便于扩展
 *
 * 状态流程：
 * INIT → DESTINY_AWAKEN → ROUND_START → ROUND_PRE → TURN_ORDER → ACTION → ROUND_POST → VICTORY_CHECK
 *                                                                      ↑                    |
 *                                                                      └────────────────────┘
 *                                                                           (下一回合)
 *                                                                                                 ↓
 *                                                                                               END
 */
import { CombatPhase } from './types';
import { EventBus } from './EventBus';
import {
  BattleInitEvent,
  DestinyAwakenEvent,
  RoundStartEvent,
  RoundPreEvent,
  TurnOrderEvent,
  RoundPostEvent,
  VictoryCheckEvent,
  BattleEndEvent,
  EventPriorityLevel,
} from './events';
import { Unit } from '../units/Unit';
import { AttributeType } from './types';

/**
 * 战斗状态接口
 */
interface CombatState {
  phase: CombatPhase;
  onEnter(): void;
  onUpdate(): void;
  onExit(): void;
}

/**
 * 战斗上下文 - 存储战斗过程中的共享数据
 */
export interface CombatContext {
  turn: number;
  maxTurns: number;
  units: Map<string, Unit>;
  battleEnded: boolean;
  winner: string | null;
  currentCaster: Unit | null;
}

/**
 * CombatStateMachine - 战斗状态机
 *
 * 职责：
 * - 管理战斗阶段状态
 * - 状态转换时发布对应事件
 * - 维护战斗上下文数据
 */
export class CombatStateMachine {
  private _currentState: CombatState | null = null;
  private _states = new Map<CombatPhase, CombatState>();
  private _context: CombatContext;

  constructor(context: CombatContext) {
    this._context = context;
    this._initStates();
  }

  /**
   * 初始化所有战斗状态
   */
  private _initStates(): void {
    // INIT 状态 - 战斗初始化
    this._states.set(CombatPhase.INIT, {
      phase: CombatPhase.INIT,
      onEnter: () => {
        const units = Array.from(this._context.units.values());
        EventBus.instance.publish<BattleInitEvent>({
          type: 'BattleInitEvent',
          priority: EventPriorityLevel.ACTION_TRIGGER,
          timestamp: Date.now(),
          player: units[0],
          opponent: units[1],
        });
      },
      onUpdate: () => {},
      onExit: () => {},
    });

    // DESTINY_AWAKEN 状态 - 命格觉醒阶段
    this._states.set(CombatPhase.DESTINY_AWAKEN, {
      phase: CombatPhase.DESTINY_AWAKEN,
      onEnter: () => {
        EventBus.instance.publish<DestinyAwakenEvent>({
          type: 'DestinyAwakenEvent',
          priority: EventPriorityLevel.ACTION_TRIGGER,
          timestamp: Date.now(),
          turn: this._context.turn,
        });
      },
      onUpdate: () => {},
      onExit: () => {},
    });

    // ROUND_START 状态 - 回合开始
    this._states.set(CombatPhase.ROUND_START, {
      phase: CombatPhase.ROUND_START,
      onEnter: () => {
        EventBus.instance.publish<RoundStartEvent>({
          type: 'RoundStartEvent',
          priority: EventPriorityLevel.ACTION_TRIGGER,
          timestamp: Date.now(),
          turn: this._context.turn,
        });
      },
      onUpdate: () => {},
      onExit: () => {},
    });

    // ROUND_PRE 状态 - 回合前置结算（DOT、持续效果触发）
    this._states.set(CombatPhase.ROUND_PRE, {
      phase: CombatPhase.ROUND_PRE,
      onEnter: () => {
        EventBus.instance.publish<RoundPreEvent>({
          type: 'RoundPreEvent',
          priority: EventPriorityLevel.ROUND_PRE,
          timestamp: Date.now(),
          turn: this._context.turn,
        });
      },
      onUpdate: () => {},
      onExit: () => {},
    });

    // TURN_ORDER 状态 - 行动顺序确定
    this._states.set(CombatPhase.TURN_ORDER, {
      phase: CombatPhase.TURN_ORDER,
      onEnter: () => {
        // 按速度排序单位
        const units = Array.from(this._context.units.values())
          .filter(u => u.isAlive())
          .sort((a, b) => b.attributes.getValue(AttributeType.SPEED) - a.attributes.getValue(AttributeType.SPEED));
        EventBus.instance.publish<TurnOrderEvent>({
          type: 'TurnOrderEvent',
          priority: EventPriorityLevel.ACTION_TRIGGER,
          timestamp: Date.now(),
          turn: this._context.turn,
          units,
        });
      },
      onUpdate: () => {},
      onExit: () => {},
    });

    // ACTION 状态 - 行动阶段（由 BattleEngineV5 单独处理每个单位）
    this._states.set(CombatPhase.ACTION, {
      phase: CombatPhase.ACTION,
      onEnter: () => {
        // ACTION 事件由 BattleEngineV5 在每个单位行动时单独发布
        // 这里不发布事件，因为需要传递具体的 caster
      },
      onUpdate: () => {},
      onExit: () => {},
    });

    // ROUND_POST 状态 - 回合后置结算
    this._states.set(CombatPhase.ROUND_POST, {
      phase: CombatPhase.ROUND_POST,
      onEnter: () => {
        EventBus.instance.publish<RoundPostEvent>({
          type: 'RoundPostEvent',
          priority: EventPriorityLevel.POST_SETTLE,
          timestamp: Date.now(),
          turn: this._context.turn,
        });
      },
      onUpdate: () => {},
      onExit: () => {},
    });

    // VICTORY_CHECK 状态 - 胜负判定
    this._states.set(CombatPhase.VICTORY_CHECK, {
      phase: CombatPhase.VICTORY_CHECK,
      onEnter: () => {
        EventBus.instance.publish<VictoryCheckEvent>({
          type: 'VictoryCheckEvent',
          priority: EventPriorityLevel.POST_SETTLE,
          timestamp: Date.now(),
          turn: this._context.turn,
          battleEnded: this._context.battleEnded,
          winner: this._context.winner,
        });
      },
      onUpdate: () => {},
      onExit: () => {},
    });

    // END 状态 - 战斗结束
    this._states.set(CombatPhase.END, {
      phase: CombatPhase.END,
      onEnter: () => {
        EventBus.instance.publish<BattleEndEvent>({
          type: 'BattleEndEvent',
          priority: EventPriorityLevel.ACTION_TRIGGER,
          timestamp: Date.now(),
          winner: this._context.winner,
          turns: this._context.turn,
        });
      },
      onUpdate: () => {},
      onExit: () => {},
    });
  }

  /**
   * 切换到指定状态
   * EDA 模式：状态转换时自动发布对应事件
   * @param phase 目标阶段
   */
  public switchTo(phase: CombatPhase): void {
    const nextState = this._states.get(phase);
    if (!nextState) {
      throw new Error(`Invalid phase: ${phase}`);
    }

    if (this._currentState) {
      this._currentState.onExit();
    }

    this._currentState = nextState;
    this._currentState.onEnter();
    this._currentState.onUpdate();
  }

  /**
   * 启动状态机（进入 INIT 状态）
   */
  public start(): void {
    this.switchTo(CombatPhase.INIT);
  }

  /**
   * 获取当前阶段
   */
  public getCurrentPhase(): CombatPhase | null {
    return this._currentState?.phase || null;
  }

  /**
   * 获取战斗上下文
   */
  public getContext(): CombatContext {
    return this._context;
  }

  /**
   * 结束战斗
   */
  public endBattle(winner: string): void {
    this._context.battleEnded = true;
    this._context.winner = winner;
  }

  /**
   * 设置当前出手单位
   */
  public setCurrentCaster(unit: Unit): void {
    this._context.currentCaster = unit;
  }

  /**
   * 获取当前出手单位
   */
  public getCurrentCaster(): Unit | null {
    return this._context.currentCaster;
  }

  /**
   * 清除当前出手单位
   */
  public clearCurrentCaster(): void {
    this._context.currentCaster = null;
  }
}
