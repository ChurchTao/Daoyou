import { expect, it } from 'vitest';
import { applyUnitDelta } from '../../../combat-v6/playback';
import { combatV6Units } from '../../../combat-v6/presentation';
import { BEAST_SPECIES, generateStarterBeast } from '../beasts';
import { COMBAT_V6_SECT_DEFINITIONS_V4 } from '../content';
import type { CombatV6TrainingPlayerInput } from '../encounter';
import { compileRankingBattle, simulateRankingBattle } from './battle';

function player(id: string): CombatV6TrainingPlayerInput {
  const def = COMBAT_V6_SECT_DEFINITIONS_V4.youdu;
  return {
    cultivator: {
      id,
      name: id,
      realm: '金丹',
      realm_stage: '初期',
      attributes: {
        vitality: 50,
        strength: 50,
        spirit: 50,
        endurance: 50,
        speed: 50,
        willpower: 50,
      },
    },
    sect: {
      version: 1,
      sectId: 'youdu',
      methods: Object.fromEntries(def.methods.map((m) => [m.id, 1])),
      activePathId: def.paths[0].id,
      meridianDepth: 0,
      meridianLoadouts: def.paths.map((p) => ({
        pathId: p.id,
        nodeIds: [],
        revision: 0,
      })) as CombatV6TrainingPlayerInput['sect']['meridianLoadouts'],
    },
    equipment: {},
    manuals: { version: 1, revision: 0, learned: [], build: { slots: [] } },
  };
}
it('首发合法性、满资源及输入隔离', () => {
  const a = player('00000000-0000-4000-8000-000000000001');
  const b = player('00000000-0000-4000-8000-000000000002');
  const lead = generateStarterBeast(
    '00000000-0000-4000-8000-000000000003',
    a.cultivator.id,
    BEAST_SPECIES[0].id,
    1,
  );
  const reserve = generateStarterBeast(
    '00000000-0000-4000-8000-000000000004',
    a.cultivator.id,
    BEAST_SPECIES[0].id,
    2,
  );
  a.beasts = {
    beasts: [lead, reserve],
    lineup: {
      carriedBeastIds: [lead.id, reserve.id],
      leadBeastId: lead.id,
      revision: 0,
    },
  };
  const before = structuredClone([a, b]);
  const compiled = compileRankingBattle([a, b], 42);
  expect(compiled.units.map((u) => u.id)).toContain('beast:' + lead.id);
  expect(compiled.units.map((u) => u.id)).not.toContain('beast:' + reserve.id);
  expect(
    compiled.units.every(
      (u) => u.attrs!.hp === u.attrs!.maxHp && u.attrs!.mp === u.attrs!.maxMp,
    ),
  ).toBe(true);
  simulateRankingBattle(compiled);
  expect([a, b]).toEqual(before);
  lead.currentLifespan = 0;
  expect(compileRankingBattle([a, b], 42).units).toHaveLength(2);
  lead.currentLifespan = 1000;
  lead.unallocatedPoints += (180 - lead.level) * 5;
  lead.level = 180;
  expect(compileRankingBattle([a, b], 42).units).toHaveLength(2);
});
it('相同冻结输入与种子恢复结果一致，差量可重建终局', () => {
  const input = compileRankingBattle([player('a'), player('b')], 24);
  const trace = simulateRankingBattle(input);
  expect(simulateRankingBattle(structuredClone(input))).toEqual(trace);
  const units = trace.timeline.frames.reduce(
    (units, frame) => applyUnitDelta(units, frame),
    trace.timeline.initialUnits,
  );
  expect(units).toEqual(combatV6Units(trace.finalState, trace.statusDefs));
});
it('回合上限按平局结束', () => {
  const input = compileRankingBattle([player('a'), player('b')], 5);
  for (const u of input.units) {
    u.attrs = { ...u.attrs, hp: 100000000, maxHp: 100000000, physicalAtk: 1 };
  }
  const trace = simulateRankingBattle(input);
  expect(trace.finalState.result?.winner).toBe('draw');
  expect(trace.finalState.round).toBe(100);
});
