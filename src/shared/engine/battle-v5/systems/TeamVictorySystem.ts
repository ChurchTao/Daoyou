import type { BattleRoster } from '../core/BattleRoster';
import type { TeamId } from '../core/types';

export interface TeamVictoryResult {
  battleEnded: boolean;
  winnerTeamId?: TeamId;
  loserTeamId?: TeamId;
  draw?: boolean;
  reachedMaxRounds?: boolean;
}

export class TeamVictorySystem {
  static readonly MAX_ROUNDS = 30;

  static check(
    roster: BattleRoster,
    currentRound?: number,
  ): TeamVictoryResult {
    const teams = [...roster.teams.values()];
    const alive = teams.filter((team) => !roster.isTeamEliminated(team.id));

    if (alive.length === 0) {
      return { battleEnded: true, draw: true };
    }
    if (alive.length === 1) {
      return {
        battleEnded: true,
        winnerTeamId: alive[0].id,
        loserTeamId: teams.find((team) => team.id !== alive[0].id)?.id,
      };
    }
    if (currentRound === undefined || currentRound < this.MAX_ROUNDS) {
      return { battleEnded: false };
    }

    const scores = teams.map((team) => {
      const members = team.unitIds.map((unitId) => roster.getUnit(unitId));
      const currentHp = members.reduce(
        (sum, member) => sum + member.getCurrentHp(),
        0,
      );
      const maxHp = members.reduce(
        (sum, member) => sum + member.getMaxHp(),
        0,
      );
      return { teamId: team.id, score: maxHp > 0 ? currentHp / maxHp : 0 };
    });
    const [first, second] = [...scores].sort(
      (left, right) =>
        right.score - left.score || left.teamId.localeCompare(right.teamId),
    );
    if (Math.abs(first.score - second.score) < Number.EPSILON) {
      return { battleEnded: true, draw: true, reachedMaxRounds: true };
    }
    return {
      battleEnded: true,
      winnerTeamId: first.teamId,
      loserTeamId: second.teamId,
      reachedMaxRounds: true,
    };
  }
}
