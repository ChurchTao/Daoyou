import arrivalCreek from './data/arrival-creek.json' with { type: 'json' };
import arrivalPouch from './data/arrival-pouch.json' with { type: 'json' };
import arrivalTracks from './data/arrival-tracks.json' with { type: 'json' };
import arrivalEmber from './data/arrival-ember.json' with { type: 'json' };
import arrivalFall from './data/arrival-fall.json' with { type: 'json' };
import arrivalGate from './data/arrival-gate.json' with { type: 'json' };
import arrivalRemain from './data/arrival-remain.json' with { type: 'json' };
import arrivalHandy from './data/arrival-handy.json' with { type: 'json' };
import {
  parsePerformanceScript,
  type PerformanceScript,
} from '@daoyou/game-domain/performance';

const scripts = new Map<string, PerformanceScript>([
  ['arrival-fall', parsePerformanceScript(arrivalFall)],
  ['arrival-creek', parsePerformanceScript(arrivalCreek)],
  ['arrival-gate', parsePerformanceScript(arrivalGate)],
  ['arrival-ember', parsePerformanceScript(arrivalEmber)],
  ['arrival-handy', parsePerformanceScript(arrivalHandy)],
  ['arrival-pouch', parsePerformanceScript(arrivalPouch)],
  ['arrival-tracks', parsePerformanceScript(arrivalTracks)],
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
