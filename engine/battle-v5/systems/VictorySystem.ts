import { Unit } from '../units/Unit';

export interface VictoryResult {
  battleEnded: boolean;
  winner?: string;
  loser?: string;
  draw?: boolean;
  reachedMaxTurns?: boolean;
}

/**
 * 胜负判定系统
 */
export class VictorySystem {
  private static readonly MAX_TURNS = 30;

  /**
   * 检查战斗是否结束
   */
  static checkVictory(units: Unit[], currentTurn?: number): VictoryResult {
    const aliveUnits = units.filter((u) => u.isAlive());

    // 所有单位死亡
    if (aliveUnits.length === 0) {
      return {
        battleEnded: true,
        draw: true,
      };
    }

    // 只有一个单位存活
    if (aliveUnits.length === 1) {
      const winner = aliveUnits[0];
      const loser = units.find((u) => u !== winner && !u.isAlive());
      return {
        battleEnded: true,
        winner: winner.id,
        loser: loser?.id,
      };
    }

    // 回合上限判定
    if (currentTurn !== undefined && currentTurn >= this.MAX_TURNS) {
      // 判定血量百分比高的获胜
      const sorted = [...aliveUnits].sort((a, b) => {
        return b.getHpPercent() - a.getHpPercent();
      });
      return {
        battleEnded: true,
        winner: sorted[0].id,
        loser: sorted[1].id,
        reachedMaxTurns: true,
      };
    }

    return {
      battleEnded: false,
    };
  }

  /**
   * 获取最大回合数
   */
  static getMaxTurns(): number {
    return this.MAX_TURNS;
  }
}
