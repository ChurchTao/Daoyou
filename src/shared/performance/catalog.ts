import arrivalCreek from '../content/performances/arrival-creek.json';
import arrivalPouch from '../content/performances/arrival-pouch.json';
import arrivalPrints from '../content/performances/arrival-prints.json';
import arrivalSatchel from '../content/performances/arrival-satchel.json';
import arrivalSpring from '../content/performances/arrival-spring.json';
import arrivalSteady from '../content/performances/arrival-steady.json';
import arrivalTracks from '../content/performances/arrival-tracks.json';
import arrivalEmber from '../content/performances/arrival-ember.json';
import arrivalFall from '../content/performances/arrival-fall.json';
import arrivalGate from '../content/performances/arrival-gate.json';
import arrivalGrip from '../content/performances/arrival-grip.json';
import arrivalRemain from '../content/performances/arrival-remain.json';
import arrivalHandy from '../content/performances/arrival-handy.json';
import arrivalGrass from '../content/performances/arrival-grass.json';
import arrivalLodge from '../content/performances/arrival-lodge.json';
import arrivalMouth from '../content/performances/arrival-mouth.json';
import arrivalScent from '../content/performances/arrival-scent.json';
import { parsePerformanceScript, type PerformanceScript } from './schema';

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
