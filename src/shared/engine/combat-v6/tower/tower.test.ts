import { describe, expect, it } from 'vitest';
import {
  allowedTowerFormations,
  type TowerKeyFormation,
} from '../../../lib/tower/formations';
import { getTowerSeasonMeta } from '../../../lib/tower/season';
import {
  createTowerWeek,
  TOWER_COMBINATIONS,
  towerEnemyPreview,
  type TowerWeek,
} from '../../../lib/tower/weekly';
import { planTowerReward } from '../../../rewards/tower';
import type { CultivatorCondition } from '../../../types/condition';
import { BEAST_SPECIES, generateStarterBeast } from '../beasts';
import {
  COMBAT_V6_SECT_DEFINITIONS_V4,
  type CombatV6SectId,
  type SectCombatProgressV6,
} from '../content';
import { compileTowerEncounter } from './content';
import { createTowerHost, projectTowerPlayer, TowerHost } from './host';
import { publishTowerWeek } from './published';
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
    manuals: {
      version: 1 as const,
      revision: 0,
      learned: [],
      build: { slots: [] },
    },
  };
}

const week = createTowerWeek(getTowerSeasonMeta(new Date('2026-09-19')));
function durablePlayer() {
  const p = player('youdu');
  p.cultivator.attributes.vitality = 10000;
  return p;
}
function defendRound(host: TowerHost) {
  host.submitGroup(
    host
      .controlledCommandOptions()
      .filter((o) => o.canSubmit)
      .map((o) => ({ unitId: o.unitId, command: { type: 'defend' as const } })),
  );
  host.resolveRound();
}
describe('满状态幻境与可恢复机制', () => {
  it('每场人物与携带灵兽满状态，兽威只提升灵兽双攻，不修改输入', () => {
    const input = player('youdu');
    const owner = '00000000-0000-4000-8000-000000000001';
    input.cultivator.id = owner;
    const beast = generateStarterBeast(
      '00000000-0000-4000-8000-000000000002',
      owner,
      BEAST_SPECIES[0].id,
      42,
    );
    const p = {
      ...input,
      beasts: {
        beasts: [beast],
        lineup: {
          carriedBeastIds: [beast.id],
          leadBeastId: beast.id,
          revision: 0,
        },
      },
    };
    const before = structuredClone(p);
    const plain = createTowerHost(p, '金丹', 1, {}, week, 42);
    const buffed = createTowerHost(p, '金丹', 1, { beast_power: 2 }, week, 42);
    const pet = buffed.state.units.find((u) => u.kind === 'pet')!;
    const basePet = plain.state.units.find((u) => u.kind === 'pet')!;
    expect(pet.attrs.physicalAtk).toBe(
      Math.floor(basePet.attrs.physicalAtk * 1.16),
    );
    expect(pet.attrs.magicAtk).toBe(Math.floor(basePet.attrs.magicAtk * 1.16));
    for (const u of buffed.state.units.filter((u) => u.side === 0)) {
      expect(u.attrs.hp).toBe(u.attrs.maxHp);
      expect(u.attrs.mp).toBe(u.attrs.maxMp);
    }
    expect(p).toEqual(before);
  });
  it('刷新恢复保留战中消耗，下一场重新满状态', () => {
    const p = durablePlayer();
    const host = createTowerHost(p, '金丹', 1, {}, week, 42);
    defendRound(host);
    const snapshot = host.runtimeSnapshot();
    const restored = new TowerHost(snapshot, snapshot);
    expect(restored.runtimeSnapshot()).toEqual(snapshot);
    expect(restored.state.units[0].attrs.hp).toBeLessThan(
      restored.state.units[0].attrs.maxHp,
    );
    const next = createTowerHost(p, '金丹', 2, {}, week, 42);
    expect(next.state.units[0].attrs.hp).toBe(next.state.units[0].attrs.maxHp);
  });
  for (const combo of TOWER_COMBINATIONS) {
    it(`${combo.id} 精英与首领保存恢复保持技能周期和 RNG`, () => {
      for (const floor of [5, 10]) {
        const custom = {
          ...week,
          floors: week.floors.map((r) =>
            r.floor === floor
              ? { ...r, combinationId: combo.id, formationId: 'solo' as const }
              : r,
          ),
        };
        const host = createTowerHost(
          durablePlayer(),
          '金丹',
          floor,
          {},
          custom,
          42,
        );
        for (let round = 0; round < 6; round++) {
          const snap = host.runtimeSnapshot();
          const restored = new TowerHost(snap, snap);
          defendRound(host);
          defendRound(restored);
          expect(restored.runtimeSnapshot()).toEqual(host.runtimeSnapshot());
        }
        expect(host.trace().rounds).toHaveLength(6);
        const commands = host
          .trace()
          .rounds.map(
            (r) =>
              r.commands.find((c) => c.unitId === 'tower.enemy.0')!.command,
          );
        expect(commands[0]).toEqual(commands[3]);
        expect(commands[1]).toEqual(commands[4]);
        expect(commands[2]).toEqual(commands[5]);
        if (combo.style === 'seal') {
          const seals = host
            .trace()
            .events.filter(
              (e) => e.type === 'statusApplied' && e.statusId === 'tower.bound',
            );
          expect(seals.length).toBeGreaterThan(0);
          expect(seals.length).toBeLessThanOrEqual(2);
          expect(
            host.state.units[0].statuses.some((s) => s.id === 'tower.bound'),
          ).toBe(false);
        }
      }
    });
  }
  it('受控重击不延后到破绽回合', () => {
    const custom = {
      ...week,
      floors: week.floors.map((r) =>
        r.floor === 5
          ? {
              ...r,
              combinationId: 'warrior-armor-charge' as const,
              formationId: 'solo' as const,
            }
          : r,
      ),
    };
    const host = createTowerHost(durablePlayer(), '金丹', 5, {}, custom, 42);
    defendRound(host);
    const snap = host.runtimeSnapshot();
    const enemy = snap.state.units.find((u) => u.id === 'tower.enemy.0')!;
    enemy.statuses.push({
      id: 'tower.bound',
      kind: 'tower.bound',
      remainingRounds: 1,
      sourceId: 'player',
      appliedRound: 1,
      speedMod: 0,
      attrMods: {},
      damageTakenPhysical: 1,
      damageTakenSpell: 1,
      healTaken: 1,
      healDealt: 1,
      stacks: 1,
    });
    const restored = new TowerHost(snap, snap);
    defendRound(restored);
    defendRound(restored);
    const rounds = restored.trace().rounds;
    expect(
      rounds[1].commands.find((c) => c.unitId === enemy.id)?.command,
    ).toMatchObject({ type: 'skill', skillId: 'tower.heavy' });
    expect(
      rounds[2].commands.find((c) => c.unitId === enemy.id)?.command,
    ).toMatchObject({ type: 'attack' });
    expect(restored.trace().events.some((e) => e.type === 'actionFailed')).toBe(
      true,
    );
  });
  it('首领低血阶段在回合边界触发一次，恢复后不重复', () => {
    const host = createTowerHost(durablePlayer(), '金丹', 10, {}, week, 42);
    const snap = host.runtimeSnapshot();
    const enemy = snap.state.units.find((u) => u.side === 1)!;
    enemy.attrs.hp = Math.floor(enemy.attrs.maxHp * 0.39);
    const restored = new TowerHost(snap, snap);
    defendRound(restored);
    const next = restored.runtimeSnapshot();
    const again = new TowerHost(next, next);
    defendRound(again);
    expect(
      again
        .trace()
        .events.filter(
          (e) => e.type === 'statusApplied' && e.statusId === 'tower.fury',
        ),
    ).toHaveLength(1);
    expect(
      again.state.units
        .find((u) => u.side === 1)!
        .statuses.some((s) => s.id === 'tower.fury'),
    ).toBe(true);
  });
  it('祝福不修改正常构筑且数值不复利', () => {
    const input = player('youdu'),
      before = structuredClone(input);
    expect(projectTowerPlayer(input, { physical_power: 3 })).toEqual(
      projectTowerPlayer(input, { physical_power: 3 }),
    );
    expect(input).toEqual(before);
  });
  it('里程碑奖励保持既有规则', () => {
    expect(planTowerReward(1, 42, '金丹')).toBeNull();
    for (const floor of [5, 10, 15, 20]) {
      const reward = planTowerReward(floor, 42, '金丹')!;
      expect(reward).toEqual(planTowerReward(floor, 42, '金丹'));
      expect(reward.reputation).toBe(floor);
      expect(reward.materialCount).toBe(floor / 5);
    }
  });
});

function formationWeek(formationId: TowerKeyFormation, floor = 10): TowerWeek {
  return {
    ...week,
    floors: week.floors.map((r) =>
      r.floor === floor
        ? { ...r, combinationId: 'mage-vital-swift', formationId }
        : r,
    ),
  };
}
describe('多敌阵容', () => {
  it('战前名单和战斗单位一致，整场生命不会随人数叠加，辅助不继承主敌特性', () => {
    for (const floor of [5, 10, 15, 20])
      for (const combo of TOWER_COMBINATIONS) {
        for (const formationId of allowedTowerFormations(
          floor % 10 === 0 ? 'boss' : 'elite',
          combo,
        )) {
          const selected: TowerWeek = {
            ...week,
            floors: week.floors.map((r) =>
              r.floor === floor
                ? { ...r, combinationId: combo.id, formationId }
                : r,
            ),
          };
          const solo = compileTowerEncounter('金丹', floor, {
            ...selected,
            floors: selected.floors.map((r) => ({ ...r, formationId: 'solo' })),
          });
          const encounter = compileTowerEncounter('金丹', floor, selected);
          expect(
            encounter.units.map((u) => ({ id: u.id, name: u.name })),
          ).toEqual(
            towerEnemyPreview(floor, selected).members.map((m) => ({
              id: m.id,
              name: m.name,
            })),
          );
          expect(
            encounter.units.reduce((sum, u) => sum + u.attrs.hp, 0),
          ).toBeLessThanOrEqual(solo.units[0].attrs.hp);
          for (const support of encounter.units.slice(1)) {
            expect(support.passives).not.toContain('tower.last-stand');
            expect(support.attrs.sealResist).toBe(50);
            expect(support.skills).not.toContain('tower.seal');
          }
        }
      }
  });
  it('镜侍保护只绑定主敌，击杀当回合保留，下一回合减弱，刷新不重复叠层', () => {
    const host = createTowerHost(
      durablePlayer(),
      '金丹',
      10,
      {},
      formationWeek('guarded'),
      42,
    );
    const cover = (h: TowerHost) =>
      h.state.units
        .find((u) => u.id === 'tower.enemy.0')!
        .statuses.find((s) => s.id === 'tower.mirror-cover')?.stacks ?? 0;
    expect(cover(host)).toBe(2);
    expect(
      host.state.units
        .filter((u) => u.id !== 'tower.enemy.0')
        .flatMap((u) => u.statuses)
        .some((s) => s.id === 'tower.mirror-cover'),
    ).toBe(false);
    const snapshot = host.runtimeSnapshot();
    const actor = snapshot.state.units.find((u) => u.id === host.playerId)!;
    actor.attrs.physicalAtk = 100000;
    actor.attrs.speed = 100000;
    actor.attrs.hit = 100000;
    const active = new TowerHost(snapshot, snapshot);
    active.submitGroup([
      {
        unitId: active.playerId,
        command: { type: 'attack', target: 'tower.enemy.1' },
      },
    ]);
    let sameRoundCover = 0;
    active.resolveRound((state) => {
      if (
        state.round === 1 &&
        state.units.find((u) => u.id === 'tower.enemy.1')!.attrs.hp === 0
      )
        sameRoundCover = cover(active);
    });
    expect(sameRoundCover).toBe(2);
    expect(cover(active)).toBe(1);
    const saved = active.runtimeSnapshot();
    const restored = new TowerHost(saved, saved);
    expect(cover(restored)).toBe(1);
    for (const h of [active, restored]) {
      h.submitGroup([
        {
          unitId: h.playerId,
          command: { type: 'attack', target: 'tower.enemy.2' },
        },
      ]);
      h.resolveRound();
      expect(cover(h)).toBe(0);
    }
    expect(restored.runtimeSnapshot()).toEqual(active.runtimeSnapshot());
  });
  it('护主实际降低物理和法术伤害 15%/30%，不降低固定伤害', () => {
    for (const type of ['physicalHit', 'spellHit', 'fixedHit'] as const) {
      const amounts: number[] = [];
      for (const stacks of [0, 1, 2]) {
        const host = createTowerHost(
          durablePlayer(),
          '金丹',
          10,
          {},
          formationWeek('guarded'),
          42,
        );
        const snap = host.runtimeSnapshot();
        const skill = {
          id: 'test.strike',
          name: 'test',
          tags: [],
          targeting: { side: 'enemy' as const, count: 1 },
          effects: [{ type, coeff: 1, power: 200, cannotMiss: true }],
        };
        snap.input.skills!.push(skill);
        const actor = snap.state.units.find((u) => u.id === host.playerId)!;
        actor.skills = ['test.strike'];
        actor.passives = [];
        actor.attrs.physicalAtk = 800;
        actor.attrs.magicAtk = 800;
        actor.attrs.critRate = 0;
        actor.attrs.spellCritRate = 0;
        actor.attrs.speed = 10000;
        const leader = snap.state.units.find((u) => u.id === 'tower.enemy.0')!;
        const cover = leader.statuses.find(
          (s) => s.id === 'tower.mirror-cover',
        )!;
        if (stacks) cover.stacks = stacks;
        else
          leader.statuses = leader.statuses.filter(
            (s) => s.id !== 'tower.mirror-cover',
          );
        const active = new TowerHost(snap, snap);
        active.submitGroup([
          {
            unitId: active.playerId,
            command: {
              type: 'skill',
              skillId: 'test.strike',
              targets: [leader.id],
            },
          },
        ]);
        active.resolveRound();
        const damage = active
          .trace()
          .events.find(
            (e) =>
              e.type === 'damage' &&
              e.sourceId === active.playerId &&
              e.targetId === leader.id,
          );
        expect(damage?.type).toBe('damage');
        amounts.push(damage && 'amount' in damage ? damage.amount : 0);
      }
      expect(amounts[0]).toBeGreaterThan(0);
      expect(
        Math.abs(amounts[1] - amounts[0] * (type === 'fixedHit' ? 1 : 0.85)),
      ).toBeLessThanOrEqual(2);
      expect(
        Math.abs(amounts[2] - amounts[0] * (type === 'fixedHit' ? 1 : 0.7)),
      ).toBeLessThanOrEqual(2);
    }
  });
  it('治疗优先最低气血比例者，最多三次，耗尽后继续弱攻击', () => {
    const host = createTowerHost(
      durablePlayer(),
      '金丹',
      5,
      {},
      formationWeek('healer', 5),
      42,
    );
    const snap = host.runtimeSnapshot();
    const leader = snap.state.units.find((u) => u.id === 'tower.enemy.0')!;
    leader.attrs.hp = Math.floor(leader.attrs.maxHp * 0.1);
    const active = new TowerHost(snap, snap);
    for (let i = 0; i < 12; i++) defendRound(active);
    const heals = active
      .trace()
      .events.filter(
        (e) => e.type === 'heal' && e.sourceId === 'tower.enemy.1',
      );
    expect(heals).toHaveLength(3);
    expect(
      heals.every((e) => 'targetId' in e && e.targetId === leader.id),
    ).toBe(true);
    expect(
      active.state.units.find((u) => u.id === 'tower.enemy.1')!.attrs.mp,
    ).toBe(0);
    expect(
      active
        .trace()
        .rounds[11].commands.find((c) => c.unitId === 'tower.enemy.1')!.command,
    ).toMatchObject({ type: 'skill', skillId: 'tower.support-strike' });
  });
});

it('Host编译策略后冻结战斗，恢复不重新读取周策略', () => {
  const pack = publishTowerWeek(getTowerSeasonMeta(new Date('2026-09-19')));
  pack.floors[0].enemies[0].traits = [{ id: 'vital' }];
  const host = createTowerHost(
    durablePlayer(),
    '金丹',
    1,
    {},
    undefined,
    42,
    pack,
  );
  expect(host.state.units.find((u) => u.id === 'tower.enemy.0')!.attrs.hp).toBe(
    1250,
  );
  pack.floors[0].enemies[0].traits = [];
  expect(host.state.units.find((u) => u.id === 'tower.enemy.0')!.attrs.hp).toBe(
    1250,
  );
  const restored = new TowerHost(
    host.runtimeSnapshot(),
    host.runtimeSnapshot(),
  );
  expect(restored.state.units).toEqual(host.state.units);
});

it('策略护卫保护指定辅助；死亡下一回合移除，恢复不重复叠层', () => {
  const pack = publishTowerWeek(getTowerSeasonMeta(new Date('2026-09-19')));
  const f = pack.floors[8];
  f.enemies = [
    {
      id: 'main',
      role: 'leader',
      archetype: 'warrior',
      behaviorId: 'basic',
      traits: [],
      budgetShare: { hp: 0.7, output: 0.8 },
    },
    {
      id: 'healer',
      role: 'support',
      archetype: 'attendant',
      behaviorId: 'healing',
      traits: [],
      budgetShare: { hp: 0.15, output: 0.1 },
    },
    {
      id: 'guard',
      role: 'support',
      archetype: 'attendant',
      behaviorId: 'support',
      traits: [],
      budgetShare: { hp: 0.15, output: 0.1 },
    },
  ];
  f.enemies[1].traits = [{ id: 'limited_healing' }];
  f.enemies[2].traits = [{ id: 'guard', targetEnemyId: f.enemies[1].id }];
  const host = createTowerHost(
    durablePlayer(),
    '金丹',
    9,
    {},
    undefined,
    42,
    pack,
  );
  const cover = (h: TowerHost, id: string) =>
    h.state.units
      .find((u) => u.id === id)!
      .statuses.find((s) => s.id === 'tower.mirror-cover')?.stacks ?? 0;
  expect(cover(host, 'tower.enemy.0')).toBe(0);
  expect(cover(host, 'tower.enemy.1')).toBe(1);
  const snapshot = host.runtimeSnapshot();
  const actor = snapshot.state.units.find((u) => u.id === host.playerId)!;
  actor.attrs.physicalAtk = actor.attrs.speed = actor.attrs.hit = 100000;
  const active = new TowerHost(snapshot, snapshot);
  active.submitGroup([
    {
      unitId: active.playerId,
      command: { type: 'attack', target: 'tower.enemy.2' },
    },
  ]);
  let sameRound = 0;
  active.resolveRound((state) => {
    if (
      state.round === 1 &&
      state.units.find((u) => u.id === 'tower.enemy.2')!.attrs.hp === 0
    )
      sameRound = cover(active, 'tower.enemy.1');
  });
  expect(sameRound).toBe(1);
  expect(cover(active, 'tower.enemy.1')).toBe(0);
  const saved = active.runtimeSnapshot();
  const restored = new TowerHost(saved, saved);
  expect(cover(restored, 'tower.enemy.1')).toBe(0);
  for (const h of [active, restored]) defendRound(h);
  expect(restored.runtimeSnapshot()).toEqual(active.runtimeSnapshot());
});
