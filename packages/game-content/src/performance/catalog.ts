import type { CombatV6SectId } from '@daoyou/game-domain/combat';
import {
  parsePerformanceScript,
  type PerformanceScript,
} from '@daoyou/game-domain/performance';
import { BREAKTHROUGH_PERFORMANCES } from './breakthrough.js';
import arrivalCreek from './data/arrival-creek.json' with { type: 'json' };
import arrivalEmber from './data/arrival-ember.json' with { type: 'json' };
import arrivalFall from './data/arrival-fall.json' with { type: 'json' };
import arrivalGate from './data/arrival-gate.json' with { type: 'json' };
import arrivalHandy from './data/arrival-handy.json' with { type: 'json' };
import arrivalPouch from './data/arrival-pouch.json' with { type: 'json' };
import arrivalRemain from './data/arrival-remain.json' with { type: 'json' };
import arrivalTracks from './data/arrival-tracks.json' with { type: 'json' };
import mountainBasket from './data/mountain-basket.json' with { type: 'json' };
import mountainCompanion from './data/mountain-companion.json' with { type: 'json' };
import mountainFare from './data/mountain-fare.json' with { type: 'json' };
import mountainFerry from './data/mountain-ferry.json' with { type: 'json' };
import mountainHalfPainting from './data/mountain-half-painting.json' with { type: 'json' };
import mountainLamplight from './data/mountain-lamplight.json' with { type: 'json' };
import mountainLearn from './data/mountain-learn.json' with { type: 'json' };
import mountainOldRoad from './data/mountain-old-road.json' with { type: 'json' };
import mountainRain from './data/mountain-rain.json' with { type: 'json' };
import mountainSpring from './data/mountain-spring.json' with { type: 'json' };
import mountainSummit from './data/mountain-summit.json' with { type: 'json' };
import mountainThreePaintings from './data/mountain-three-paintings.json' with { type: 'json' };
import mountainTwoPeaks from './data/mountain-two-peaks.json' with { type: 'json' };
import mountainWhitePaw from './data/mountain-white-paw.json' with { type: 'json' };
import { mineLessonScripts, morningLessons } from './mine-lessons.js';
import { createMineRoadChoice, MINE_ROAD_SCRIPT } from './mine-road.js';
import { mineSparringScripts } from './mine-sparring.js';
import { createTavernConversation } from './tavern.js';
export {
  createMineRoadChoice,
  MINE_ROAD_SCRIPT,
  mineRoadFlag,
} from './mine-road.js';
export { createMountainGateArrival } from './mountain-gate-arrivals.js';
export { createSectFirstPath } from './sect-first-path.js';
export { createTavernConversation };

import mineBaishui from './data/mine-baishui.json' with { type: 'json' };
import mineBaishuiNight from './data/mine-baishui-night.json' with { type: 'json' };
import mineCrossing from './data/mine-crossing.json' with { type: 'json' };
import mineDeparture from './data/mine-departure.json' with { type: 'json' };
import mineErrand from './data/mine-errand.json' with { type: 'json' };
import mineGateSchools from './data/mine-gate-schools.json' with { type: 'json' };
import mineGate from './data/mine-gate.json' with { type: 'json' };
import mineShift from './data/mine-shift.json' with { type: 'json' };
import mountainAddress from './data/mountain-address.json' with { type: 'json' };
import mountainBamboo from './data/mountain-bamboo.json' with { type: 'json' };
import mountainChopsticks from './data/mountain-chopsticks.json' with { type: 'json' };
import mountainForge from './data/mountain-forge.json' with { type: 'json' };
import mountainHighWater from './data/mountain-high-water.json' with { type: 'json' };
import mountainLetterHome from './data/mountain-letter-home.json' with { type: 'json' };
import mountainRegister from './data/mountain-register.json' with { type: 'json' };
import mountainSparring from './data/mountain-sparring.json' with { type: 'json' };

const scripts = new Map<string, PerformanceScript>([
  ['arrival-fall', parsePerformanceScript(arrivalFall)],
  ['arrival-creek', parsePerformanceScript(arrivalCreek)],
  ['arrival-gate', parsePerformanceScript(arrivalGate)],
  ['arrival-ember', parsePerformanceScript(arrivalEmber)],
  ['arrival-handy', parsePerformanceScript(arrivalHandy)],
  ['arrival-pouch', parsePerformanceScript(arrivalPouch)],
  ['arrival-tracks', parsePerformanceScript(arrivalTracks)],
  ['arrival-remain', parsePerformanceScript(arrivalRemain)],
  ['mountain-two-peaks', parsePerformanceScript(mountainTwoPeaks)],
  ['mountain-old-road', parsePerformanceScript(mountainOldRoad)],
  ['mountain-rain', parsePerformanceScript(mountainRain)],
  ['mountain-half-painting', parsePerformanceScript(mountainHalfPainting)],
  ['mountain-three-paintings', parsePerformanceScript(mountainThreePaintings)],
  ['mountain-learn', parsePerformanceScript(mountainLearn)],
  ['mountain-fare', parsePerformanceScript(mountainFare)],
  ['mountain-ferry', parsePerformanceScript(mountainFerry)],
  ['mountain-summit', parsePerformanceScript(mountainSummit)],
  ['mountain-basket', parsePerformanceScript(mountainBasket)],
  ['mountain-white-paw', parsePerformanceScript(mountainWhitePaw)],
  ['mountain-companion', parsePerformanceScript(mountainCompanion)],
  ['mountain-spring', parsePerformanceScript(mountainSpring)],
  ['mountain-lamplight', parsePerformanceScript(mountainLamplight)],
  ['mountain-bamboo', parsePerformanceScript(mountainBamboo)],
  ['mountain-letter-home', parsePerformanceScript(mountainLetterHome)],
  ['mountain-high-water', parsePerformanceScript(mountainHighWater)],
  ['mountain-tavern', createTavernConversation()],
  ['mountain-register', parsePerformanceScript(mountainRegister)],
  ['mountain-address', parsePerformanceScript(mountainAddress)],
  ['mountain-chopsticks', parsePerformanceScript(mountainChopsticks)],
  ...mountainForge.map((entry): [string, PerformanceScript] => [
    entry.id,
    parsePerformanceScript(entry),
  ]),
  ...mountainSparring.map((entry): [string, PerformanceScript] => [
    entry.id,
    parsePerformanceScript(entry),
  ]),
  [MINE_ROAD_SCRIPT, createMineRoadChoice()],
  ...[
    ...mineShift,
    ...mineCrossing,
    ...mineDeparture,
    ...mineErrand,
    ...mineBaishui,
    ...mineBaishuiNight,
    ...mineGate,
    ...mineGateSchools,
  ].map((entry): [string, PerformanceScript] => [
    entry.id,
    parsePerformanceScript(entry),
  ]),
  ...[...mineLessonScripts(), ...mineSparringScripts()].map(
    (script): [string, PerformanceScript] => [script.id, script],
  ),
  ...Object.values(BREAKTHROUGH_PERFORMANCES).map(
    (script): [string, PerformanceScript] => [script.id, script],
  ),
]);

const sectScripts = new Map(
  (Object.keys(morningLessons) as CombatV6SectId[]).map((sectId) => [
    sectId as string,
    new Map(
      [...mineLessonScripts(sectId), ...mineSparringScripts(sectId)].map(
        (script) => [script.id, script],
      ),
    ),
  ]),
);

export function listPerformanceScripts(): PerformanceScript[] {
  return [...scripts.values()].filter(
    (script) => !script.id.startsWith('arrival-'),
  );
}

export function getPerformanceScript(
  id: string,
  sectId?: string | null,
): PerformanceScript {
  const script =
    (sectId ? sectScripts.get(sectId)?.get(id) : undefined) ?? scripts.get(id);
  if (!script) throw new Error(`演出不存在：${id}`);
  return script;
}

export function getMineGateStudy(sectId: string): PerformanceScript {
  return (
    scripts.get('mine-gate-study-' + sectId) ??
    getPerformanceScript('mine-gate-study')
  );
}
