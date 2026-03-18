import { Unit } from './units/Unit';
import { CombatStateMachine, CombatContext } from './core/CombatStateMachine';
import { EventBus } from './core/EventBus';
import { CombatPhase, AttributeType } from './core/types';
import { CombatLogSystem } from './systems/CombatLogSystem';
import { VictorySystem } from './systems/VictorySystem';
import { DamageSystem } from './systems/DamageSystem';

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

  constructor(player: Unit, opponent: Unit) {
    this._player = player;
    this._opponent = opponent;
    this._eventBus = EventBus.instance;
    this._logSystem = new CombatLogSystem();

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

    // 行动阶段
    this.executeActions();

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
   * 执行行动阶段
   */
  private executeActions(): void {
    const units = this.getSortedUnits();
    const context = this.getContext();

    for (const actor of units) {
      if (!actor.isAlive()) continue;

      // 简化AI：随机使用可用技能
      const availableAbilities = actor.abilities.getAllAbilities();
      if (availableAbilities.length > 0) {
        const ability = availableAbilities[0];
        const target = actor === this._player ? this._opponent : this._player;

        // 计算伤害（简化版）
        const damageResult = DamageSystem.calculateDamage(actor, target, {
          baseDamage: 50,
          damageType: 'physical',
        });

        target.takeDamage(damageResult.finalDamage);

        // 记录日志
        this._logSystem.logDamage(
          context.turn,
          actor.name,
          target.name,
          damageResult.finalDamage,
          damageResult.isCritical,
        );
      }
    }
  }

  /**
   * 处理回合结束
   */
  private processTurnEnd(): void {
    // 处理 Buff 持续时间
    this.processBuffs(this._player);
    this.processBuffs(this._opponent);
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
}
