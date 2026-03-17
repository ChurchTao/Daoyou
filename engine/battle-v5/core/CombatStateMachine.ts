import { CombatPhase } from './types';
import { EventBus } from './EventBus';

interface CombatState {
  phase: CombatPhase;
  onEnter(): void;
  onUpdate(): void;
  onExit(): void;
}

export interface CombatContext {
  turn: number;
  maxTurns: number;
  units: Map<string, unknown>;
  battleEnded: boolean;
  winner: string | null;
}

const EVENT_PRIORITY = {
  BATTLE_LIFECYCLE: 100,
  ROUND_START: 90,
  ROUND_PRE: 85,
  TURN_ORDER: 80,
  ACTION: 70,
  ROUND_POST: 60,
  VICTORY_CHECK: 50,
} as const;

export class CombatStateMachine {
  private _currentState: CombatState | null = null;
  private _states = new Map<CombatPhase, CombatState>();
  private _context: CombatContext;

  constructor(context: CombatContext) {
    this._context = context;
    this._initStates();
  }

  private _initStates(): void {
    // INIT 状态
    this._states.set(CombatPhase.INIT, {
      phase: CombatPhase.INIT,
      onEnter: () => {
        EventBus.instance.publish({
          type: 'BattleInitEvent',
          priority: EVENT_PRIORITY.BATTLE_LIFECYCLE,
          timestamp: Date.now(),
        });
      },
      onUpdate: () => {}, // No auto-transition
      onExit: () => {},
    });

    // DESTINY_AWAKEN 状态
    this._states.set(CombatPhase.DESTINY_AWAKEN, {
      phase: CombatPhase.DESTINY_AWAKEN,
      onEnter: () => {
        EventBus.instance.publish({
          type: 'DestinyAwakenEvent',
          priority: EVENT_PRIORITY.BATTLE_LIFECYCLE,
          timestamp: Date.now(),
          data: { turn: this._context.turn },
        });
      },
      onUpdate: () => {}, // No auto-transition
      onExit: () => {},
    });

    // ROUND_START 状态
    this._states.set(CombatPhase.ROUND_START, {
      phase: CombatPhase.ROUND_START,
      onEnter: () => {
        EventBus.instance.publish({
          type: 'RoundStartEvent',
          priority: EVENT_PRIORITY.ROUND_START,
          timestamp: Date.now(),
          data: { turn: this._context.turn },
        });
      },
      onUpdate: () => {}, // No auto-transition
      onExit: () => {},
    });

    // ROUND_PRE 状态
    this._states.set(CombatPhase.ROUND_PRE, {
      phase: CombatPhase.ROUND_PRE,
      onEnter: () => {
        EventBus.instance.publish({
          type: 'RoundPreEvent',
          priority: EVENT_PRIORITY.ROUND_PRE,
          timestamp: Date.now(),
          data: { turn: this._context.turn },
        });
      },
      onUpdate: () => {}, // No auto-transition
      onExit: () => {},
    });

    // TURN_ORDER 状态
    this._states.set(CombatPhase.TURN_ORDER, {
      phase: CombatPhase.TURN_ORDER,
      onEnter: () => {
        EventBus.instance.publish({
          type: 'TurnOrderEvent',
          priority: EVENT_PRIORITY.TURN_ORDER,
          timestamp: Date.now(),
          data: { turn: this._context.turn },
        });
      },
      onUpdate: () => {}, // No auto-transition
      onExit: () => {},
    });

    // ACTION 状态
    this._states.set(CombatPhase.ACTION, {
      phase: CombatPhase.ACTION,
      onEnter: () => {
        EventBus.instance.publish({
          type: 'ActionEvent',
          priority: EVENT_PRIORITY.ACTION,
          timestamp: Date.now(),
          data: { turn: this._context.turn },
        });
      },
      onUpdate: () => {}, // No auto-transition
      onExit: () => {},
    });

    // ROUND_POST 状态
    this._states.set(CombatPhase.ROUND_POST, {
      phase: CombatPhase.ROUND_POST,
      onEnter: () => {
        EventBus.instance.publish({
          type: 'RoundPostEvent',
          priority: EVENT_PRIORITY.ROUND_POST,
          timestamp: Date.now(),
          data: { turn: this._context.turn },
        });
      },
      onUpdate: () => {}, // No auto-transition
      onExit: () => {},
    });

    // VICTORY_CHECK 状态
    this._states.set(CombatPhase.VICTORY_CHECK, {
      phase: CombatPhase.VICTORY_CHECK,
      onEnter: () => {
        EventBus.instance.publish({
          type: 'VictoryCheckEvent',
          priority: EVENT_PRIORITY.VICTORY_CHECK,
          timestamp: Date.now(),
          data: { turn: this._context.turn },
        });
      },
      onUpdate: () => {
        // VICTORY_CHECK is a terminal state in each turn cycle
        // BattleEngineV5 will decide whether to continue or end
      },
      onExit: () => {},
    });

    // END 状态
    this._states.set(CombatPhase.END, {
      phase: CombatPhase.END,
      onEnter: () => {
        EventBus.instance.publish({
          type: 'BattleEndEvent',
          priority: EVENT_PRIORITY.BATTLE_LIFECYCLE,
          timestamp: Date.now(),
          data: {
            winner: this._context.winner,
            turns: this._context.turn,
          },
        });
      },
      onUpdate: () => {}, // 终态，不转换
      onExit: () => {},
    });
  }

  private _switchTo(phase: CombatPhase): void {
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

  public start(): void {
    this._switchTo(CombatPhase.INIT);
  }

  public getCurrentPhase(): CombatPhase | null {
    return this._currentState?.phase || null;
  }

  public getContext(): CombatContext {
    return this._context;
  }

  public endBattle(winner: string): void {
    this._context.battleEnded = true;
    this._context.winner = winner;
  }
}
