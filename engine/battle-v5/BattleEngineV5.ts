import { Unit } from './units/Unit';
import { CombatStateMachine, CombatContext } from './core/CombatStateMachine';
import { EventBus } from './core/EventBus';
import { CombatPhase, AttributeType } from './core/types';
import { CombatLogSystem } from './systems/CombatLogSystem';
import { VictorySystem } from './systems/VictorySystem';
import { ActionExecutionSystem } from './systems/ActionExecutionSystem';
import { DamageSystem } from './systems/DamageSystem';
import { ActionEvent } from './core/events';

export interface BattleResult {
  winner: string;
  loser?: string;
  turns: number;
  logs: string[];
  winnerSnapshot: unknown;
  loserSnapshot: unknown;
}

/**
 * V5 战斗引擎主入口
 * 集成所有子系统，提供完整的战斗模拟功能
 */
export class BattleEngineV5 {
  private _player: Unit;
  private _opponent: Unit;
  private _stateMachine: CombatStateMachine;
  private _logSystem: CombatLogSystem;
  private _eventBus: EventBus;
  private _actionSystem: ActionExecutionSystem;
  private _damageSystem: DamageSystem;

  constructor(player: Unit, opponent: Unit) {
    this._player = player;
    this._opponent = opponent;
    this._eventBus = EventBus.instance;

    // Note: We don't reset the EventBus here because AbilityContainer
    // and other systems have already subscribed in their constructors
    // this._eventBus.reset();
    this._logSystem = new CombatLogSystem();

    // Initialize event-driven systems
    this._actionSystem = new ActionExecutionSystem();
    this._damageSystem = new DamageSystem();

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
    // 启动状态机
    this._stateMachine.start();

    // 主循环
    while (!this.isBattleOver()) {
      this.executeTurn();
    }

    // 生成结果
    return this.generateResult();
  }

  /**
   * 执行单个回合
   */
  private executeTurn(): void {
    const context = this.getContext();
    context.turn++;

    // 检查回合上限
    if (context.turn > context.maxTurns) {
      context.battleEnded = true;
      // 胜负判定：血量百分比高的获胜
      const victoryResult = VictorySystem.checkVictory(
        [this._player, this._opponent],
        context.turn,
      );
      context.winner = victoryResult.winner ?? null;
      this._stateMachine.endBattle(victoryResult.winner ?? '');
      return;
    }

    // 回合开始
    this._logSystem.log(context.turn, CombatPhase.ROUND_START, `第${context.turn}回合开始`);

    // 执行行动阶段（新的事件驱动流程）
    this.executeActionPhase();

    // 回合结束
    this.processTurnEnd();

    // 胜负判定
    const victoryResult = VictorySystem.checkVictory(
      [this._player, this._opponent],
      context.turn,
    );

    if (victoryResult.battleEnded) {
      context.battleEnded = true;
      context.winner = victoryResult.winner ?? null;
      this._stateMachine.endBattle(victoryResult.winner ?? '');
    }
  }

  /**
   * 执行行动阶段（事件驱动）
   */
  private executeActionPhase(): void {
    const units = this.getSortedUnits();

    for (const actor of units) {
      if (!actor.isAlive()) continue;

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
        priority: 80,
        timestamp: Date.now(),
        caster: actor,
      });

      // 清除默认目标
      actor.abilities.clearDefaultTarget();

      // 清除当前出手单位
      this._stateMachine.clearCurrentCaster();
    }
  }

  /**
   * 处理回合结束
   */
  private processTurnEnd(): void {
    // 处理技能冷却递减
    this.processAbilityCooldowns(this._player);
    this.processAbilityCooldowns(this._opponent);

    // 处理 Buff 持续时间
    this.processBuffs(this._player);
    this.processBuffs(this._opponent);
  }

  /**
   * 处理技能冷却递减
   */
  private processAbilityCooldowns(unit: Unit): void {
    const abilities = unit.abilities.getAllAbilities();
    for (const ability of abilities) {
      ability.tickCooldown();
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
        unit.buffs.removeBuff(buff.id);
      }
    }
  }

  /**
   * 获取按速度排序的单位
   */
  private getSortedUnits(): Unit[] {
    const units = [this._player, this._opponent];
    return units.sort((a, b) => {
      const speedA = a.attributes.getValue(AttributeType.AGILITY);
      const speedB = b.attributes.getValue(AttributeType.AGILITY);
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
    const winner = context.winner === this._player.id ? this._player : this._opponent;
    const loser = winner === this._player ? this._opponent : this._player;

    this._logSystem.logBattleEnd(winner.name, context.turn);

    return {
      winner: winner.id,
      loser: loser?.id,
      turns: context.turn,
      logs: this._logSystem.getLogs().map((log) => log.message),
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
    this._logSystem.clear();
    // Note: 不重置 EventBus 单例，因为其他系统可能仍在使用
    // Note: AbilityContainer 的销毁由 Unit 负责
  }
}
