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
  ...Object.values(BREAKTHROUGH_PERFORMANCES).map(
    (script): [string, PerformanceScript] => [script.id, script],
  ),
]);

export function listPerformanceScripts(): PerformanceScript[] {
  return [...scripts.values()].filter(
    (script) => !script.id.startsWith('arrival-'),
  );
}

export function getPerformanceScript(id: string): PerformanceScript {
  const script = scripts.get(id);
  if (!script) throw new Error(`演出不存在：${id}`);
  return script;
}
