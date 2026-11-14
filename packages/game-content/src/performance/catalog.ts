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
import v1Ambush from './data/v1-ambush.json' with { type: 'json' };
import v1Blocked from './data/v1-blocked.json' with { type: 'json' };
import v1Bones from './data/v1-bones.json' with { type: 'json' };
import v1Call from './data/v1-call.json' with { type: 'json' };
import v1Cubs from './data/v1-cubs.json' with { type: 'json' };
import v1Downhill from './data/v1-downhill.json' with { type: 'json' };
import v1Drill from './data/v1-drill.json' with { type: 'json' };
import v1Errand from './data/v1-errand.json' with { type: 'json' };
import v1Fatter from './data/v1-fatter.json' with { type: 'json' };
import v1Fever from './data/v1-fever.json' with { type: 'json' };
import v1Forge from './data/v1-forge.json' with { type: 'json' };
import v1Forged from './data/v1-forged.json' with { type: 'json' };
import v1Guard from './data/v1-guard.json' with { type: 'json' };
import v1LastNight from './data/v1-last-night.json' with { type: 'json' };
import v1Night from './data/v1-night.json' with { type: 'json' };
import v1Notice from './data/v1-notice.json' with { type: 'json' };
import v1Pals from './data/v1-pals.json' with { type: 'json' };
import v1Posted from './data/v1-posted.json' with { type: 'json' };
import v1Question from './data/v1-question.json' with { type: 'json' };
import v1Queue from './data/v1-queue.json' with { type: 'json' };
import v1Ration from './data/v1-ration.json' with { type: 'json' };
import v1Report from './data/v1-report.json' with { type: 'json' };
import v1Risen from './data/v1-risen.json' with { type: 'json' };
import v1Sleepless from './data/v1-sleepless.json' with { type: 'json' };
import v1Soot from './data/v1-soot.json' with { type: 'json' };
import v1Soup from './data/v1-soup.json' with { type: 'json' };
import v1Spar from './data/v1-spar.json' with { type: 'json' };
import v1Token from './data/v1-token.json' with { type: 'json' };
import v1Wake from './data/v1-wake.json' with { type: 'json' };
import v1Word from './data/v1-word.json' with { type: 'json' };

const scripts = new Map<string, PerformanceScript>([
  ['arrival-fall', parsePerformanceScript(arrivalFall)],
  ['arrival-creek', parsePerformanceScript(arrivalCreek)],
  ['arrival-gate', parsePerformanceScript(arrivalGate)],
  ['arrival-ember', parsePerformanceScript(arrivalEmber)],
  ['arrival-handy', parsePerformanceScript(arrivalHandy)],
  ['arrival-pouch', parsePerformanceScript(arrivalPouch)],
  ['arrival-tracks', parsePerformanceScript(arrivalTracks)],
  ['arrival-remain', parsePerformanceScript(arrivalRemain)],
  ['v1-ambush', parsePerformanceScript(v1Ambush)],
  ['v1-blocked', parsePerformanceScript(v1Blocked)],
  ['v1-bones', parsePerformanceScript(v1Bones)],
  ['v1-call', parsePerformanceScript(v1Call)],
  ['v1-cubs', parsePerformanceScript(v1Cubs)],
  ['v1-downhill', parsePerformanceScript(v1Downhill)],
  ['v1-drill', parsePerformanceScript(v1Drill)],
  ['v1-errand', parsePerformanceScript(v1Errand)],
  ['v1-fatter', parsePerformanceScript(v1Fatter)],
  ['v1-fever', parsePerformanceScript(v1Fever)],
  ['v1-forge', parsePerformanceScript(v1Forge)],
  ['v1-forged', parsePerformanceScript(v1Forged)],
  ['v1-guard', parsePerformanceScript(v1Guard)],
  ['v1-last-night', parsePerformanceScript(v1LastNight)],
  ['v1-night', parsePerformanceScript(v1Night)],
  ['v1-notice', parsePerformanceScript(v1Notice)],
  ['v1-pals', parsePerformanceScript(v1Pals)],
  ['v1-posted', parsePerformanceScript(v1Posted)],
  ['v1-question', parsePerformanceScript(v1Question)],
  ['v1-queue', parsePerformanceScript(v1Queue)],
  ['v1-ration', parsePerformanceScript(v1Ration)],
  ['v1-report', parsePerformanceScript(v1Report)],
  ['v1-risen', parsePerformanceScript(v1Risen)],
  ['v1-sleepless', parsePerformanceScript(v1Sleepless)],
  ['v1-soot', parsePerformanceScript(v1Soot)],
  ['v1-soup', parsePerformanceScript(v1Soup)],
  ['v1-spar', parsePerformanceScript(v1Spar)],
  ['v1-token', parsePerformanceScript(v1Token)],
  ['v1-wake', parsePerformanceScript(v1Wake)],
  ['v1-word', parsePerformanceScript(v1Word)],
  ...Object.values(BREAKTHROUGH_PERFORMANCES).map(
    (script): [string, PerformanceScript] => [script.id, script],
  ),
]);

export function listPerformanceScripts(): PerformanceScript[] {
  return [...scripts.values()];
}

export function getPerformanceScript(id: string): PerformanceScript {
  const script = scripts.get(id);
  if (!script) throw new Error(`演出不存在：${id}`);
  return script;
}
