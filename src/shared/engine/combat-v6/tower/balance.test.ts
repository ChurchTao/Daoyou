import { describe, expect, it } from 'vitest';
import { automaticCommands } from '../../../combat-v6/auto';
import { allowedTowerFormations } from '../../../lib/tower/formations';
import { getTowerSeasonMeta } from '../../../lib/tower/season';
import { createTowerWeek, TOWER_COMBINATIONS } from '../../../lib/tower/weekly';
import { createTowerHost } from './host';
import { towerReferenceBuild as reference } from './reference-fixtures';
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
