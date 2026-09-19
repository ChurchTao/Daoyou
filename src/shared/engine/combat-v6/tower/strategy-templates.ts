import {
  TOWER_FORMATIONS,
  type TowerFormationId,
} from '../../../lib/tower/formations';
import { resolveTowerFloorKind } from '../../../lib/tower/helpers';
import type { TowerWeek } from '../../../lib/tower/weekly';
import { TOWER_CATALOG } from './catalog';
import { TOWER_GENERATION as generation } from './generation';
import {
  validateTowerFloorStrategy,
  type TowerFloorStrategy,
} from './strategy';

function recipe(
  floor: number,
  formationId: string,
  archetype: string,
  behaviorId: string,
  traits: string[],
  late: boolean,
): TowerFloorStrategy {
  const formation = TOWER_FORMATIONS[formationId as TowerFormationId];
  if (!formation) throw new Error('幻境生成阵容引用无效');
  const kind = resolveTowerFloorKind(floor);
  const result: TowerFloorStrategy = {
    floor,
    kind,
    budget: { hpScale: formation.hpScale },
    enemies: formation.roles.map((role, slot) => {
      const member = generation.roles[role];
      if (!member) throw new Error('幻境生成角色引用无效');
      const ids = member.traits ?? [
        ...traits,
        ...(role === 'leader' ? generation.kindTraits[kind] : []),
      ];
      return {
        id: `enemy.${slot}`,
        role: member.archetype ? 'support' : (role as 'leader' | 'striker'),
        archetype: member.archetype ?? archetype,
        behaviorId:
          (late ? member.lateBehavior : member.behavior) ?? behaviorId,
        traits: ids.map((id) =>
          TOWER_CATALOG.traits[id].relation
            ? { id, targetEnemyId: 'enemy.0' }
            : { id },
        ),
        budgetShare: {
          hp: formation.hpShares[slot],
          output: formation.outputShares[slot],
        },
      };
    }),
  };
  validateTowerFloorStrategy(result);
  return result;
}
/** Generation alone knows floor mappings. The compiler consumes only the resulting strategy. */
export function expandTowerFloor(
  week: TowerWeek,
  floor: number,
): TowerFloorStrategy {
  const normal = generation.normalFloors[String(floor)];
  const leadIn = generation.leadIns[String(floor)];
  if (leadIn) {
    const key = week.floors.find((r) => r.floor === leadIn.source);
    if (!key?.formationId) throw new Error('幻境铺垫缺少关键层');
    const source = expandTowerFloor(week, leadIn.source);
    const leader = source.enemies.find((e) => e.role === 'leader')!;
    const prelude =
      generation.preludes[leadIn.mode === 'leader' ? 'solo' : key.formationId];
    if (!prelude) throw new Error('幻境铺垫引用无效');
    const behavior =
      prelude.behavior === 'source' ? leader.behaviorId : prelude.behavior;
    return recipe(
      floor,
      prelude.formation,
      prelude.archetype ?? leader.archetype,
      behavior,
      generation.behaviorTraits[behavior] ?? [],
      false,
    );
  }
  if (normal)
    return recipe(
      floor,
      normal.formation,
      normal.archetype,
      normal.behavior,
      [],
      false,
    );
  const row = week.floors.find((r) => r.floor === floor);
  const combo = generation.combinations.find(
    (c) => c.id === row?.combinationId,
  );
  if (!row?.formationId || !combo) throw new Error('幻境关键层缺少配置');
  const late = generation.lateFloors.includes(floor);
  return recipe(
    floor,
    row.formationId,
    combo.archetype,
    late ? combo.lateBehavior : combo.behavior,
    combo.traits,
    late,
  );
}
export function expandTowerWeek(week: TowerWeek): TowerFloorStrategy[] {
  return Array.from({ length: 20 }, (_, i) => expandTowerFloor(week, i + 1));
}
