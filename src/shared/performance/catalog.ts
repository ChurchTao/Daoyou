import arrivalCreek from '../content/performances/arrival-creek.json';
import arrivalEmber from '../content/performances/arrival-ember.json';
import arrivalFall from '../content/performances/arrival-fall.json';
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
]);

export function listPerformanceScripts(): PerformanceScript[] {
  return [...scripts.values()];
}

export function getPerformanceScript(id: string): PerformanceScript {
  const script = scripts.get(id);
  if (!script) throw new Error(`演出不存在：${id}`);
  return script;
}
