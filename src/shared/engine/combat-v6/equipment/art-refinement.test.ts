import { combatV6Units } from '@shared/combat-v6/presentation';
import { describe, expect, it } from 'vitest';
import {
  CommandType,
  EffectType,
  EventType,
  SkillTag,
  StatusCategory,
  TargetSide,
  createBattle,
  effectiveSpeed,
  type SkillDef,
  type StatusDef,
} from '../core';
import { createDaoyouRuleset } from '../rules-daoyou';
import { COMBAT_V6_PHASE_4B_VERSIONS } from '../version';
import pack from './data/equipment-special.json';
import { DAO_EQUIPMENT_ARTS_V1, DAO_RAGE_RESOURCE_ID } from './special-content';

const art = (id: string) =>
  DAO_EQUIPMENT_ARTS_V1.find((a) => a.id === `dao_equipment.art.${id}`)!;
const idle: SkillDef = {
  id: 'test.idle',
  name: '停手',
  tags: [SkillTag.Support],
  targeting: { side: TargetSide.Self },
  effects: [],
};
const hit = (kind: 'physical' | 'spell' | 'fixed'): SkillDef => ({
  id: `test.${kind}`,
  name: kind,
  tags: [],
  targeting: { side: TargetSide.Enemy },
  effects: [
    {
      type:
        kind === 'physical'
          ? EffectType.PhysicalHit
          : kind === 'spell'
            ? EffectType.SpellHit
            : EffectType.FixedHit,
      power: 100,
    },
  ],
});
const ruleset = createDaoyouRuleset({
  formulas: {
    fluctuationMin: 1,
    fluctuationMax: 1,
    physicalFluctuationMin: 1,
    physicalFluctuationMax: 1,
    physicalHitChance: () => 1,
    spellHitChance: () => 1,
  },
});
function battle(statusDefs: StatusDef[] = [], extras: SkillDef[] = []) {
  return createBattle({
    seed: 17,
    versions: COMBAT_V6_PHASE_4B_VERSIONS,
    ruleset,
    skills: [
      ...DAO_EQUIPMENT_ARTS_V1.map((a) => a.skill),
      idle,
      hit('physical'),
      hit('spell'),
      hit('fixed'),
      ...extras,
    ],
    statusDefs: [
      ...DAO_EQUIPMENT_ARTS_V1.flatMap((a) => a.statusDefs ?? []),
      ...statusDefs,
    ],
    units: ['source', 'ally', 'beast', 'bench', 'enemy', 'enemy2'].map(
      (id, i) => ({
        id,
        name: id,
        side: i < 4 ? 0 : 1,
        kind: i === 2 || i === 3 ? 'pet' : 'player',
        ...(i === 2 || i === 3 ? { ownerId: 'source' } : {}),
        benched: i === 3,
        skills: [
          ...DAO_EQUIPMENT_ARTS_V1.map((a) => a.skill.id),
          idle.id,
          'test.physical',
          'test.spell',
          'test.fixed',
          ...extras.map((s) => s.id),
        ],
        resources: [
          { id: DAO_RAGE_RESOURCE_ID, name: '战意', current: 150, max: 150 },
        ],
        attrs: {
          hp: 1000,
          maxHp: 10000 + i * 1000,
          mp: 50,
          maxMp: 100,
          healPower: 900,
          speed: 100 - i * 10,
          physicalAtk: 500,
          magicAtk: 500,
          physicalDef: 100,
          magicDef: 100,
        },
      }),
    ),
  });
}
type Battle = ReturnType<typeof battle>;
function round(b: Battle, caster: string, skillId: string, target: string) {
  for (const u of b.state.units) {
    if (u.flags.benched || u.flags.downed || u.flags.dead) continue;
    b.submit(u.id, {
      type: CommandType.Skill,
      skillId: u.id === caster ? skillId : idle.id,
      targets: [u.id === caster ? target : u.id],
    });
  }
  b.lockAndResolve();
}
function seed(b: Battle, unit: string, def: StatusDef) {
  b.unit(unit).statuses.push({
    id: def.id,
    kind: def.kind,
    sourceId: 'enemy',
    remainingRounds: 20,
    appliedRound: 0,
    attrMods: {},
    speedMod: 0,
    damageTakenPhysical: def.damageTakenPhysical ?? 1,
    damageTakenSpell: def.damageTakenSpell ?? 1,
    healTaken: def.healTaken ?? 1,
    healDealt: 1,
    stacks: 1,
  });
}
const suppress: StatusDef = {
  id: 'test.seal',
  name: '封法',
  kind: 'tianyan.status.seal',
  category: StatusCategory.Control,
  blocksSpell: true,
};
const debuff: StatusDef = {
  id: 'test.debuff',
  name: '减疗',
  kind: 'test.healing',
  category: StatusCategory.Debuff,
  healTaken: 0.5,
};

describe('refined equipment arts', () => {
  it('locks approved rage prices independently of the runtime compiler', () => {
    expect(pack.arts.map((a) => [a.id, a.rageCost])).toEqual([
      ['dao_equipment.art.huiyuan', 30],
      ['dao_equipment.art.yangyuan', 60],
      ['dao_equipment.art.xuming', 90],
      ['dao_equipment.art.baoyuan', 60],
      ['dao_equipment.art.guizhen', 130],
      ['dao_equipment.art.huanhun', 80],
      ['dao_equipment.art.qingxin', 50],
      ['dao_equipment.art.dichen', 100],
      ['dao_equipment.art.taiqing', 125],
      ['dao_equipment.art.chengtian', 150],
      ['dao_equipment.art.cuozhi', 40],
      ['dao_equipment.art.hanyue', 40],
      ['dao_equipment.art.hanyueyin', 60],
      ['dao_equipment.art.huti', 40],
      ['dao_equipment.art.hutiyin', 60],
      ['dao_equipment.art.lianfeng', 30],
      ['dao_equipment.art.lianfengyin', 60],
      ['dao_equipment.art.liejia', 35],
      ['dao_equipment.art.liejiayin', 60],
      ['dao_equipment.art.xuanling', 60],
      ['dao_equipment.art.xuantian', 150],
      ['dao_equipment.art.fuying', 40],
      ['dao_equipment.art.fuyingyin', 60],
      ['dao_equipment.art.yufeng', 40],
      ['dao_equipment.art.yufengyin', 60],
      ['dao_equipment.art.lingyan', 40],
      ['dao_equipment.art.jifa', 30],
      ['dao_equipment.art.kurong', 125],
      ['dao_equipment.art.diefeng', 80],
      ['dao_equipment.art.sandie', 60],
      ['dao_equipment.art.juling', 60],
      ['dao_equipment.art.wanxiang', 150],
      ['dao_equipment.art.zebei', 135],
      ['dao_equipment.art.niming', 120],
      ['dao_equipment.art.due', 150],
      ['dao_equipment.art.dongxu', 50],
      ['dao_equipment.art.cuiling', 80],
      ['dao_equipment.art.dangchen', 125],
    ]);
  });
  it('exposes permanent duration to battle and replay presentation', () => {
    const b = battle();
    round(b, 'source', art('hanyue').skill.id, 'ally');
    const view = combatV6Units(
      b.state,
      DAO_EQUIPMENT_ARTS_V1.flatMap((a) => a.statusDefs ?? []),
    );
    expect(view.find((u) => u.id === 'ally')?.statuses[0].untilBattleEnd).toBe(
      true,
    );
  });
  it('opens exactly the approved 38 arts', () => {
    expect(pack.arts.map((a) => a.id).sort()).toEqual(
      [
        'dao_equipment.art.huiyuan',
        'dao_equipment.art.yangyuan',
        'dao_equipment.art.xuming',
        'dao_equipment.art.baoyuan',
        'dao_equipment.art.guizhen',
        'dao_equipment.art.huanhun',
        'dao_equipment.art.qingxin',
        'dao_equipment.art.dichen',
        'dao_equipment.art.taiqing',
        'dao_equipment.art.chengtian',
        'dao_equipment.art.cuozhi',
        'dao_equipment.art.hanyue',
        'dao_equipment.art.hanyueyin',
        'dao_equipment.art.huti',
        'dao_equipment.art.hutiyin',
        'dao_equipment.art.lianfeng',
        'dao_equipment.art.lianfengyin',
        'dao_equipment.art.liejia',
        'dao_equipment.art.liejiayin',
        'dao_equipment.art.xuanling',
        'dao_equipment.art.xuantian',
        'dao_equipment.art.fuying',
        'dao_equipment.art.fuyingyin',
        'dao_equipment.art.yufeng',
        'dao_equipment.art.yufengyin',
        'dao_equipment.art.diefeng',
        'dao_equipment.art.sandie',
        'dao_equipment.art.juling',
        'dao_equipment.art.wanxiang',
        'dao_equipment.art.zebei',
        'dao_equipment.art.niming',
        'dao_equipment.art.due',
        'dao_equipment.art.dongxu',
        'dao_equipment.art.cuiling',
        'dao_equipment.art.dangchen',
        'dao_equipment.art.lingyan',
        'dao_equipment.art.jifa',
        'dao_equipment.art.kurong',
      ].sort(),
    );
    expect(
      DAO_EQUIPMENT_ARTS_V1.every(
        (a) =>
          !a.description.includes('{') && a.skill.tags.includes(SkillTag.Art),
      ),
    ).toBe(true);
  });
  it.each([
    ['huiyuan', 0.2],
    ['yangyuan', 0.3],
    ['xuming', 0.4],
    ['baoyuan', 0.4],
    ['guizhen', 0.6],
  ] as const)('%s restores its percent without heal power', (id, ratio) => {
    const b = battle();
    const target = art(id).skill.targeting.side === 'self' ? 'source' : 'ally';
    round(b, 'source', art(id).skill.id, target);
    expect(b.unit(target).attrs.hp).toBe(
      1000 + b.unit(target).attrs.maxHp * ratio,
    );
  });
  it('group cleanse heals each active ally by its own maximum, retains debuffs, excludes bench', () => {
    const b = battle([suppress, debuff]);
    for (const id of ['source', 'ally', 'beast', 'bench']) {
      seed(b, id, suppress);
      seed(b, id, debuff);
    }
    round(b, 'source', art('chengtian').skill.id, 'ally');
    for (const id of ['source', 'ally', 'beast']) {
      expect(b.unit(id).attrs.hp).toBe(
        1000 + b.unit(id).attrs.maxHp * 0.15 * 0.5,
      );
      expect(b.unit(id).statuses.map((s) => s.id)).toEqual([debuff.id]);
    }
    expect(b.unit('bench').attrs.hp).toBe(1000);
    expect(b.unit('bench').statuses).toHaveLength(2);
  });
  it('honors wounds and never heals wound capacity', () => {
    const b = battle();
    b.unit('ally').wound = 9500;
    round(b, 'source', art('xuming').skill.id, 'ally');
    expect(b.unit('ally').attrs.hp).toBe(1500);
    expect(b.unit('ally').wound).toBe(9500);
  });
  it('subtracts enemy rage, clamps zero, and pays the caster independently', () => {
    const b = battle();
    b.unit('enemy').resources[0].current = 40;
    round(b, 'source', art('cuozhi').skill.id, 'enemy');
    expect(b.unit('enemy').resources[0].current).toBe(0);
    expect(b.unit('source').resources[0].current).toBe(110);
  });
  it.each(['qingxin', 'sandie'])(
    'allows %s under spell seal in both preview and execution',
    (id) => {
      const b = battle([suppress]);
      seed(b, 'source', suppress);
      expect(
        b
          .queryCommands('source')
          .skills.find((s) => s.skillId === art(id).skill.id)?.ready,
      ).toBe(true);
      round(
        b,
        'source',
        art(id).skill.id,
        id === 'sandie' ? 'enemy' : 'source',
      );
      expect(b.unit('source').resources[0].current).toBe(
        150 - art(id).rageCost,
      );
      expect(b.log().some((e) => e.type === EventType.ActionFailed)).toBe(
        false,
      );
    },
  );
  it.each(['blocksPhysical', 'blocksAction'] as const)(
    'blocks physical art under %s without paying rage',
    (flag) => {
      const def = { ...suppress, blocksSpell: false, [flag]: true };
      const b = battle([def]);
      seed(b, 'source', def);
      round(b, 'source', art('diefeng').skill.id, 'enemy');
      expect(b.unit('source').resources[0].current).toBe(150);
      expect(b.unit('enemy').attrs.hp).toBe(1000);
    },
  );
  it('strong status survives weaker group cast and persists beyond ordinary durations', () => {
    const b = battle();
    round(b, 'source', art('hanyue').skill.id, 'ally');
    round(b, 'source', art('hanyueyin').skill.id, 'source');
    expect(b.unit('ally').statuses.map((s) => s.id)).toEqual([
      art('hanyue').statusDefs![0].id,
    ]);
    for (let i = 0; i < 6; i++) round(b, 'source', idle.id, 'source');
    expect(b.unit('ally').statuses).toHaveLength(1);
  });
  it('weak status upgrades, while speed recasts do not compound', () => {
    const b = battle();
    round(b, 'source', art('yufengyin').skill.id, 'source');
    round(b, 'source', art('yufeng').skill.id, 'ally');
    expect(effectiveSpeed(b.unit('ally'))).toBe(99);
    round(b, 'source', art('yufeng').skill.id, 'ally');
    expect(effectiveSpeed(b.unit('ally'))).toBe(99);
  });
  it('counts the casting round and keeps the longer equal-strength shield', () => {
    const b = battle();
    round(b, 'source', art('xuanling').skill.id, 'ally');
    expect(b.unit('ally').statuses[0].remainingRounds).toBe(4);
    b.unit('source').resources[0].current = 150;
    round(b, 'source', art('xuantian').skill.id, 'source');
    expect(b.unit('ally').statuses[0].id).toBe(
      art('xuanling').statusDefs![0].id,
    );
    for (let i = 0; i < 3; i++) round(b, 'source', idle.id, 'source');
    expect(b.unit('ally').statuses).toHaveLength(0);
  });
  it('revives to 20%, obeys reduced healing and blocks forbidden revival', () => {
    const ban = {
      ...suppress,
      id: 'test.ban',
      blocksSpell: false,
      blocksRevive: true,
      persistWhenDowned: true,
    };
    for (const blocked of [false, true]) {
      const b = battle([ban, debuff]);
      const u = b.unit('ally');
      u.attrs.hp = 0;
      u.flags.downed = true;
      seed(b, 'ally', debuff);
      if (blocked) seed(b, 'ally', ban);
      round(b, 'source', art('huanhun').skill.id, 'ally');
      expect(u.attrs.hp).toBe(blocked ? 0 : 1100);
      expect(u.flags.downed).toBe(blocked);
    }
  });
  it('uses final damage factors for three segments and never damages another target', () => {
    const b = battle();
    b.unit('enemy').attrs.hp = 14000;
    round(b, 'source', art('sandie').skill.id, 'enemy');
    const hits = b
      .log()
      .filter((e) => e.type === EventType.Damage && e.sourceId === 'source');
    expect(hits).toHaveLength(3);
    if (hits.every((e) => e.type === EventType.Damage)) {
      expect(hits[0].amount).toBe(Math.floor(hits[2].amount * 0.3));
      expect(hits[1].amount).toBe(Math.floor(hits[2].amount * 0.5));
    }
    expect(b.unit('enemy2').attrs.hp).toBe(1000);
  });
  it('stops a multi-hit at death', () => {
    const b = battle();
    b.unit('enemy').attrs.hp = 1;
    round(b, 'source', art('diefeng').skill.id, 'enemy');
    expect(
      b
        .log()
        .filter((e) => e.type === EventType.Hit && e.sourceId === 'source'),
    ).toHaveLength(1);
    expect(b.unit('enemy2').attrs.hp).toBe(1000);
  });
  it.each([
    ['hanyue', 'physical', 1.15, 'dealt'],
    ['hanyueyin', 'physical', 1.1, 'dealt'],
    ['lianfeng', 'physical', 0.85, 'enemyDealt'],
    ['lianfengyin', 'physical', 0.9, 'enemyDealt'],
    ['huti', 'physical', 0.88, 'taken'],
    ['hutiyin', 'physical', 0.92, 'taken'],
    ['liejia', 'physical', 1.12, 'enemyTaken'],
    ['liejiayin', 'physical', 1.08, 'enemyTaken'],
    ['lingyan', 'spell', 1.1, 'dealt'],
    ['jifa', 'spell', 0.9, 'enemyDealt'],
    ['xuanling', 'spell', 0.5, 'taken'],
    ['xuantian', 'spell', 0.5, 'taken'],
  ] as const)(
    '%s changes only the matching damage result',
    (id, kind, factor, mode) => {
      function resolve(
        withArt: boolean,
        attackKind: 'physical' | 'spell' | 'fixed',
      ) {
        const b = battle();
        for (const u of b.state.units) u.attrs.hp = u.attrs.maxHp;
        round(
          b,
          'source',
          withArt ? art(id).skill.id : idle.id,
          mode.startsWith('enemy') ? 'enemy' : 'ally',
        );
        const attacker =
          mode === 'dealt'
            ? 'ally'
            : mode === 'enemyDealt' || mode === 'taken'
              ? 'enemy'
              : 'source';
        const target =
          mode === 'dealt' || mode === 'enemyTaken' ? 'enemy' : 'ally';
        const before = b.unit(target).attrs.hp;
        round(b, attacker, `test.${attackKind}`, target);
        return before - b.unit(target).attrs.hp;
      }
      expect(resolve(true, kind)).toBe(
        Math.floor(resolve(false, kind) * factor),
      );
      expect(resolve(true, 'fixed')).toBe(resolve(false, 'fixed'));
    },
  );
  it('group healing reduction halves a percent heal and expires after three rounds', () => {
    const b = battle();
    round(b, 'source', art('kurong').skill.id, 'enemy');
    expect(b.unit('enemy2').statuses[0].healTaken).toBe(0.5);
    round(b, 'enemy', art('huiyuan').skill.id, 'enemy2');
    expect(b.unit('enemy2').attrs.hp).toBe(2500);
    round(b, 'source', idle.id, 'source');
    expect(b.unit('enemy2').statuses).toHaveLength(0);
  });
  it('revival preview selects fallen active allies only, including fallen pets', () => {
    const b = battle();
    b.unit('beast').flags.dead = true;
    b.unit('beast').attrs.hp = 0;
    b.unit('bench').flags.dead = true;
    expect(
      b
        .queryCommands('source')
        .skills.find((s) => s.skillId === art('huanhun').skill.id)
        ?.selectableTargetIds,
    ).toEqual(['beast']);
    round(b, 'source', art('huanhun').skill.id, 'beast');
    expect(b.unit('beast').flags.dead).toBe(false);
    expect(b.unit('beast').attrs.hp).toBe(2400);
  });
  it('restores MP using caster level and each target maximum, then target level cap', () => {
    const b = battle();
    b.unit('source').level = 50;
    b.unit('source').attrs.maxMp = 1000;
    round(b, 'source', art('juling').skill.id, 'source');
    expect(b.unit('source').attrs.mp).toBe(300);
    b.unit('source').resources[0].current = 150;
    b.unit('ally').level = 3;
    b.unit('ally').attrs.maxMp = 1000;
    b.unit('beast').level = 20;
    b.unit('beast').attrs.maxMp = 800;
    round(b, 'source', art('wanxiang').skill.id, 'ally');
    expect(b.unit('source').attrs.mp).toBe(450);
    expect(b.unit('ally').attrs.mp).toBe(80);
    expect(b.unit('beast').attrs.mp).toBe(180);
    expect(b.unit('bench').attrs.mp).toBe(50);
  });
  it('caps four seas before reducing healing and does not heal a fallen ally', () => {
    const b = battle([debuff]);
    b.unit('ally').level = 50;
    b.unit('beast').level = 100;
    seed(b, 'ally', debuff);
    b.unit('beast').attrs.hp = 0;
    b.unit('beast').flags.downed = true;
    round(b, 'source', art('zebei').skill.id, 'ally');
    expect(b.unit('ally').attrs.hp).toBe(1300);
    expect(b.unit('beast').attrs.hp).toBe(0);
  });
  it('caps stronger revival before reduced healing', () => {
    const b = battle([debuff]);
    const u = b.unit('ally');
    u.level = 50;
    u.attrs.hp = 0;
    u.flags.downed = true;
    seed(b, 'ally', debuff);
    round(b, 'source', art('niming').skill.id, 'ally');
    expect(u.attrs.hp).toBe(500);
  });
  it('mass revival skips forbidden targets and charges self only after revival', () => {
    const ban: StatusDef = {
      id: 'ban',
      kind: 'ban',
      name: '禁复活',
      blocksRevive: true,
      persistWhenDowned: true,
    };
    const b = battle([ban]);
    const source = b.unit('source');
    source.attrs.hp = 5000;
    for (const id of ['ally', 'beast']) {
      b.unit(id).attrs.hp = 0;
      b.unit(id).flags.downed = true;
    }
    seed(b, 'beast', ban);
    b.unit('ally').wound = 2000;
    round(b, 'source', art('due').skill.id, 'ally');
    expect(b.unit('ally').attrs.hp).toBe(9000);
    expect(b.unit('beast').attrs.hp).toBe(0);
    expect(source.attrs.hp).toBe(1000);
    expect(source.attrs.mp).toBe(0);
    expect(source.resources[0].current).toBe(0);
    expect(b.unit('bench').attrs.hp).toBe(1000);
    const events = b.log();
    expect(
      events.findIndex((e) => e.type === EventType.UnitRevived),
    ).toBeLessThan(events.findIndex((e) => e.type === EventType.HpCost));
  });
  it.each(['none', 'banned', 'reject', 'lowHp'] as const)(
    'does not charge mass revival with %s eligibility',
    (reason) => {
      const ban: StatusDef = {
        id: 'ban',
        kind: 'ban',
        name: '禁复活',
        blocksRevive: true,
        persistWhenDowned: true,
      };
      const reject: SkillDef = {
        ...idle,
        id: 'reject',
        tags: [SkillTag.Passive],
        innate: { rejectHpRecovery: true },
      };
      const b = battle([ban], [reject]);
      b.unit('source').attrs.hp = reason === 'lowHp' ? 1000 : 5000;
      if (reason !== 'none') {
        b.unit('ally').attrs.hp = 0;
        b.unit('ally').flags.downed = true;
      }
      if (reason === 'banned') seed(b, 'ally', ban);
      if (reason === 'reject') b.unit('ally').passives.push(reject.id);
      expect(
        b
          .queryCommands('source')
          .skills.find((s) => s.skillId === art('due').skill.id)?.ready,
      ).toBe(false);
      round(b, 'source', art('due').skill.id, 'ally');
      expect(b.unit('source').resources[0].current).toBe(150);
      expect(b.unit('source').attrs.mp).toBe(50);
      expect(b.unit('source').attrs.hp).toBe(reason === 'lowHp' ? 1000 : 5000);
      expect(
        b
          .log()
          .some(
            (e) => e.type === EventType.Hit || e.type === EventType.UnitRevived,
          ),
      ).toBe(false);
    },
  );
  it('pierces defense without applying a wound or debuff', () => {
    const b = battle();
    round(b, 'source', art('dongxu').skill.id, 'enemy');
    expect(b.unit('enemy').wound).toBe(0);
    expect(b.unit('enemy').statuses).toEqual([]);
    expect(art('dongxu').skill.effects).toEqual([
      {
        type: EffectType.PhysicalHit,
        hits: 1,
        resultFactors: [1],
        defenseIgnore: 0.3,
      },
    ]);
  });
  it.each([0, 100, 10000])(
    'drains MP from actual HP loss with barrier %s',
    (shield) => {
      const b = battle();
      const u = b.unit('enemy');
      u.attrs.mp = u.attrs.maxMp = 10000;
      if (shield)
        u.barriers.push({
          id: 'shield',
          name: '护盾',
          kind: 'shield',
          current: shield,
          remainingRounds: 5,
          sourceId: u.id,
          appliedRound: 0,
        });
      round(b, 'source', art('cuiling').skill.id, 'enemy');
      expect(10000 - u.attrs.mp).toBe(1000 - u.attrs.hp);
    },
  );
  it('does not count overkill when draining MP', () => {
    const b = battle();
    const u = b.unit('enemy');
    u.attrs.hp = 10;
    u.attrs.mp = 50;
    round(b, 'source', art('cuiling').skill.id, 'enemy');
    expect(u.attrs.mp).toBe(40);
  });
  it('rolls separately for ordinary and art buffs, skips debuffs and protected states', () => {
    const ordinary: StatusDef = {
      id: 'ordinary',
      kind: 'ordinary',
      name: '普通',
      category: StatusCategory.Buff,
    };
    const protectedBuff: StatusDef = {
      ...ordinary,
      id: 'protected',
      kind: 'protected',
      dispellable: false,
    };
    const defs = [
      ordinary,
      protectedBuff,
      debuff,
      art('hanyue').statusDefs![0],
    ];
    const b = battle(defs);
    for (const id of ['enemy', 'enemy2'])
      for (const def of defs) seed(b, id, def);
    round(b, 'source', art('dangchen').skill.id, 'enemy');
    const rolls = b.log().filter((e) => e.type === EventType.ChanceResolved);
    expect(rolls.map((e) => e.chance)).toEqual([0.2, 0.8, 0.2, 0.8]);
    for (const id of ['enemy', 'enemy2']) {
      expect(b.unit(id).statuses.some((s) => s.id === protectedBuff.id)).toBe(
        true,
      );
      expect(b.unit(id).statuses.some((s) => s.id === debuff.id)).toBe(true);
    }
  });
  it('rechecks revival eligibility after a faster enemy forbids the selected target', () => {
    const ban: StatusDef = {
      id: 'test.ban',
      kind: 'ban',
      name: '禁复活',
      blocksRevive: true,
      persistWhenDowned: true,
    };
    const forbid: SkillDef = {
      id: 'test.forbid',
      name: '封魂',
      tags: [SkillTag.Support],
      targeting: { side: TargetSide.Enemy, includeDowned: true },
      effects: [
        { type: EffectType.ApplyStatus, statusId: ban.id, duration: 3 },
      ],
    };
    const b = battle([ban], [forbid]);
    b.unit('source').attrs.hp = 5000;
    b.unit('enemy').attrs.speed = 200;
    b.unit('ally').attrs.hp = 0;
    b.unit('ally').flags.downed = true;
    expect(
      b
        .queryCommands('source')
        .skills.find((s) => s.skillId === art('due').skill.id)?.ready,
    ).toBe(true);
    for (const u of b.state.units) {
      if (u.flags.benched || u.flags.downed) continue;
      b.submit(u.id, {
        type: CommandType.Skill,
        skillId:
          u.id === 'source'
            ? art('due').skill.id
            : u.id === 'enemy'
              ? forbid.id
              : idle.id,
        targets: [u.id === 'source' || u.id === 'enemy' ? 'ally' : u.id],
      });
    }
    b.lockAndResolve();
    expect(b.unit('source').resources[0].current).toBe(150);
    expect(b.unit('source').attrs.hp).toBe(5000);
    expect(b.unit('source').attrs.mp).toBe(50);
    expect(b.unit('ally').flags.downed).toBe(true);
  });
});
