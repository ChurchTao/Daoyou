import { describe, expect, it } from 'vitest';
import { automaticCommands } from '../../../combat-v6/auto';
import { allowedTowerFormations } from '../../../lib/tower/formations';
import { getTowerSeasonMeta } from '../../../lib/tower/season';
import { createTowerWeek, TOWER_COMBINATIONS } from '../../../lib/tower/weekly';
import { generateStarterBeast } from '../beasts';
import { allocateBeast, gainBeastExp } from '../beasts/progression';
import { COMBAT_V6_SECT_DEFINITIONS, type CombatV6SectId } from '../content';
import type { CombatV6TrainingPlayerInput } from '../encounter';
import {
  DAO_EQUIPMENT_GENERATOR_VERSION,
  DAO_EQUIPMENT_TEMPLATES_V1,
  generateDaoEquipmentV1,
} from '../equipment';
import { createTowerHost } from './host';

// Legal middle-Golden-Core builds: 6 × 60 natural points + 250 allocated points,
// level-50 ordinary equipment, no rare arts/essences/manuals/meridian benefits.
function reference(sectId: CombatV6SectId): CombatV6TrainingPlayerInput {
  const def = COMBAT_V6_SECT_DEFINITIONS[sectId];
  const attrs =
    sectId === 'lingxiao'
      ? [100, 210, 60, 90, 90, 60]
      : sectId === 'jiujie'
        ? [100, 60, 210, 60, 90, 90]
        : [120, 60, 110, 60, 160, 100];
  const owner = '00000000-0000-4000-8000-000000000001';
  const beast = gainBeastExp(
    generateStarterBeast(
      '00000000-0000-4000-8000-000000000002',
      owner,
      'combat.wild.species.rock-boar',
      42,
    ),
    100000000,
    50,
  );
  const pet = allocateBeast(
    beast,
    { constitution: 50, strength: 150, magic: 0, endurance: 25, agility: 25 },
    50,
  );
  return {
    cultivator: {
      id: owner,
      name: sectId,
      realm: '金丹',
      realm_stage: '中期',
      attributes: Object.fromEntries(
        [
          'vitality',
          'strength',
          'spirit',
          'endurance',
          'speed',
          'willpower',
        ].map((key, i) => [key, attrs[i]]),
      ) as CombatV6TrainingPlayerInput['cultivator']['attributes'],
    },
    sect: {
      version: 1,
      sectId,
      methods: Object.fromEntries(def.methods.map((m) => [m.id, 50])),
      activePathId: sectId === 'youdu' ? def.paths[1].id : def.paths[0].id,
      meridianDepth: 0,
      meridianLoadouts: def.paths.map((p) => ({
        pathId: p.id,
        nodeIds: [],
        revision: 0,
      })),
    },
    equipment: Object.fromEntries(
      DAO_EQUIPMENT_TEMPLATES_V1.map((template, i) => {
        const result = generateDaoEquipmentV1({
          id: `reference-${i}`,
          templateId: template.id,
          equipmentLevel: 50,
          baseQuality: 0,
          seed: 100 + i,
          createdAt: '2026-09-19T00:00:00Z',
          generatorVersion: DAO_EQUIPMENT_GENERATOR_VERSION,
        });
        if (!result.ok) throw new Error('参考道装生成失败');
        return [template.slot, result.instance];
      }),
    ),
    manuals: { version: 1, revision: 0, learned: [], build: { slots: [] } },
    beasts: {
      beasts: [pet],
      lineup: { carriedBeastIds: [pet.id], leadBeastId: pet.id, revision: 0 },
    },
  };
}
const week = createTowerWeek(getTowerSeasonMeta(new Date('2026-09-19')));
describe('金丹普通构筑的关键层可玩性', () => {
  for (const sectId of ['lingxiao', 'jiujie', 'youdu'] as const) {
    it(`${sectId} 普通装备与灵兽能完成基础层，各组合不会无限拖延`, () => {
      const player = reference(sectId);
      for (const floor of [1, 5, 10]) {
        for (const combo of floor === 1
          ? TOWER_COMBINATIONS.slice(0, 1)
          : TOWER_COMBINATIONS) {
          for (const formationId of floor === 1
            ? ['solo' as const]
            : allowedTowerFormations(floor === 5 ? 'elite' : 'boss', combo)) {
            const selected = {
              ...week,
              floors: week.floors.map((r) =>
                r.floor === floor
                  ? { ...r, combinationId: combo.id, formationId }
                  : r,
              ),
            };
            const offense =
              sectId === 'lingxiao'
                ? { physical_power: 1 }
                : sectId === 'jiujie'
                  ? { spell_power: 1 }
                  : { beast_power: 1 };
            const blessings =
              floor === 1
                ? offense
                : floor === 5
                  ? {
                      ...offense,
                      guard: 1,
                      beast_power: sectId === 'youdu' ? 2 : 1,
                    }
                  : {
                      ...offense,
                      guard: 2,
                      beast_power: sectId === 'youdu' ? 3 : 2,
                    };
            const host = createTowerHost(
              player,
              '金丹',
              floor,
              blessings,
              selected,
              42,
            );
            for (let turn = 0; turn < 30 && !host.finished; turn++) {
              const commands = automaticCommands(
                host.state,
                host.playerId,
                host.runtimeSnapshot().input.skills ?? [],
                (id) => host.queryCommands(id),
                { statusDefs: host.runtimeSnapshot().input.statusDefs },
              );
              host.submitGroup(commands);
              host.resolveRound();
              if (turn === 0)
                expect(
                  host.state.units.find((u) => u.id === host.playerId)!.attrs
                    .hp,
                ).toBeGreaterThan(0);
            }
            expect(host.finished, `${floor}/${combo.id}/${formationId}`).toBe(
              true,
            );
            expect(
              host.trace().outcome,
              `${floor}/${combo.id}/${formationId}`,
            ).toBe('victory');
            if (floor === 1) {
              expect(host.trace().outcome).toBe('victory');
              expect(host.trace().rounds.length).toBeLessThanOrEqual(5);
            }
          }
        }
      }
    });
  }
});
