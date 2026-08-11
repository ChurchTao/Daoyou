import type { TeamId, TeamSlot, UnitId } from './types';
import type { Unit } from '../units/Unit';

export interface BattleTeam {
  readonly id: TeamId;
  readonly unitIds: readonly UnitId[];
}

export class BattleRoster {
  static readonly MAX_TEAM_SIZE = 4;

  readonly units: ReadonlyMap<UnitId, Unit>;
  readonly teams: ReadonlyMap<TeamId, BattleTeam>;

  constructor(units: readonly Unit[]) {
    if (units.length < 2 || units.length > BattleRoster.MAX_TEAM_SIZE * 2) {
      throw new Error('Battle roster must contain between 2 and 8 units');
    }

    const unitMap = new Map<UnitId, Unit>();
    const teamUnits = new Map<TeamId, Unit[]>();
    for (const unit of units) {
      if (unitMap.has(unit.id)) {
        throw new Error(`Duplicate battle unit id: ${unit.id}`);
      }
      unitMap.set(unit.id, unit);
      const members = teamUnits.get(unit.teamId) ?? [];
      members.push(unit);
      teamUnits.set(unit.teamId, members);
    }

    if (teamUnits.size !== 2) {
      throw new Error('Battle roster requires exactly two teams');
    }

    const teams = new Map<TeamId, BattleTeam>();
    for (const [teamId, members] of teamUnits) {
      if (members.length > BattleRoster.MAX_TEAM_SIZE) {
        throw new Error(`Team ${teamId} exceeds the 4-unit limit`);
      }
      const slots = new Set<TeamSlot>();
      for (const member of members) {
        if (slots.has(member.slot)) {
          throw new Error(`Duplicate slot ${member.slot} in team ${teamId}`);
        }
        slots.add(member.slot);
      }
      teams.set(
        teamId,
        Object.freeze({
          id: teamId,
          unitIds: Object.freeze(
            [...members]
              .sort((left, right) => left.slot - right.slot)
              .map((member) => member.id),
          ),
        }),
      );
    }

    this.units = unitMap;
    this.teams = teams;
  }

  static fromDuel(player: Unit, opponent: Unit): BattleRoster {
    return new BattleRoster([player, opponent]);
  }

  getUnit(unitId: UnitId): Unit {
    const unit = this.units.get(unitId);
    if (!unit) throw new Error(`Unknown battle unit: ${unitId}`);
    return unit;
  }

  getAllUnits(): Unit[] {
    return [...this.units.values()];
  }

  getTeam(teamId: TeamId): BattleTeam {
    const team = this.teams.get(teamId);
    if (!team) throw new Error(`Unknown battle team: ${teamId}`);
    return team;
  }

  getTeamOf(unitId: UnitId): BattleTeam {
    return this.getTeam(this.getUnit(unitId).teamId);
  }

  getAllies(unitId: UnitId, includeSelf = false): Unit[] {
    const unit = this.getUnit(unitId);
    return this.getTeam(unit.teamId).unitIds
      .filter((candidateId) => includeSelf || candidateId !== unitId)
      .map((candidateId) => this.getUnit(candidateId));
  }

  getEnemies(unitId: UnitId): Unit[] {
    const teamId = this.getUnit(unitId).teamId;
    return [...this.teams.values()]
      .filter((team) => team.id !== teamId)
      .flatMap((team) => team.unitIds.map((candidateId) => this.getUnit(candidateId)));
  }

  getLivingUnits(teamId?: TeamId): Unit[] {
    const candidates = teamId
      ? this.getTeam(teamId).unitIds.map((unitId) => this.getUnit(unitId))
      : this.getAllUnits();
    return candidates.filter((unit) => unit.isAlive());
  }

  isTeamEliminated(teamId: TeamId): boolean {
    return this.getLivingUnits(teamId).length === 0;
  }
}
