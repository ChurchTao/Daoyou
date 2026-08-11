import type { BattleRoster } from '../core/BattleRoster';
import type { BattleRandomSource } from '../core/BattleRandom';
import type { TeamId } from '../core/types';

export type TeamVictoryResult =
  | {
      battleEnded: false;
      winnerTeamId?: never;
      loserTeamId?: never;
      reachedMaxRounds?: never;
    }
  | {
      battleEnded: true;
      winnerTeamId: TeamId;
      loserTeamId: TeamId;
      reachedMaxRounds?: boolean;
    };

export type TerminalTeamVictoryResult = Extract<
  TeamVictoryResult,
  { battleEnded: true }
>;

export class TeamVictorySystem {
  static readonly MAX_ROUNDS = 30;

  static check(
    roster: BattleRoster,
    random: BattleRandomSource,
    currentRound?: number,
  ): TeamVictoryResult {
    const teams = [...roster.teams.values()];
    if (teams.length !== 2) {
      throw new Error('Battle victory resolution requires exactly two teams');
    }
    const alive = teams.filter((team) => !roster.isTeamEliminated(team.id));

    if (alive.length === 1) {
      const loser = teams.find((team) => team.id !== alive[0].id);
      if (!loser) throw new Error('Battle loser team is missing');
      return {
        battleEnded: true,
        winnerTeamId: alive[0].id,
        loserTeamId: loser.id,
      };
    }
    if (
      alive.length > 1 &&
      (currentRound === undefined || currentRound < this.MAX_ROUNDS)
    ) {
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
      const currentMp = members.reduce(
        (sum, member) => sum + member.getCurrentMp(),
        0,
      );
      const maxMp = members.reduce(
        (sum, member) => sum + member.getMaxMp(),
        0,
      );
      return {
        teamId: team.id,
        livingUnits: members.filter((member) => member.isAlive()).length,
        hpRatio: maxHp > 0 ? currentHp / maxHp : 0,
        shield: members.reduce(
          (sum, member) => sum + member.getCurrentShield(),
          0,
        ),
        mpRatio: maxMp > 0 ? currentMp / maxMp : 0,
      };
    });
    const ranked = [...scores].sort(compareTeamScores);
    const leaders = ranked.filter(
      (candidate) => compareTeamScores(candidate, ranked[0]) === 0,
    );
    const first = leaders.length === 1
      ? leaders[0]
      : leaders[Math.floor(random.next() * leaders.length)];
    const second = ranked.find((candidate) => candidate.teamId !== first.teamId);
    if (!second) throw new Error('Battle requires at least two teams');
    return {
      battleEnded: true,
      winnerTeamId: first.teamId,
      loserTeamId: second.teamId,
      ...(currentRound !== undefined && currentRound >= this.MAX_ROUNDS
        ? { reachedMaxRounds: true }
        : {}),
    };
  }
}

interface TeamDecisionScore {
  teamId: TeamId;
  livingUnits: number;
  hpRatio: number;
  shield: number;
  mpRatio: number;
}

function compareTeamScores(
  left: TeamDecisionScore,
  right: TeamDecisionScore,
): number {
  return (
    compareNumber(right.hpRatio, left.hpRatio) ||
    right.livingUnits - left.livingUnits ||
    right.shield - left.shield ||
    compareNumber(right.mpRatio, left.mpRatio)
  );
}

function compareNumber(left: number, right: number): number {
  return Math.abs(left - right) < Number.EPSILON ? 0 : left - right;
}
