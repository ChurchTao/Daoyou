import { describe, expect, it } from 'vitest';
import { automaticCommands } from '../combat/auto.js';
import { buildTowerBlessingChoices } from './helpers.js';
import { getTowerSeasonMeta } from './season.js';
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

it.each([
  { sect: 'jiujie', hasPet: false, floor: 1, maxRounds: 20 },
  { sect: 'youdu', hasPet: true, floor: 10, maxRounds: 30 },
  { sect: 'lingxiao', hasPet: true, floor: 20, maxRounds: 30 },
] as const)(
  '$sect 金丹构筑在发布周表第 $floor 层可获胜',
  ({ sect, hasPet, floor, maxRounds }) => {
    const player = towerReferenceBuild(sect);
    if (!hasPet) player.beasts = undefined;
    const blessings: TowerBlessings = {};
    const offense = sect === 'lingxiao' ? 'might' : 'spell';
    const priorities = hasPet
      ? [offense, 'edge', 'beast', 'shell', 'iron', 'crit']
      : [offense, 'edge', 'shell', 'iron', 'crit', 'vigor'];
    for (let clearedFloor = 0; clearedFloor < floor; clearedFloor++) {
      const choices = buildTowerBlessingChoices({
        runId: `matrix-${sect}-${hasPet}`,
        clearedFloor,
        blessings,
        hasBeasts: hasPet,
      });
      const choice = choices
        .filter((item) => priorities.includes(item.id))
        .sort((a, b) => priorities.indexOf(a.id) - priorities.indexOf(b.id))[0];
      if (choice) blessings[choice.id] = choice.nextStacks;
    }

    const host = createTowerHost(
      player,
      '金丹',
      floor,
      blessings,
      undefined,
      42,
      publishTowerWeek(season),
    );
    for (let turn = 0; turn < maxRounds && !host.finished; turn++) {
      const { input } = host.runtimeSnapshot();
      host.submitGroup(
        automaticCommands(
          host.state,
          host.playerId,
          input.skills ?? [],
          (id) => host.queryCommands(id),
          { statusDefs: input.statusDefs },
        ),
      );
      host.resolveRound();
      if (turn === 0) {
        const playerUnit = host.state.units.find(
          (unit) => unit.id === host.playerId,
        );
        expect(playerUnit?.attrs.hp).toBeGreaterThan(0);
      }
    }

    expect(host.finished).toBe(true);
    expect(host.trace().outcome).toBe('victory');
  },
);
