import type { TowerWeek } from '../../../lib/tower/weekly.js';
import type { RealmType } from '../../../types/constants.js';
import { TOWER_STRATEGY_VERSION } from './strategy.js';
import { compileTowerStrategy } from './strategy-compiler.js';
import { expandTowerFloor } from './strategy-templates.js';
export { TOWER_SKILLS, TOWER_STATUS_DEFS, type TowerNpcPlan } from './catalog.js';
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
