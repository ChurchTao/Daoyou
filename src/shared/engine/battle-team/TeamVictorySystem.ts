import type { TeamSide } from './types';
import type { Team } from './Team';

export interface VictoryCheckResult {
  battleEnded: boolean;
  winningTeam: TeamSide | null;
  reachedMaxTurns: boolean;
}

/**
 * 队伍胜负判定。
 *
 * - 一方全灭 → 另一方胜
 * - 双方同归于尽 → 平局
 * - 回合上限 → 存活单位总血量百分比高的一方胜
 */
export class TeamVictorySystem {
  static check(teamA: Team, teamB: Team, round: number, maxTurns: number): VictoryCheckResult {
    const aAlive = !teamA.isAnnihilated();
    const bAlive = !teamB.isAnnihilated();

    if (!aAlive && !bAlive) {
      return { battleEnded: true, winningTeam: null, reachedMaxTurns: false };
    }
    if (!aAlive) {
      return { battleEnded: true, winningTeam: 'B', reachedMaxTurns: false };
    }
    if (!bAlive) {
      return { battleEnded: true, winningTeam: 'A', reachedMaxTurns: false };
    }
    if (round >= maxTurns) {
      const aHp = teamAliveHpPercent(teamA);
      const bHp = teamAliveHpPercent(teamB);
      return {
        battleEnded: true,
        winningTeam: aHp >= bHp ? 'A' : 'B',
        reachedMaxTurns: true,
      };
    }
    return { battleEnded: false, winningTeam: null, reachedMaxTurns: false };
  }
}

function teamAliveHpPercent(team: Team): number {
  const alive = team.aliveUnits();
  if (alive.length === 0) return 0;
  const totalPercent = alive.reduce((sum, u) => sum + u.getHpPercent(), 0);
  return totalPercent / alive.length;
}
