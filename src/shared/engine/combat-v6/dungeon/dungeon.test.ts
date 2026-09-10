import { applyUnitDelta } from '@shared/combat-v6/playback';
import {
  combatV6Playback,
  combatV6Units,
} from '@shared/combat-v6/presentation';
import { appendDungeonReward, dungeonReward } from '@shared/rewards/dungeon';
import type { CultivatorCondition } from '@shared/types/condition';
import { describe, expect, it } from 'vitest';
import {
  COMBAT_V6_SECT_DEFINITIONS_V4,
  type CombatV6SectId,
  type SectCombatProgressV6,
} from '../content';
import {
  DUNGEON_TEMPLATES,
  DungeonHost,
  carryDungeonBeastResources,
  createDungeonHost,
} from './host';
function player(sectId: CombatV6SectId) {
  const def = COMBAT_V6_SECT_DEFINITIONS_V4[sectId];
  const track = { level: 0, progress: 0 };
  const condition: CultivatorCondition = {
    version: 1,
    resources: { hp: { current: 100 }, mp: { current: 40 } },
    gauges: { pillToxicity: 0 },
    tracks: {
      tempering: {
        vitality: track,
        spirit: track,
        wisdom: track,
        speed: track,
        willpower: track,
      },
      marrowWash: track,
    },
    counters: {
      longTermPillUsesByRealm: {},
      cultivationPillUsesByRealm: {},
      longevityPillUsesByRealm: {},
    },
    statuses: [],
    timestamps: { lastRecoveryAt: '2026-09-05T00:00:00.000Z' },
  };
  const sect: SectCombatProgressV6 = {
    version: 1,
    sectId,
    methods: Object.fromEntries(def.methods.map((m) => [m.id, 1])),
    activePathId: def.paths[0].id,
    meridianDepth: 0,
    meridianLoadouts: def.paths.map((p) => ({
      pathId: p.id,
      nodeIds: [],
      revision: 0,
    })) as SectCombatProgressV6['meridianLoadouts'],
  };
  return {
    cultivator: {
      id: 'player',
      name: '初入道途',
      realm: '炼气' as const,
      realm_stage: '初期' as const,
      attributes: {
        vitality: 10,
        strength: 10,
        spirit: 10,
        endurance: 10,
        speed: 10,
        willpower: 10,
      },
      condition,
    },
    sect,
    equipment: {},
    manuals: { version: 1 as const, revision: 0, learned: [], build: { slots: [] } },
  };
}

describe('秘境遭遇与收益', () => {
  it('连续遭遇保留灵兽损耗，死亡灵兽不能重新入场，零法力不回满', () => {
    const units = [
      { id: 'player' },
      {
        id: 'pet',
        ownerId: 'player',
        attrs: { hp: 100, maxHp: 100, mp: 40, maxMp: 40 },
      },
      { id: 'dead', ownerId: 'player', attrs: { hp: 100, maxHp: 100 } },
    ];
    const before = structuredClone(units);
    const next = carryDungeonBeastResources(units, 'player', {
      pet: { hp: 37, mp: 0 },
      dead: { hp: 0, mp: 20 },
    });
    expect(next.map((u) => u.id)).toEqual(['player', 'pet']);
    expect(next[1].attrs).toMatchObject({ hp: 37, mp: 0 });
    expect(units).toEqual(before);
  });
  for (const template of Object.keys(DUNGEON_TEMPLATES) as Array<
    keyof typeof DUNGEON_TEMPLATES
  >)
    it(`${template}: 保存恢复不改变结果、RNG 与逐行动差量`, () => {
      const input = player('youdu'),
        before = structuredClone(input);
      const host = createDungeonHost(input, 5, template, 72);
      expect(host.state.units[0].attrs.hp).toBe(100);
      expect(
        host.queryCommands().skills.some((s) => s.skillId.includes('capture')),
      ).toBe(false);
      host.submit(host.playerId, { type: 'defend' });
      const snapshot = host.runtimeSnapshot();
      const restored = new DungeonHost(snapshot, snapshot);
      const presentation = combatV6Playback(
        snapshot.events.length - 1,
        snapshot.input.statusDefs ?? [],
        host.state,
      );
      host.resolveRound(presentation.capture);
      restored.resolveRound();
      expect(restored.runtimeSnapshot()).toEqual(host.runtimeSnapshot());
      expect(input).toEqual(before);
      let units = combatV6Units(
        snapshot.state,
        snapshot.input.statusDefs ?? [],
      );
      for (const frame of presentation.playback.frames)
        units = applyUnitDelta(units, frame);
      expect(units).toEqual(
        combatV6Units(host.state, snapshot.input.statusDefs ?? []),
      );
    });
  it('重复来源只累计一次，不同灵兽经验不合并错归属', () => {
    const reward = {
      ...dungeonReward(5, 'battle:a', 'battle', 10),
      beastExperience: { beastId: 'a', amount: 20 },
    };
    const entries = appendDungeonReward([], reward);
    expect(appendDungeonReward(entries, structuredClone(reward))).toBe(entries);
    const next = appendDungeonReward(entries, {
      ...reward,
      key: 'battle:b',
      beastExperience: { beastId: 'b', amount: 30 },
    });
    expect(next.map((r) => r.beastExperience)).toEqual([
      { beastId: 'a', amount: 20 },
      { beastId: 'b', amount: 30 },
    ]);
  });
  it('奖励流确定且等级非法时拒绝生成', () => {
    expect(dungeonReward(27, 'completion', 'completion', 10)).toEqual(
      dungeonReward(27, 'completion', 'completion', 10),
    );
    expect(
      dungeonReward(27, 'completion', 'completion', 10).items,
    ).toHaveLength(1);
    expect(() => dungeonReward(1, 'x', 'battle', 0)).toThrow();
    expect(() => dungeonReward(1, 'x', 'battle', 181)).toThrow();
  });
});
