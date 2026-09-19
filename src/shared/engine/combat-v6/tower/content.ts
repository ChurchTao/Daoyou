import type { TowerWeek } from '../../../lib/tower/weekly';
import type { RealmType } from '../../../types/constants';
import { TOWER_STRATEGY_VERSION } from './strategy';
import { compileTowerStrategy } from './strategy-compiler';
import { expandTowerFloor } from './strategy-templates';
export { TOWER_SKILLS, TOWER_STATUS_DEFS, type TowerNpcPlan } from './catalog';
export function compileTowerEncounter(
  realm: RealmType,
  floor: number,
  week: TowerWeek,
) {
  return compileTowerStrategy(
    realm,
    expandTowerFloor(week, floor),
    TOWER_STRATEGY_VERSION,
  );
}
