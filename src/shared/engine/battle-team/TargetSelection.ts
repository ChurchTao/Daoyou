import { AttributeType } from '@shared/engine/battle-v5/core/types';
import type { TeamTargetPolicy, TeamUnitRef } from './types';
import type { TeamUnit } from './TeamUnit';
import type { Team } from './Team';
import type { Formation } from './Formation';

/**
 * 多人目标选择。
 *
 * 策略组合：team（enemy/ally/self）× scope（single/aoe/random）× filter（front_first/back_first/...）
 */
export class TargetSelection {
  constructor(
    private _formation: Formation,
    private _teamA: Team,
    private _teamB: Team,
    private _rng: () => number,
  ) {}

  selectTargets(source: TeamUnitRef, policy: TeamTargetPolicy): TeamUnit[] {
    // 1. team 过滤
    let candidates: TeamUnit[];
    if (policy.team === 'self') {
      const self = this.findUnit(source);
      return self ? [self] : [];
    }

    const targetTeam = policy.team === 'enemy' ? this.enemyTeamOf(source.side) : this.allyTeamOf(source.side);
    candidates = targetTeam.aliveUnits();

    // 不选自己（ally scope 下排除 source）
    if (policy.team === 'ally') {
      candidates = candidates.filter((u) => u.id !== source.id);
    }

    if (candidates.length === 0) return [];

    // 2. filter 应用（single/random 时）
    if (policy.filter) {
      candidates = this.applyFilter(candidates, policy.filter, targetTeam.side, targetTeam);
    }

    if (candidates.length === 0) return [];

    // 3. scope 选择
    switch (policy.scope) {
      case 'single':
        return [candidates[0]];
      case 'random':
        return [this._formation.randomAliveTarget(targetTeam.side, targetTeam, this._rng) ?? candidates[0]];
      case 'aoe':
        return candidates.slice(0, policy.maxTargets ?? candidates.length);
      default:
        return [candidates[0]];
    }
  }

  private applyFilter(
    candidates: TeamUnit[],
    filter: string,
    enemySide: TeamUnitRef['side'],
    enemyTeam: Team,
  ): TeamUnit[] {
    switch (filter) {
      case 'front_first': {
        const front = this._formation.frontAliveOf(enemySide, enemyTeam);
        return front.length > 0 ? front : this._formation.backAliveOf(enemySide, enemyTeam);
      }
      case 'back_first': {
        const back = this._formation.backAliveOf(enemySide, enemyTeam);
        return back.length > 0 ? back : this._formation.frontAliveOf(enemySide, enemyTeam);
      }
      case 'lowest_hp':
        return [...candidates].sort((a, b) => a.getHpPercent() - b.getHpPercent());
      case 'highest_hp':
        return [...candidates].sort((a, b) => b.getHpPercent() - a.getHpPercent());
      case 'fastest':
        return [...candidates].sort(
          (a, b) =>
            b.attributes.getValue(AttributeType.ACTION_SPEED) -
            a.attributes.getValue(AttributeType.ACTION_SPEED),
        );
      default:
        return candidates;
    }
  }

  enemyTeamOf(side: TeamUnitRef['side']): Team {
    return side === 'A' ? this._teamB : this._teamA;
  }

  allyTeamOf(side: TeamUnitRef['side']): Team {
    return side === 'A' ? this._teamA : this._teamB;
  }

  private findUnit(ref: TeamUnitRef): TeamUnit | undefined {
    return this._teamA.getUnit(ref.id) ?? this._teamB.getUnit(ref.id);
  }
}
