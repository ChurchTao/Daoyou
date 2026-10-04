import arrivalCreek from './data/arrival-creek.json' with { type: 'json' };
import arrivalPouch from './data/arrival-pouch.json' with { type: 'json' };
import arrivalPrints from './data/arrival-prints.json' with { type: 'json' };
import arrivalSatchel from './data/arrival-satchel.json' with { type: 'json' };
import arrivalSpring from './data/arrival-spring.json' with { type: 'json' };
import arrivalSteady from './data/arrival-steady.json' with { type: 'json' };
import arrivalTracks from './data/arrival-tracks.json' with { type: 'json' };
import arrivalEmber from './data/arrival-ember.json' with { type: 'json' };
import arrivalFall from './data/arrival-fall.json' with { type: 'json' };
import arrivalGate from './data/arrival-gate.json' with { type: 'json' };
import arrivalGrip from './data/arrival-grip.json' with { type: 'json' };
import arrivalRemain from './data/arrival-remain.json' with { type: 'json' };
import arrivalHandy from './data/arrival-handy.json' with { type: 'json' };
import arrivalGrass from './data/arrival-grass.json' with { type: 'json' };
import arrivalLodge from './data/arrival-lodge.json' with { type: 'json' };
import arrivalMouth from './data/arrival-mouth.json' with { type: 'json' };
import arrivalScent from './data/arrival-scent.json' with { type: 'json' };
import {
  parsePerformanceScript,
  type PerformanceScript,
} from '@daoyou/game-domain/performance';

const scripts = new Map<string, PerformanceScript>([
  ['arrival-fall', parsePerformanceScript(arrivalFall)],
  ['arrival-ember', parsePerformanceScript(arrivalEmber)],
  ['arrival-scent', parsePerformanceScript(arrivalScent)],
  ['arrival-mouth', parsePerformanceScript(arrivalMouth)],
  ['arrival-lodge', parsePerformanceScript(arrivalLodge)],
  ['arrival-creek', parsePerformanceScript(arrivalCreek)],
  ['arrival-grass', parsePerformanceScript(arrivalGrass)],
  ['arrival-tracks', parsePerformanceScript(arrivalTracks)],
  ['arrival-prints', parsePerformanceScript(arrivalPrints)],
  ['arrival-pouch', parsePerformanceScript(arrivalPouch)],
  ['arrival-satchel', parsePerformanceScript(arrivalSatchel)],
  ['arrival-spring', parsePerformanceScript(arrivalSpring)],
  ['arrival-steady', parsePerformanceScript(arrivalSteady)],
  ['arrival-handy', parsePerformanceScript(arrivalHandy)],
  ['arrival-grip', parsePerformanceScript(arrivalGrip)],
  ['arrival-gate', parsePerformanceScript(arrivalGate)],
  ['arrival-remain', parsePerformanceScript(arrivalRemain)],
]);

export function listPerformanceScripts(): PerformanceScript[] {
  return [...scripts.values()];
}

export function getPerformanceScript(id: string): PerformanceScript {
  const script = scripts.get(id);
  if (!script) throw new Error(`演出不存在：${id}`);
  return script;
}
