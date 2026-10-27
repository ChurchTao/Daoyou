import { describe, expect, it } from 'vitest';
import { automaticCommands } from '../combat/auto.js';
import { buildTowerBlessingChoices } from './helpers.js';
import { getTowerSeasonMeta } from './season.js';
import { DaoyouRule } from '@daoyou/game-content/combat/tuning';
import {
  loadTowerCatalog,
  TOWER_CATALOG,
  TOWER_GENERATION_DATA as generation,
  loadTowerGeneration,
} from '@daoyou/game-content/tower';
import { TOWER_ENEMIES_DATA as raw } from '@daoyou/game-content/authoring/tower';
import { type TowerBlessings } from '@daoyou/game-domain/tower';
import { createTowerHost } from './host.js';
import {
  publishedTowerEncounter,
  publishedTowerPreviews,
  publishTowerWeek,
  validatePublishedTowerWeek,
} from './published.js';
import { towerReferenceBuild } from './reference-fixtures.js';
import { towerStrategySignature } from './strategy.js';

const season = getTowerSeasonMeta(new Date('2026-09-19'));
describe('配置驱动与玩法节点', () => {
  it('祝福只有九个节点，末段不再弹出低价值的第十次选择', () => {
    const nodes = Array.from({ length: 21 }, (_, clearedFloor) =>
      buildTowerBlessingChoices({
        runId: 'fixed',
        clearedFloor,
        blessings: {},
        hasBeasts: false,
      }).length
        ? clearedFloor
        : -1,
    ).filter((n) => n >= 0);
    expect(nodes).toEqual([0, 2, 4, 6, 8, 10, 12, 14, 16]);
    expect(
      buildTowerBlessingChoices({
        runId: 'fixed',
        clearedFloor: 16,
        blessings: { might: 3, spell: 3, edge: 2 },
        hasBeasts: false,
      }).map((c) => c.id),
    ).toContain('edge');
  });
  it('错误内容引用在加载时拒绝，不悄悄回落到默认方案', () => {
    const content = structuredClone(raw);
    content.behaviors.charge.cycle[1] = 'missing';
    expect(() => loadTowerCatalog(content)).toThrow('引用无效');
    const recipe = structuredClone(generation);
    recipe.combinations[0].lateBehavior = 'missing';
    expect(() => loadTowerGeneration(recipe)).toThrow('行动方案不存在');
    const missingFloor = structuredClone(generation);
    Reflect.deleteProperty(missingFloor.normalFloors, '1');
    expect(() => loadTowerGeneration(missingFloor)).toThrow('缺失');
    const duplicateFloor = structuredClone(generation);
    Object.assign(duplicateFloor.normalFloors, {
      '4': duplicateFloor.normalFloors['1'],
    });
    expect(() => loadTowerGeneration(duplicateFloor)).toThrow('重复');
  });
  it('当前内容拒绝旧周结构，进阶行为属于策略事实并参与避重', () => {
    const pack = publishTowerWeek(season);
    expect(() =>
      validatePublishedTowerWeek({ ...pack, schemaVersion: 2 }),
    ).toThrow();
    const floor = structuredClone(pack.floors[14]);
    const before = towerStrategySignature(floor);
    const formation = towerStrategySignature(floor, true);
    floor.enemies[0].behaviorId = generation.combinations.find(
      (c) => c.lateBehavior === floor.enemies[0].behaviorId,
    )!.behavior;
    expect(towerStrategySignature(floor)).not.toBe(before);
    expect(towerStrategySignature(floor, true)).toBe(formation);
  });
  it('普通层预习下一关键层的阵容，不提前带上碎梦', () => {
    const pack = publishTowerWeek(season);
    const previews = publishedTowerPreviews(pack);
    for (const floor of [1, 4, 6, 9, 11, 14, 16, 19]) {
      const key = [5, 10, 15, 20].find((value) => value >= floor)!;
      const strategy = pack.floors[floor - 1];
      const source = pack.floors[key - 1];
      const combo = generation.combinations.find(
        (row) =>
          row.behavior === source.enemies[0].behaviorId ||
          row.lateBehavior === source.enemies[0].behaviorId,
      )!;
      expect(strategy.kind).toBe('normal');
      expect(strategy.enemies.map((enemy) => enemy.role)).toEqual(
        source.enemies.map((enemy) => enemy.role),
      );
      expect(strategy.enemies[0].behaviorId).toBe(combo.behavior);
      expect(
        strategy.enemies.some((enemy) =>
          enemy.traits.some((trait) => trait.id === 'last_stand'),
        ),
      ).toBe(false);
      const result = publishedTowerEncounter(pack, '金丹', floor);
      for (const [index, enemy] of strategy.enemies.entries()) {
        expect(result.plans[`tower.enemy.${index}`].cycle).toEqual(
          TOWER_CATALOG.behaviors[enemy.behaviorId].cycle,
        );
        expect(previews[floor - 1].members[index].details[0]).toContain(
          `每 ${result.plans[`tower.enemy.${index}`].cycle.length} 回合`,
        );
      }
    }
  });
});

// Fixed seeds chosen before tuning. Each floor starts from a real projected build.
const seeds = [7, 19, 42, 73, 101, 211, 307, 401, 503, 601];
describe('金丹二十层多种子检查', () => {
  for (const sect of ['lingxiao', 'jiujie', 'youdu'] as const) {
    for (const hasPet of [true, false]) {
      it(`${sect} ${hasPet ? '有宠' : '无宠'}：真实投影、九次选择、各层可终结且无开局稳定秒杀`, () => {
        const player = towerReferenceBuild(sect);
        if (!hasPet) player.beasts = undefined;
        const pack = publishTowerWeek(season);
        const stats: Array<{
          floor: number;
          wins: number;
          rounds: number[];
          firstRoundDeaths: number;
        }> = [];
        for (let floor = 1; floor <= 20; floor++) {
          const blessings: TowerBlessings = {};
          const offense = sect === 'lingxiao' ? 'might' : 'spell';
          for (let cleared = 0; cleared < floor; cleared++) {
            const choices = buildTowerBlessingChoices({
              runId: `matrix-${sect}-${hasPet}`,
              clearedFloor: cleared,
              blessings,
              hasBeasts: hasPet,
            });
            const priorities = hasPet
              ? [offense, 'edge', 'beast', 'shell', 'iron', 'crit']
              : [offense, 'edge', 'shell', 'iron', 'crit', 'vigor'];
            const choice = [...choices]
              .sort(
                (a, b) => priorities.indexOf(a.id) - priorities.indexOf(b.id),
              )
              .find((c) => priorities.includes(c.id));
            if (choice) blessings[choice.id] = choice.nextStacks;
          }
          const row = {
            floor,
            wins: 0,
            rounds: [] as number[],
            firstRoundDeaths: 0,
          };
          for (const seed of seeds) {
            const host = createTowerHost(
              player,
              '金丹',
              floor,
              blessings,
              undefined,
              seed,
              pack,
            );
            for (
              let turn = 0;
              turn < DaoyouRule.maxRounds && !host.finished;
              turn++
            ) {
              host.submitGroup(
                automaticCommands(
                  host.state,
                  host.playerId,
                  host.runtimeSnapshot().input.skills ?? [],
                  (id) => host.queryCommands(id),
                  { statusDefs: host.runtimeSnapshot().input.statusDefs },
                ),
              );
              host.resolveRound();
              if (
                turn === 0 &&
                host.state.units.find((u) => u.id === host.playerId)!.attrs
                  .hp === 0
              )
                row.firstRoundDeaths++;
            }
            expect(host.finished, `${floor}/${seed}`).toBe(true);
            if (host.trace().outcome === 'victory') row.wins++;
            row.rounds.push(host.trace().rounds.length);
          }
          expect(row.firstRoundDeaths).toBeLessThan(seeds.length);
          if (floor === 1) expect(row.wins).toBeGreaterThan(0);
          stats.push(row);
        }
        console.info(
          'tower-phase2-matrix',
          sect,
          hasPet,
          JSON.stringify(stats),
        );
      }, 20000);
    }
  }
});
