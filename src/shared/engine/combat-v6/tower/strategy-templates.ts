import { TOWER_FORMATIONS } from '../../../lib/tower/formations';
import { resolveTowerFloorKind } from '../../../lib/tower/helpers';
import {
  towerCombination,
  towerFormation,
  type TowerWeek,
} from '../../../lib/tower/weekly';
import {
  validateTowerFloorStrategy,
  type TowerEnemyStrategy,
  type TowerFloorStrategy,
} from './strategy';

/** Authoring adapter only. Neither the strategy validator nor compiler uses templates. */
export function expandTowerFloor(
  week: TowerWeek,
  floor: number,
): TowerFloorStrategy {
  const kind = resolveTowerFloorKind(floor);
  const row = week.floors.find((r) => r.floor === floor);
  const combo =
    kind === 'normal'
      ? undefined
      : row
        ? towerCombination(row.combinationId)
        : undefined;
  if (kind !== 'normal' && !combo) throw new Error('幻境关键层缺少组合');
  const formation = TOWER_FORMATIONS[towerFormation(floor, week)];
  const style =
    combo?.style ??
    ([3, 7].includes(((floor - 1) % 10) + 1) ? 'spell' : 'physical');
  const result: TowerFloorStrategy = {
    floor,
    kind,
    budget: { hpScale: formation.hpScale },
    enemies: formation.roles.map((role, slot) => {
      const support = role === 'healer' || role === 'guard';
      const traits: TowerEnemyStrategy['traits'] = [];
      // v4 vitality affected the whole HP pool. Preserve it explicitly on companions.
      if (combo?.survival === 'vital') traits.push({ id: 'vital' });
      if (!support && combo) {
        if (combo.survival === 'armor') traits.push({ id: 'armor' });
        if (combo.survival === 'ward') traits.push({ id: 'magic_ward' });
        traits.push({
          id: combo.tempo === 'calm' ? 'seal_resist' : combo.tempo,
        });
      }
      if (role === 'healer') traits.push({ id: 'limited_healing' });
      if (role === 'guard')
        traits.push({ id: 'guard', targetEnemyId: 'enemy.0' });
      if (kind === 'boss' && role === 'leader')
        traits.push({ id: 'last_stand' });
      return {
        id: `enemy.${slot}`,
        archetype: support
          ? 'attendant'
          : style === 'spell'
            ? 'mage'
            : style === 'seal'
              ? 'binder'
              : 'warrior',
        role: support ? 'support' : role,
        traits,
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

export function expandTowerWeek(week: TowerWeek): TowerFloorStrategy[] {
  return Array.from({ length: 20 }, (_, i) => expandTowerFloor(week, i + 1));
}
