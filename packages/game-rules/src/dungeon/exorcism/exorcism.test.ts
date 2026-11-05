import {
  EXORCISM_BOSSES,
  EXORCISM_ENCOUNTER_PACK,
  EXORCISM_LINEAGES,
  EXORCISM_REWARD_PACK,
  EXORCISM_SKILLS,
  EXORCISM_STATUS_DEFS,
  exorcismLineageForScene,
} from '@daoyou/game-content/dungeon/exorcism';
import {
  EXORCISM_BOSS_IDS,
  EXORCISM_LINEAGE_IDS,
  type ExorcismBossId,
  type ExorcismResources,
  type ExorcismRunState,
} from '@daoyou/game-domain/dungeon/exorcism';
import { describe, expect, it } from 'vitest';
import { automaticCommands } from '../../combat/auto.js';
import { projectCharacterToCombatV6 } from '../../combat/projection/project-character.js';
import { towerReferenceBuild } from '../../tower/reference-fixtures.js';
import { exorcismBuildTags, exorcismIsCountered } from './clash.js';
import { compileExorcismEncounter } from './encounter.js';
import { createExorcismHost, ExorcismHost } from './host.js';
import {
  exorcismExpRealm,
  exorcismRewardExpectation,
  planExorcismNemesisBonus,
  planExorcismSearchReward,
  planExorcismSettlement,
  planExorcismWinReward,
} from './rewards.js';
import {
  applyExorcismBattle,
  applyExorcismRestore,
  applyExorcismSupply,
  createExorcismRun,
  exorcismCurrentStage,
  exorcismGrade,
  pickExorcismBoss,
  retreatExorcism,
} from './state.js';

const CONTEXT = {
  mapRealm: '金丹',
  playerRealm: '金丹',
  difficultyTier: 'normal',
} as const;

function resources(hp: number, maxHp = 100, mp = 50): ExorcismResources {
  return {
    player: { hp, maxHp, mp, maxMp: 100 },
    beasts: { pet: { hp: 40, maxHp: 100, mp: 40, maxMp: 100 } },
  };
}

function baseRun(wins = 0): ExorcismRunState {
  return {
    bossId: 'broken_vein',
    lineageId: 'earth',
    countered: false,
    phase: 'battle',
    wins,
    supplies: [],
  };
}

describe('除祟评级', () => {
  it('打到哪一步决定评级，胜首领看气血', () => {
    const line = EXORCISM_ENCOUNTER_PACK.grading.sHpRatio;
    expect(exorcismGrade(0, 1)).toBeNull();
    expect(exorcismGrade(1, 1)).toBe('D');
    expect(exorcismGrade(2, 1)).toBe('C');
    expect(exorcismGrade(3, 1)).toBe('B');
    expect(exorcismGrade(4, line)).toBe('S');
    expect(exorcismGrade(4, line - 0.01)).toBe('A');
  });
});

describe('除祟流程', () => {
  it('胜场推进到补给，胜第四场结束并评级', () => {
    let run = baseRun();
    for (const stage of [1, 2, 3]) {
      expect(exorcismCurrentStage(run)).toBe(stage);
      run = applyExorcismBattle(run, {
        victory: true,
        resources: resources(80),
      });
      expect(run.phase).toBe('supply');
      run = applyExorcismSupply(run, 'search');
      expect(run.phase).toBe('battle');
    }
    run = applyExorcismBattle(run, { victory: true, resources: resources(80) });
    expect(run).toMatchObject({
      phase: 'finished',
      endReason: 'cleared',
      grade: 'S',
      wins: 4,
    });
  });

  it('调息是唯一恢复，搜寻不改状态；已阵亡灵兽不恢复', () => {
    const start = applyExorcismBattle(baseRun(), {
      victory: true,
      resources: {
        ...resources(40),
        beasts: { dead: { hp: 0, maxHp: 100, mp: 10, maxMp: 100 } },
      },
    });
    const rest = applyExorcismSupply(start, 'rest');
    expect(rest.resources?.player).toMatchObject({ hp: 70, mp: 80 });
    expect(rest.resources?.beasts.dead.hp).toBe(0);
    const search = applyExorcismSupply(start, 'search');
    expect(search.resources?.player).toMatchObject({ hp: 40, mp: 50 });
    expect(search.supplies).toEqual(['search']);
  });

  it('调息不能超过上限', () => {
    const start = applyExorcismBattle(baseRun(), {
      victory: true,
      resources: resources(90),
    });
    expect(applyExorcismSupply(start, 'rest').resources?.player.hp).toBe(100);
  });

  it('回复丹药恢复局内状态，不超过上限，结束后不能用', () => {
    const start = applyExorcismBattle(baseRun(), {
      victory: true,
      resources: resources(40),
    });
    expect(
      applyExorcismRestore(start, { hp: 60, mp: 70 }).resources?.player,
    ).toMatchObject({ hp: 60, mp: 70 });
    expect(
      applyExorcismRestore(start, { hp: 999, mp: 999 }).resources?.player,
    ).toMatchObject({ hp: 100, mp: 100 });
    expect(() =>
      applyExorcismRestore(retreatExorcism(start), { hp: 50, mp: 50 }),
    ).toThrow();
  });

  it('败退按已胜场次评级', () => {
    const lost = applyExorcismBattle(baseRun(3), {
      victory: false,
      resources: resources(0),
    });
    expect(lost).toMatchObject({
      phase: 'finished',
      endReason: 'defeated',
      grade: 'B',
    });
    const first = applyExorcismBattle(baseRun(0), {
      victory: false,
      resources: resources(0),
    });
    expect(first.grade).toBeNull();
  });

  it('人物倒地、灵兽收尾算胜，下场留 1 点气血，胜首领只能 A', () => {
    const next = applyExorcismBattle(baseRun(1), {
      victory: true,
      resources: resources(0),
    });
    expect(next.resources?.player.hp).toBe(1);
    const boss = applyExorcismBattle(baseRun(3), {
      victory: true,
      resources: resources(0),
    });
    expect(boss.grade).toBe('A');
  });

  it('已阵亡的灵兽不会因为不在下一场阵容里而复活', () => {
    const first = applyExorcismBattle(baseRun(), {
      victory: true,
      resources: {
        ...resources(80),
        beasts: { pet: { hp: 0, maxHp: 100, mp: 0, maxMp: 100 } },
      },
    });
    const next = applyExorcismBattle(applyExorcismSupply(first, 'search'), {
      victory: true,
      resources: { player: resources(70).player, beasts: {} },
    });
    expect(next.resources?.beasts.pet.hp).toBe(0);
  });

  it('只有补给时才能选择补给，结束后不能再收手，防止重复提交', () => {
    expect(() => applyExorcismSupply(baseRun(1), 'rest')).toThrow();
    expect(() => retreatExorcism(retreatExorcism(baseRun(1)))).toThrow();
    const supply = applyExorcismBattle(baseRun(1), {
      victory: true,
      resources: resources(50),
    });
    expect(() =>
      applyExorcismBattle(supply, { victory: true, resources: resources(50) }),
    ).toThrow();
    expect(retreatExorcism(supply)).toMatchObject({
      endReason: 'retreated',
      grade: 'C',
    });
  });
});

describe('首领抽取', () => {
  it('同种子结果相同，不能靠重开换首领', () => {
    for (const seed of [1, 7, 99, 12345])
      expect(pickExorcismBoss(seed, 'grass')).toBe(
        pickExorcismBoss(seed, 'grass'),
      );
  });

  it('本祟脉首领权重更高但不独占，最近遇到的首领降权', () => {
    const count = (recent: ExorcismBossId[] = []) => {
      const hits = new Map<string, number>();
      for (let seed = 1; seed <= 4000; seed += 1) {
        const id = pickExorcismBoss(seed * 2654435761, 'earth', recent);
        hits.set(id, (hits.get(id) ?? 0) + 1);
      }
      return hits;
    };
    expect(count().get('broken_vein')! / 4000).toBeGreaterThan(0.15);
    expect(count().get('broken_vein')! / 4000).toBeLessThan(0.35);
    expect(count(['broken_vein']).get('broken_vein')!).toBeLessThan(
      count().get('broken_vein')! * 0.6,
    );
  });

  it('开局冻结克星判定', () => {
    const run = createExorcismRun({
      seed: 3,
      lineageId: 'earth',
      isCountered: () => true,
    });
    expect(run.countered).toBe(true);
    expect(run.phase).toBe('battle');
  });
});

describe('除祟内容', () => {
  it('所有地图场景都有祟脉', () => {
    for (const scene of [
      'cave',
      'forest',
      'ice',
      'sea',
      'sect_ruin',
      'steppe',
      'tomb',
      'tower_stele',
      'underground',
      'void',
    ])
      expect(
        Object.values(EXORCISM_LINEAGES).some(
          (row) =>
            row.id === exorcismLineageForScene(scene) &&
            row.scenes.includes(scene),
        ),
      ).toBe(true);
  });

  it('敌人引用的技能和状态都存在', () => {
    const skills = new Set(EXORCISM_SKILLS.map((skill) => skill.id));
    const statuses = new Set(EXORCISM_STATUS_DEFS.map((status) => status.id));
    const encounters = [
      ...Object.values(EXORCISM_LINEAGES).flatMap((row) => [
        row.scout,
        row.ambush,
      ]),
      ...Object.values(EXORCISM_BOSSES).flatMap((row) => [
        row.guardian,
        row.boss,
      ]),
    ];
    for (const encounter of encounters)
      for (const enemy of encounter.enemies) {
        for (const id of [...enemy.cycle, ...(enemy.passives ?? [])])
          expect(id === 'attack' || id === 'defend' || skills.has(id), id).toBe(
            true,
          );
        expect(enemy.portrait).toBeTruthy();
      }
    for (const skill of EXORCISM_SKILLS)
      for (const effect of skill.effects)
        if (effect.type === 'applyStatus')
          expect(statuses.has(effect.statusId)).toBe(true);
  });

  it('强度逐场、逐档递增', () => {
    const power = (
      stage: number,
      tier: 'easy' | 'normal' | 'hard' | 'elite' | 'boss',
    ) => {
      const units = compileExorcismEncounter({
        realm: '化神',
        tier,
        stage,
        bossId: 'withered_vine',
        lineageId: 'water',
      }).units;
      return {
        hp: units.reduce((sum, u) => sum + (u.attrs?.maxHp ?? 0), 0),
        atk: Math.max(...units.map((u) => u.attrs?.magicAtk ?? 0)),
      };
    };
    for (const stage of [2, 3, 4]) {
      expect(power(stage, 'normal').hp).toBeGreaterThan(
        power(stage - 1, 'normal').hp,
      );
    }
    const tiers = ['easy', 'normal', 'hard', 'elite', 'boss'] as const;
    for (let i = 1; i < tiers.length; i += 1) {
      expect(power(4, tiers[i]).hp).toBeGreaterThan(power(4, tiers[i - 1]).hp);
      expect(power(4, tiers[i]).atk).toBeGreaterThan(
        power(4, tiers[i - 1]).atk,
      );
    }
  });

  it('境界系数：筑基削弱，化神不变，更高境界抬高', () => {
    expect(EXORCISM_ENCOUNTER_PACK.realmFactors['筑基']).toBeLessThan(1);
    expect(EXORCISM_ENCOUNTER_PACK.realmFactors['化神'] ?? 1).toBe(1);
    const order = ['炼虚', '合体', '大乘', '渡劫'] as const;
    let previous = 1;
    for (const realm of order) {
      const factor = EXORCISM_ENCOUNTER_PACK.realmFactors[realm]!;
      expect(factor).toBeGreaterThan(previous);
      previous = factor;
    }
  });

  it('祟蚀只从第三战开始带', () => {
    const passives = (stage: number) =>
      compileExorcismEncounter({
        realm: '金丹',
        tier: 'normal',
        stage,
        bossId: 'mirror_lord',
        lineageId: 'grass',
      }).units[0].passives;
    expect(passives(2)).not.toContain('exorcism.corrosion');
    expect(passives(3)).toContain('exorcism.corrosion');
    expect(passives(4)).toContain('exorcism.corrosion');
  });

  it('所有境界都能编出敌人，含没有蜃楼基线的炼气筑基', () => {
    for (const realm of [
      '炼气',
      '筑基',
      '金丹',
      '元婴',
      '化神',
      '炼虚',
      '合体',
      '大乘',
      '渡劫',
    ] as const)
      for (const lineageId of EXORCISM_LINEAGE_IDS)
        for (const stage of [1, 2, 3, 4]) {
          const { units, plans } = compileExorcismEncounter({
            realm,
            tier: 'normal',
            stage,
            bossId: 'broken_vein',
            lineageId,
          });
          expect(units.length).toBeGreaterThan(0);
          for (const unit of units) {
            expect(unit.attrs?.maxHp).toBeGreaterThan(0);
            expect(plans[unit.id!]).toBeDefined();
          }
        }
  });
});

function fight(host: ExorcismHost, maxRounds = 60) {
  let rounds = 0;
  while (!host.finished && rounds < maxRounds) {
    const input = host.runtimeSnapshot().input;
    host.submitGroup(
      automaticCommands(
        host.state,
        host.playerId,
        input.skills ?? [],
        (id) => host.queryCommands(id),
        {
          statusDefs: input.statusDefs,
        },
      ),
    );
    host.resolveRound();
    rounds += 1;
  }
  return rounds;
}

function hostFor(
  bossId: ExorcismBossId,
  wins = 3,
  carried?: ExorcismResources,
) {
  return createExorcismHost(
    towerReferenceBuild('jiujie', '金丹', '中期'),
    { realm: '金丹', tier: 'normal' },
    { bossId, lineageId: 'grass', wins, resources: carried },
    11,
  );
}

function tanky(host: ExorcismHost) {
  const snapshot = host.runtimeSnapshot();
  for (const unit of snapshot.input.units)
    if (unit.side === 1 && unit.attrs) {
      unit.attrs.hp = 10_000_000;
      unit.attrs.maxHp = 10_000_000;
    }
  return new ExorcismHost({
    version: snapshot.version,
    playerId: snapshot.playerId,
    input: snapshot.input,
    npcPlans: snapshot.npcPlans,
  });
}

describe('除祟战斗', () => {
  it('局内资源独立：入场回满，不读现实气血，并带入累计状态', () => {
    const player = towerReferenceBuild('jiujie', '金丹', '中期');
    player.cultivator.condition!.resources.hp.current = 1;
    const fresh = createExorcismHost(
      player,
      { realm: '金丹', tier: 'normal' },
      { bossId: 'broken_vein', lineageId: 'earth', wins: 0 },
      1,
    );
    const unit = fresh.state.units.find((u) => u.id === fresh.playerId)!;
    expect(unit.attrs.hp).toBe(unit.attrs.maxHp);
    const carried = createExorcismHost(
      player,
      { realm: '金丹', tier: 'normal' },
      {
        bossId: 'broken_vein',
        lineageId: 'earth',
        wins: 1,
        resources: {
          player: {
            hp: 123,
            mp: 45,
            maxHp: unit.attrs.maxHp,
            maxMp: unit.attrs.maxMp,
          },
          beasts: {},
        },
      },
      1,
    );
    const next = carried.state.units.find((u) => u.id === carried.playerId)!;
    expect(next.attrs.hp).toBe(123);
    expect(next.attrs.mp).toBe(45);
    expect(player.cultivator.condition!.resources.hp.current).toBe(1);
  });

  it('已阵亡的灵兽本局不再出战', () => {
    const base = hostFor('broken_vein', 0);
    const petId = base.state.units.find((u) => u.ownerId === base.playerId)!.id;
    const host = hostFor('broken_vein', 1, {
      player: { hp: 500, mp: 100, maxHp: 1000, maxMp: 1000 },
      beasts: { [petId]: { hp: 0, mp: 0, maxHp: 100, maxMp: 100 } },
    });
    expect(host.state.units.some((u) => u.id === petId)).toBe(false);
  });

  it('快照可恢复，恢复后继续行动方案', () => {
    const host = hostFor('withered_vine');
    fight(host, 2);
    const snapshot = host.runtimeSnapshot();
    const restored = new ExorcismHost(snapshot, snapshot);
    expect(restored.state.round).toBe(host.state.round);
    fight(restored, 1);
    expect(restored.state.round).toBeGreaterThanOrEqual(host.state.round);
  });

  it('枯藤老祟种下寄生并叠层，枯荣时引爆', () => {
    const host = tanky(hostFor('withered_vine'));
    fight(host, 1);
    const stacks = () =>
      host.state.units
        .find((u) => u.id === host.playerId)!
        .statuses.find((s) => s.id === 'exorcism.parasite')?.stacks ?? 0;
    expect(stacks()).toBe(1);
    fight(host, 2);
    expect(stacks()).toBe(2);
    fight(host, 1);
    expect(stacks()).toBe(0);
  });

  it('断脉石魁三拍循环，重击后露出破绽', () => {
    const host = tanky(hostFor('broken_vein'));
    fight(host, 3);
    expect(
      host.state.units
        .find((u) => u.id === 'exorcism.enemy.0')!
        .statuses.some((s) => s.id === 'exorcism.exposed'),
    ).toBe(true);
  });

  it('噬灵魔影烧法力并留下灵损', () => {
    const host = tanky(hostFor('soul_shadow'));
    const before = host.state.units.find((u) => u.id === host.playerId)!.attrs
      .mp;
    fight(host, 1);
    const unit = host.state.units.find((u) => u.id === host.playerId)!;
    expect(unit.attrs.mp).toBeLessThan(before);
    expect(unit.statuses.some((s) => s.id === 'exorcism.soul-wound')).toBe(
      true,
    );
  });

  it('两名镜侍每回合都给尊主加减伤', () => {
    const host = tanky(hostFor('mirror_lord'));
    fight(host, 1);
    const applied = host
      .runtimeSnapshot()
      .events.filter(
        (event) =>
          event.type === 'statusApplied' &&
          event.statusId === 'exorcism.mirror-cover' &&
          event.unitId === 'exorcism.enemy.0',
      );
    // 开场与下一回合开始各生效一次，每次两名镜侍。
    expect(applied.length % 2).toBe(0);
    expect(applied.length).toBeGreaterThanOrEqual(2);
  });

  function tweaked(
    bossId: ExorcismBossId,
    tweak: (units: ExorcismHost['state']['units'] | any[]) => void,
    sect: 'jiujie' | 'lingxiao' = 'jiujie',
  ) {
    const base = createExorcismHost(
      towerReferenceBuild(sect, '金丹', '中期'),
      { realm: '金丹', tier: 'normal' },
      { bossId, lineageId: 'grass', wins: 3 },
      11,
    );
    const snapshot = base.runtimeSnapshot();
    tweak(snapshot.input.units);
    return new ExorcismHost({
      version: snapshot.version,
      playerId: snapshot.playerId,
      input: snapshot.input,
      npcPlans: snapshot.npcPlans,
    });
  }
  const applied = (host: ExorcismHost, statusId: string) =>
    host
      .runtimeSnapshot()
      .events.filter(
        (event) =>
          event.type === 'statusApplied' && event.statusId === statusId,
      ).length;
  const huge = (units: any[]) => {
    for (const unit of units)
      if (unit.side === 1 && unit.attrs) {
        unit.attrs.hp = 10_000_000;
        unit.attrs.maxHp = 10_000_000;
      }
  };

  it('潮汐蛟影单双回合交替减伤', () => {
    const host = tweaked('tide_serpent', huge);
    fight(host, 1);
    expect(applied(host, 'exorcism.tide.physical-ward')).toBeGreaterThan(0);
    fight(host, 1);
    expect(applied(host, 'exorcism.tide.spell-ward')).toBeGreaterThan(0);
  });

  it('金身尸王倒下后再起一次', () => {
    const host = tweaked('gilded_corpse', (units) => {
      const boss = units.find((u) => u.side === 1);
      boss.attrs.hp = 1;
    });
    fight(host, 1);
    const boss = host.state.units.find((u) => u.id === 'exorcism.enemy.0')!;
    expect(boss.flags.dead || boss.flags.downed).toBeFalsy();
    expect(boss.attrs.hp).toBeGreaterThan(1);
  });

  it('噬灵护法替邪修疗伤，双方气血都有记录', () => {
    const host = tweaked('heretic', (units) => {
      huge(units);
      units.find((u) => u.id === 'exorcism.enemy.0').attrs.hp = 5_000_000;
    });
    fight(host, 1);
    expect(
      host.state.units.find((u) => u.id === 'exorcism.enemy.0')!.attrs.hp,
    ).toBeGreaterThan(5_000_000);
  });

  it('缚梦幻师命中后封住术法', () => {
    const host = tweaked('dream_binder', (units) => {
      huge(units);
      for (const unit of units) {
        if (unit.side === 1) unit.attrs.sealHit = 100_000;
        else if (unit.attrs) unit.attrs.sealResist = 0;
      }
    });
    fight(host, 1);
    expect(applied(host, 'exorcism.bound')).toBeGreaterThan(0);
  });

  it('铜傀镇守反震物理攻击者', () => {
    const run = (passive: boolean) => {
      const host = tweaked(
        'bronze_warden',
        (units) => {
          huge(units);
          if (!passive) units.find((u) => u.side === 1).passives = [];
        },
        'lingxiao',
      );
      fight(host, 3);
      return host.state.units.find((u) => u.id === host.playerId)!.attrs.hp;
    };
    expect(run(true)).toBeLessThan(run(false));
  });

  it('残魂守试者隐身期间战斗照常推进', () => {
    const host = tweaked('lingering_soul', huge);
    fight(host, 3);
    expect(applied(host, 'exorcism.faded')).toBeGreaterThan(0);
    const before = host.state.round;
    fight(host, 1);
    expect(host.state.round).toBeGreaterThan(before);
  });

  it('小妖死后山魈王暴怒', () => {
    const host = tweaked('mountain_king', (units) => {
      huge(units);
      for (const slot of [1, 2]) {
        const minion = units.find((u) => u.id === `exorcism.enemy.${slot}`);
        minion.attrs.hp = 1;
        minion.attrs.maxHp = 1;
      }
    });
    fight(host, 5);
    expect(applied(host, 'exorcism.mountain-rage')).toBeGreaterThan(0);
  });

  it('血契掮客先借力，到期后开始收债', () => {
    const host = tweaked('blood_broker', huge);
    fight(host, 1);
    expect(applied(host, 'exorcism.borrowed')).toBe(1);
    fight(host, 4);
    const statuses = host.state.units.find(
      (u) => u.id === host.playerId,
    )!.statuses;
    expect(statuses.some((status) => status.id === 'exorcism.debt')).toBe(true);
  });

  it('首领战全程带祟气减疗，前几场没有', () => {
    const boss = tweaked('broken_vein', huge);
    fight(boss, 1);
    expect(applied(boss, 'exorcism.taint')).toBeGreaterThan(0);
    const early = hostFor('broken_vein', 0);
    fight(early, 1);
    expect(applied(early, 'exorcism.taint')).toBe(0);
  });

  it('血河妖蟒的血牙留下血毒，腐骨药婆的瘴气留下腐气', () => {
    const python = tweaked('blood_python', huge);
    fight(python, 1);
    expect(applied(python, 'exorcism.blood-rot')).toBeGreaterThan(0);
    const crone = tweaked('rot_crone', huge);
    fight(crone, 1);
    expect(applied(crone, 'exorcism.rot')).toBeGreaterThan(0);
  });

  it('所有首领都能完整打完一场', () => {
    for (const bossId of EXORCISM_BOSS_IDS) {
      const host = createExorcismHost(
        towerReferenceBuild('tianyan', '金丹', '后期'),
        { realm: '金丹', tier: 'normal' },
        { bossId, lineageId: 'water', wins: 3 },
        5,
      );
      fight(host);
      expect(host.finished, bossId).toBe(true);
    }
  });

  it('祟蚀第 10 回合起生效：无视防御掉血并降低受疗', () => {
    const snapshotHost = tanky(hostFor('mirror_lord'));
    const snapshot = snapshotHost.runtimeSnapshot();
    for (const unit of snapshot.input.units) {
      if (unit.side !== 1 || !unit.attrs) continue;
      unit.attrs.physicalAtk = 1;
      unit.attrs.magicAtk = 1;
    }
    const player = snapshot.input.units.find(
      (u) => u.id === snapshot.playerId,
    )!;
    player.attrs = { ...player.attrs, hp: 1_000_000, maxHp: 1_000_000 };
    const host = new ExorcismHost({
      version: snapshot.version,
      playerId: snapshot.playerId,
      input: snapshot.input,
      npcPlans: snapshot.npcPlans,
    });
    fight(host, 9);
    const hpAt9 = host.state.units.find((u) => u.id === host.playerId)!.attrs
      .hp;
    const marked = () =>
      host.state.units
        .find((u) => u.id === host.playerId)!
        .statuses.some((s) => s.id === 'exorcism.corrosion.mark');
    expect(marked()).toBe(false);
    fight(host, 1);
    const hpAt10 = host.state.units.find((u) => u.id === host.playerId)!.attrs
      .hp;
    expect(hpAt9 - hpAt10).toBeGreaterThanOrEqual(
      1_000_000 * EXORCISM_ENCOUNTER_PACK.corrosion.hpRatio - 1,
    );
    expect(marked()).toBe(true);
  });

  it('自动战斗能打完一整局并产生合法资源', () => {
    const player = towerReferenceBuild('tianyan', '金丹', '后期');
    let run = baseRun();
    while (run.phase !== 'finished') {
      if (run.phase === 'supply') {
        run = applyExorcismSupply(run, 'rest');
        continue;
      }
      const host = createExorcismHost(
        player,
        { realm: '金丹', tier: 'normal' },
        run,
        40 + run.wins,
      );
      fight(host);
      expect(host.finished).toBe(true);
      run = applyExorcismBattle(run, {
        victory: host.trace().outcome === 'victory',
        resources: host.finalResources(),
      });
    }
    expect(run.wins).toBeGreaterThan(0);
    expect(run.supplies.length).toBeLessThanOrEqual(3);
  });
});

describe('克星判定', () => {
  it('按构筑特征命中首领的克制标签', () => {
    for (const [sect, damage] of [
      ['lingxiao', 'physical'],
      ['xiaoyue', 'physical'],
      ['jiujie', 'spell'],
      ['tianyan', 'spell'],
    ] as const) {
      const projected = projectCharacterToCombatV6({
        ...towerReferenceBuild(sect, '金丹', '中期'),
        side: 0,
        slot: 0,
        resourcePolicy: 'full',
      });
      if (!projected.ok) throw new Error('投影失败');
      const tags = exorcismBuildTags(projected.unit, projected.skills);
      expect(tags).toContain(damage);
    }
    expect(exorcismIsCountered('broken_vein', ['physical'])).toBe(true);
    expect(exorcismIsCountered('broken_vein', ['spell'])).toBe(false);
    expect(exorcismIsCountered('mirror_lord', ['single_target'])).toBe(true);
    expect(
      exorcismIsCountered('tide_serpent', ['physical', 'single_target']),
    ).toBe(false);
  });

  it('克星是少数局：任何构筑被克制的首领不超过三分之一', () => {
    const tagSets = [
      ['physical', 'single_target'],
      ['spell', 'sustain'],
      ['physical', 'spell'],
      ['spell', 'sustain', 'single_target'],
    ] as const;
    for (const tags of tagSets) {
      const countered = EXORCISM_BOSS_IDS.filter((id) =>
        exorcismIsCountered(id, tags),
      );
      expect(countered.length / EXORCISM_BOSS_IDS.length).toBeLessThanOrEqual(
        0.37,
      );
    }
  });

  it('写了克制对象的首领都有克星提示，所有首领都有机制说明', () => {
    for (const id of EXORCISM_BOSS_IDS) {
      expect(EXORCISM_BOSSES[id].mechanic).toBeTruthy();
      if (EXORCISM_BOSSES[id].counters.length)
        expect(EXORCISM_BOSSES[id].counterLine).toBeTruthy();
    }
  });
});

describe('除祟奖励', () => {
  /** 探秘基准：线索×0.08/0.65/0.3、胜场×0.18/1.3/0.6、通关物品 1，加评级资源。 */
  const mystery = () => {
    const tiers = {
      S: { share: 0.15, clues: 8, wins: 1, exp: 0.8, hours: 11.5 },
      A: { share: 0.3, clues: 7, wins: 1, exp: 0.55, hours: 9 },
      B: { share: 0.3, clues: 6, wins: 0.5, exp: 0.35, hours: 6.5 },
      C: { share: 0.15, clues: 4, wins: 0, exp: 0.2, hours: 4.5 },
      D: { share: 0.1, clues: 3, wins: 0, exp: 0.1, hours: 3 },
    };
    return Object.values(tiers).reduce(
      (sum, t) => ({
        exp: sum.exp + t.share * (t.clues * 0.08 + t.wins * 0.18 + t.exp),
        stones:
          sum.stones + t.share * (t.clues * 0.65 + t.wins * 1.3 + t.hours),
        items: sum.items + t.share * (t.clues * 0.3 + t.wins * 0.6 + 1),
      }),
      { exp: 0, stones: 0, items: 0 },
    );
  };
  const distribution = {
    none: 0.05,
    D: 0.09,
    C: 0.14,
    B: 0.22,
    A: 0.3,
    S: 0.2,
  };

  it('按目标分布，期望约为探秘的 0.7 倍', () => {
    const base = mystery();
    const got = exorcismRewardExpectation(distribution);
    for (const key of ['exp', 'stones', 'items'] as const) {
      expect(got[key] / base[key]).toBeGreaterThan(0.665);
      expect(got[key] / base[key]).toBeLessThan(0.735);
    }
  });

  it('评级越高奖励越多，败退打折而收手不打折', () => {
    const order = ['D', 'C', 'B', 'A', 'S'] as const;
    for (let i = 1; i < order.length; i += 1)
      expect(
        EXORCISM_REWARD_PACK.grades[order[i]].dailyExpFraction,
      ).toBeGreaterThan(
        EXORCISM_REWARD_PACK.grades[order[i - 1]].dailyExpFraction,
      );
    const retreated = planExorcismSettlement(5, 'B', 'retreated', 45, CONTEXT);
    const defeated = planExorcismSettlement(5, 'B', 'defeated', 45, CONTEXT);
    expect(defeated.experience).toBe(Math.floor(retreated.experience * 0.8));
    expect(defeated.spiritStones).toBeLessThan(retreated.spiritStones);
  });

  it('同种子重试不重抽，不同场次相互独立', () => {
    expect(planExorcismWinReward(9, 2, 45, CONTEXT)).toEqual(
      planExorcismWinReward(9, 2, 45, CONTEXT),
    );
    expect(planExorcismSearchReward(9, 1, 45, CONTEXT)).toEqual(
      planExorcismSearchReward(9, 1, 45, CONTEXT),
    );
    expect(planExorcismWinReward(9, 2, 45, CONTEXT).key).not.toBe(
      planExorcismWinReward(9, 3, 45, CONTEXT).key,
    );
  });

  it('修为按较低境界：高境界打低节点拿不到全额', () => {
    expect(exorcismExpRealm('渡劫', '筑基')).toBe('筑基');
    expect(exorcismExpRealm('筑基', '渡劫')).toBe('筑基');
    const high = planExorcismWinReward(9, 1, 25, {
      ...CONTEXT,
      mapRealm: '筑基',
      playerRealm: '渡劫',
    });
    const same = planExorcismWinReward(9, 1, 25, {
      ...CONTEXT,
      mapRealm: '筑基',
      playerRealm: '筑基',
    });
    expect(high.experience).toBe(same.experience);
  });

  it('节点难度提高奖励', () => {
    const normal = planExorcismWinReward(9, 1, 45, CONTEXT);
    const boss = planExorcismWinReward(9, 1, 45, {
      ...CONTEXT,
      difficultyTier: 'boss',
    });
    expect(boss.experience).toBeGreaterThan(normal.experience);
  });

  it('克星加掷不发基础物品', () => {
    for (let seed = 1; seed < 200; seed += 1) {
      const plan = planExorcismNemesisBonus(seed, 45);
      expect(plan.materialCount).toBe(0);
      expect(plan.items.length).toBeLessThanOrEqual(1);
    }
  });
});
