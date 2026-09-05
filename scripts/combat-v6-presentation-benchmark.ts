import { gzipSync } from 'node:zlib';
import {
  combatV6Display,
  combatV6Playback,
  combatV6Units,
} from '../src/shared/combat-v6/presentation';
import {
  presentationBattle,
  presentationScenarios,
} from '../src/shared/combat-v6/presentation-fixtures';
import type { BattleState } from '../src/shared/engine/combat-v6/core/types';

const bytes = (value: unknown) => {
  const json = JSON.stringify(value);
  return { json: Buffer.byteLength(json), gzip: gzipSync(json).byteLength };
};
for (const scenario of presentationScenarios) {
  const { battle, input } = presentationBattle(scenario);
  const initial = battle.snapshot();
  const from = battle.log().length - 1;
  const captures: Array<{ state: BattleState; seq: number }> = [];
  battle.lockAndResolve((state, seq) => captures.push({ state, seq }));
  captures.push({ state: battle.snapshot(), seq: battle.log().length - 1 });
  const statuses = input.statusDefs ?? [];
  const full = captures.map(({ state, seq }) => ({
    afterEventSeq: seq,
    round: state.round,
    units: combatV6Units(state, statuses),
  }));
  const collector = combatV6Playback(from, statuses, initial);
  for (const { state, seq } of captures) collector.capture(state, seq);
  const response = {
    apiVersion: 1,
    sessionId: 'benchmark',
    revision: 2,
    expiresAt: '2026-09-06T00:00:00Z',
    encounterId: scenario,
    tier: 60,
    combatVersions: initial.versions,
    round: battle.snapshot().round,
    phase: battle.snapshot().phase,
    units: combatV6Units(battle.snapshot(), statuses),
    commandOptions: battle.queryCommands(initial.units[0].id),
    events: battle
      .log()
      .map((event, seq) => ({ event, seq }))
      .filter((e) => e.seq > from),
    latestEventSeq: battle.log().length - 1,
    display: combatV6Display(input.skills ?? [], statuses),
  };
  const timings: number[] = [];
  for (let i = 0; i < 110; i++) {
    const start = performance.now();
    const sample = combatV6Playback(from, statuses, initial);
    for (const { state, seq } of captures) sample.capture(state, seq);
    if (i >= 10) timings.push(performance.now() - start);
  }
  timings.sort((a, b) => a - b);
  const oldFrames = bytes(full),
    newFrames = bytes(collector.playback.frames);
  if (scenario === '16-attack' && newFrames.json > oldFrames.json * 0.2)
    throw new Error('Delta reduction below 80%');
  console.log(
    JSON.stringify({
      scenario,
      frames: full.length,
      oldFrames,
      newFrames,
      oldResponse: bytes({
        ...response,
        playback: { fromEventSeq: from, frames: full },
      }),
      newResponse: bytes({ ...response, playback: collector.playback }),
      captureMsMedian: Number(timings[50].toFixed(3)),
      captureMsP95: Number(timings[95].toFixed(3)),
    }),
  );
}
