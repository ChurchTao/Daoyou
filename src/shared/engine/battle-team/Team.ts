import type { TeamSide } from './types';
import type { TeamUnit } from './TeamUnit';

/**
 * 队伍：一方阵营的多个战斗单位。
 */
export class Team {
  readonly side: TeamSide;
  private _units: TeamUnit[];

  constructor(side: TeamSide, units: TeamUnit[]) {
    this.side = side;
    this._units = units;
  }

  aliveUnits(): TeamUnit[] {
    return this._units.filter((u) => u.isAlive());
  }

  isAnnihilated(): boolean {
    return this.aliveUnits().length === 0;
  }

  getUnit(id: string): TeamUnit | undefined {
    return this._units.find((u) => u.id === id);
  }

  allUnits(): TeamUnit[] {
    return this._units;
  }
}
