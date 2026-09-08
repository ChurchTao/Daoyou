import { describe, expect, it } from 'vitest';
import { towerReward } from '../../../rewards/tower';
import type { CultivatorCondition } from '../../../types/condition';
import { BEAST_SPECIES, generateStarterBeast } from '../beasts';
import {
  COMBAT_V6_SECT_DEFINITIONS_V4,
  type CombatV6SectId,
  type SectCombatProgressV6,
} from '../content';
import {
  createTowerHost,
  projectTowerPlayer,
  TowerHost,
  towerRecovery,
  towerResourceRatio,
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
      realm: '金丹' as const,
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
    manuals: { version: 1 as const, revision: 0, build: { slots: [] } },
  };
}

describe('幻境独立资源与可恢复战斗', () => {
  it('死亡灵兽不再入场，备用灵兽保留零 MP，个体寿命与经验不变', () => {
    const input = player('youdu');
    const owner = '00000000-0000-4000-8000-000000000001';
    input.cultivator.id = owner;
    const dead = generateStarterBeast(
      '00000000-0000-4000-8000-000000000002',
      owner,
      BEAST_SPECIES[0].id,
      42,
    );
    const reserve = generateStarterBeast(
      '00000000-0000-4000-8000-000000000003',
      owner,
      BEAST_SPECIES[0].id,
      43,
    );
    const roster = {
      beasts: [dead, reserve],
      lineup: {
        carriedBeastIds: [dead.id, reserve.id],
        leadBeastId: dead.id,
        revision: 0,
      },
    };
    const before = structuredClone(roster);
    const host = createTowerHost(
      { ...input, beasts: roster },
      '金丹',
      2,
      {},
      {
        [`beast:${dead.id}`]: { hp: 0, mp: 10 },
        [`beast:${reserve.id}`]: { hp: 20, mp: 0 },
      },
      42,
    );
    expect(host.state.units.some((u) => u.id === `beast:${dead.id}`)).toBe(
      false,
    );
    expect(
      host.state.units.find((u) => u.id === `beast:${reserve.id}`)?.attrs,
    ).toMatchObject({ hp: 20, mp: 0 });
    expect(roster).toEqual(before);
  });
  it('满状态入场且不修改现实资源和构筑', () => {
    const input = player('youdu'),
      before = structuredClone(input);
    const host = createTowerHost(input, '金丹', 1, {}, {}, 42);
    const own = host.state.units.find((u) => u.id === host.playerId)!;
    expect(own.attrs.hp).toBe(own.attrs.maxHp);
    expect(own.attrs.mp).toBe(own.attrs.maxMp);
    expect(input).toEqual(before);
  });
  it('零 MP 跨场保持，战前恢复不会在 Host 恢复时重复', () => {
    const host = createTowerHost(
      player('youdu'),
      '金丹',
      1,
      { breathing_technique: 1 },
      { player: { hp: 100, mp: 0 } },
      42,
    );
    const snapshot = host.runtimeSnapshot();
    const restored = new TowerHost(snapshot, snapshot);
    expect(restored.runtimeSnapshot()).toEqual(snapshot);
    expect(restored.state.units.find((u) => u.id === 'player')!.attrs.mp).toBe(
      0,
    );
  });
  for (const floor of [1, 5, 10, 15, 20])
    it(`第 ${floor} 层保存恢复保持 RNG 和结算一致`, () => {
      const host = createTowerHost(player('youdu'), '金丹', floor, {}, {}, 42);
      host.submit(host.playerId, { type: 'defend' });
      const snap = host.runtimeSnapshot(),
        restored = new TowerHost(snap, snap);
      host.resolveRound();
      restored.resolveRound();
      expect(restored.runtimeSnapshot()).toEqual(host.runtimeSnapshot());
    });
  it('祝福投影不会累乘或改变原始构筑', () => {
    const input = player('youdu'),
      before = structuredClone(input);
    const blessings = { vitality_surge: 5, balanced_dao: 3, jade_bones: 5 };
    expect(projectTowerPlayer(input, blessings)).toEqual(
      projectTowerPlayer(input, blessings),
    );
    expect(
      projectTowerPlayer(input, blessings).unit.attrs!.maxHp,
    ).toBeGreaterThan(projectTowerPlayer(input, {}).unit.attrs!.maxHp!);
    expect(input).toEqual(before);
  });
  it('比例变换、恢复裁剪和零值', () => {
    expect(towerResourceRatio(50, 100, 120)).toBe(60);
    expect(towerResourceRatio(0, 100, 120)).toBe(0);
    expect(towerRecovery(20, 100, 0.3)).toBe(44);
    expect(towerRecovery(120, 100, 0.3)).toBe(100);
  });
  it('非里程碑无收益，里程碑固定种子确定且声望不变', () => {
    expect(towerReward(1, 42, '金丹')).toBeNull();
    for (const floor of [5, 10, 15, 20]) {
      const reward = towerReward(floor, 42, '金丹')!;
      expect(reward).toEqual(towerReward(floor, 42, '金丹'));
      expect(reward.reputation).toBe(floor);
      expect(reward.items.reduce((sum, item) => sum + item.quantity, 0)).toBe(
        floor / 5,
      );
    }
  });
});
