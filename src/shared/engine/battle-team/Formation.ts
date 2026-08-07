import type { TeamSide } from './types';
import type { TeamUnit } from './TeamUnit';
import type { Team } from './Team';

/**
 * 阵型：管理前排/后排分组和受击权重。
 *
 * 2v2 默认每队 1 前排 + 1 后排。
 * 前排受击概率 0.7，后排 0.3；前排无人时退化为后排。
 */
export class Formation {
  private frontBySide: Map<TeamSide, TeamUnit[]> = new Map();
  private backBySide: Map<TeamSide, TeamUnit[]> = new Map();

  constructor(units: TeamUnit[]) {
    for (const unit of units) {
      const side = unit.side;
      if (unit.position === 'front') {
        const list = this.frontBySide.get(side) ?? [];
        list.push(unit);
        this.frontBySide.set(side, list);
      } else {
        const list = this.backBySide.get(side) ?? [];
        list.push(unit);
        this.backBySide.set(side, list);
      }
    }
  }

  frontAliveOf(side: TeamSide, team: Team): TeamUnit[] {
    const front = this.frontBySide.get(side) ?? [];
    return front.filter((u) => u.isAlive() && team.getUnit(u.id));
  }

  backAliveOf(side: TeamSide, team: Team): TeamUnit[] {
    const back = this.backBySide.get(side) ?? [];
    return back.filter((u) => u.isAlive() && team.getUnit(u.id));
  }

  /**
   * 随机选目标（前:后 = 0.7:0.3 权重）。
   * 前排无人时选后排。
   */
  randomAliveTarget(enemySide: TeamSide, enemyTeam: Team, rng: () => number): TeamUnit | undefined {
    const front = this.frontAliveOf(enemySide, enemyTeam);
    const back = this.backAliveOf(enemySide, enemyTeam);
    const allAlive = [...front, ...back];

    if (allAlive.length === 0) return undefined;
    if (front.length === 0) return back[Math.floor(rng() * back.length)];
    if (back.length === 0) return front[Math.floor(rng() * front.length)];

    // 有前排也有后排 → 0.7 概率选前排
    const pool = rng() < 0.7 ? front : back;
    return pool[Math.floor(rng() * pool.length)];
  }
}
