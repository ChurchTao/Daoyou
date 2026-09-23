import { afterEach, describe, expect, it, vi } from 'vitest';
import { createEmptySectCombatProgressV6 } from '../build-state';
import {
  createBattle,
  effectiveAttrs,
  restoreBattle,
  SeededRng,
  type Command,
  type CreateBattleInput,
} from '../core';
import { DAO_EQUIPMENT_ARTS_V1 } from '../equipment/special-content';
import { createDaoyouRuleset } from '../rules-daoyou';
import { COMBAT_V6_PHASE_6D_VERSIONS as versions } from '../version';
import { compileSectDefinitionV6 } from './compiler';
import { WUXIANG_V6_DEFINITION as definition } from './wuxiang';
import { YOUDU_COMBAT } from './youdu-pack';

const S = (x: string) => `wuxiang.skill.${x}`;
const T = (x: string) => `wuxiang.status.${x}`;
const skill = (x: string, target = 't'): Command => ({
  type: 'skill',
  skillId: S(x),
  targets: [target],
});
function setup(pathName = 'wrath', nodes: string[] = [], pvp = true) {
  const path = definition.paths.find(
    (p) => p.id === `wuxiang.path.${pathName}`,
  )!;
  const selected = nodes.map((id) =>
    path.nodes.find((n) => n.id.endsWith('.' + id))!,
  );
  const last = Math.max(0, ...selected.map((n) => n.layer));
  const chain = Array.from(
    { length: last },
    (_, i) =>
      selected.find((n) => n.layer === i + 1) ??
      path.nodes.find(
        (n) =>
          n.layer === i + 1 &&
          n.slot ===
            (i === 0
              ? selected.find((n) => n.layer === 2)?.slot === 1
                ? 1
                : 3
              : 2),
      )!,
  );
  const progress = createEmptySectCombatProgressV6(
    'wuxiang',
    path.id,
    Object.fromEntries(definition.methods.map((m) => [m.id, 180])),
  );
  progress.meridianDepth = 7;
  progress.meridianLoadouts.find((l) => l.pathId === path.id)!.nodeIds =
    chain.map((n) => n.id);
  const result = compileSectDefinitionV6({
    definition,
    progress,
    characterLevel: 180,
  });
  if (
    !result.ok ||
    result.projection.diagnostics.some(
      (d) => d.code === 'MERIDIAN_CONNECTION_INCOMPLETE',
    )
  )
    throw new Error(JSON.stringify(result));
  const p = result.projection;
  const attrs = {
    hp: 100000,
    maxHp: 100000,
    mp: 100000,
    maxMp: 100000,
    speed: 1000,
    physicalAtk: 1000,
    physicalDef: 300,
    healPower: 100,
    critRate: 0,
  };
  const input: CreateBattleInput = {
    seed: 19,
    versions,
    ruleset: createDaoyouRuleset({
      formulas: {
        physicalHitChance: () => 1,
        fluctuationMin: 1,
        fluctuationMax: 1,
        physicalFluctuationMin: 1,
        physicalFluctuationMax: 1,
      },
    }),
    skills: [...p.skills, ...DAO_EQUIPMENT_ARTS_V1.map((a) => a.skill)],
    statusDefs: [...p.statusDefs, ...YOUDU_COMBAT.statuses],
    units: [
      {
        id: 's',
        name: '无相',
        side: 0,
        kind: 'player',
        level: 180,
        attrs,
        tags: p.unitTags,
        skills: p.activeSkillIds,
        passives: p.passiveSkillIds,
        skillLevels: p.skillLevels,
        skillOverrides: p.skillOverrides,
        resources: [
          ...p.resources,
          { id: 'combat.resource.rage', name: '战意', current: 150, max: 150 },
        ],
      },
      ...['a', 'a1', 'a2', 'a3', 'a4'].map((id, i) => ({
        id,
        name: '队友',
        side: 0 as const,
        kind: 'player' as const,
        level: 180,
        attrs: { ...attrs, speed: 500 - i },
      })),
      ...['t', 't1', 't2', 't3', 't4', 't5'].map((id, i) => ({
        id,
        name: '对手',
        side: 1 as const,
        kind: pvp ? ('player' as const) : ('npc' as const),
        level: 180,
        attrs: { ...attrs, speed: 10 - i },
      })),
    ],
  };
  return { b: createBattle(input), input, p };
}
type Battle = ReturnType<typeof setup>['b'];
function round(b: Battle, commands: Record<string, Command> = {}) {
  for (const u of b.state.units)
    if (!u.flags.downed && !u.flags.dead && !u.flags.benched)
      b.submit(u.id, commands[u.id] ?? { type: 'defend' });
  b.lockAndResolve();
}
const status = (b: Battle, u: string, name: string) =>
  b.unit(u).statuses.find((s) => s.id === T(name));
const form = (b: Battle) =>
  b.unit('s').statuses.find((s) => s.kind === 'wuxiang.form');
const thought = (b: Battle, name: string) =>
  b.unit('s').resources.find((r) => r.id === 'wuxiang.resource.' + name)!;
const damage = (b: Battle) =>
  b
    .log()
    .flatMap((e) =>
      e.type === 'damage' && e.sourceId === 's' ? [e.amount] : [],
    );
const heal = (b: Battle, id: string) =>
  b
    .log()
    .flatMap((e) =>
      e.type === 'heal' && e.sourceId === 's' && e.targetId === id
        ? [e.amount]
        : [],
    );
function enter(b: Battle, fierce: number) {
  thought(b, 'fierce').current = fierce;
  thought(b, 'still').current = 3 - fierce;
  round(b);
}
afterEach(() => vi.restoreAllMocks());

describe('无相化相循环与经脉结算', () => {
  it.each([
    [3, 3, 'demon'],
    [2, 4, 'demon'],
    [1, 5, 'buddha'],
    [0, 8, 'buddha'],
  ] as const)(
    '四构成 %i 烈持续 %i，回合末入相且快照保持',
    (a, duration, name) => {
      const { b, input } = setup();
      enter(b, a);
      expect(form(b)).toMatchObject({ id: T(name), remainingRounds: duration });
      const copy = restoreBattle(input, b.snapshot(), [...b.log()]);
      round(b);
      round(copy);
      expect(copy.snapshot()).toEqual(b.snapshot());
      for (let i = 1; i < duration; i++) round(b);
      expect(form(b)).toBeUndefined();
      expect(b.unit('s').combatFacts?.['wuxiang_done' + a]).toBe(1);
      expect(thought(b, 'fierce').current + thought(b, 'still').current).toBe(
        0,
      );
    },
  );
  it('满血治疗仍产寂念，群攻只产一烈；第三念当回合不会预先强化', () => {
    const { b } = setup();
    round(b, { s: skill('nectar', 'a') });
    expect(thought(b, 'still').current).toBe(1);
    round(b, { s: skill('stars') });
    expect(thought(b, 'fierce').current).toBe(1);
    expect(damage(b)).toHaveLength(3);
    round(b, { s: skill('strike') });
    expect(form(b)).toMatchObject({ remainingRounds: 4 });
    round(b, { s: skill('nectar', 'a') });
    expect(thought(b, 'still').current).toBe(1);
  });
  it('破锋只在非玩家战斗开场三烈，不计正常圆融；先机每次显相仅加速下一回合', () => {
    const pvp = setup('wrath', ['1.2']).b;
    expect(form(pvp)).toBeUndefined();
    const pve = setup('wrath', ['1.2'], false).b;
    expect(form(pve)).toBeDefined();
    round(pve);
    round(pve);
    round(pve);
    expect(pve.unit('s').combatFacts?.wuxiang_done3 ?? 0).toBe(0);
    const b = setup('wrath', ['2.3']).b;
    enter(b, 2);
    expect(status(b, 's', 'initiative')?.speedMod).toBe(150);
    round(b);
    expect(status(b, 's', 'initiative')).toBeUndefined();
  });
  it('回转交换构成，念转相生补多数一念；显相时禁止回转且不扣费', () => {
    const b = setup('wrath', ['5.3']).b;
    thought(b, 'still').current = 2;
    round(b, { s: skill('turn', 's') });
    expect(form(b)?.id).toBe(T('demon'));
    const mp = b.unit('s').attrs.mp;
    round(b, { s: skill('turn', 's') });
    expect(b.unit('s').attrs.mp).toBe(mp);
  });
  it('破绽归属隔离，命中护盾也消耗；同招新破绽不会立刻击破', () => {
    const b = setup('wrath', ['2.1']).b;
    b.applyStatus('t', T('breach'), 5, 'a');
    vi.spyOn(SeededRng.prototype, 'chance').mockImplementation((p) => p > 0);
    round(b, { s: skill('strike') });
    expect(
      b.unit('t').statuses.filter((s) => s.kind === 'wuxiang.breach'),
    ).toHaveLength(2);
    b.unit('t').barriers.push({
      id: 'shield',
      name: '盾',
      kind: 'shield',
      current: 50000,
      max: 50000,
      remainingRounds: 5,
      appliedRound: b.state.round,
    });
    round(b, { s: skill('strike') });
    expect(
      b
        .unit('t')
        .statuses.filter((s) => s.kind === 'wuxiang.breach')
        .map((s) => s.sourceId),
    ).toEqual(['a']);
  });
  it('破妄目标随等级及玩家战斗区分；蓄势确实增加4回合冷却', () => {
    const pve = setup('wrath', [], false).b;
    round(pve, { s: skill('pierce') });
    expect(damage(pve)).toHaveLength(3);
    const pvp = setup().b;
    round(pvp, { s: skill('pierce') });
    expect(damage(pvp)).toHaveLength(1);
    const b = setup('compassion', ['4.1']).b;
    round(b, { s: skill('pierce') });
    expect(damage(b)[0]).toBe(damage(pvp)[0] * 2);
    expect(b.unit('s').cooldowns?.[S('pierce')]).toBe(5);
    expect(
      b.queryCommands('s').skills.find((s) => s.skillId === S('pierce'))
        ?.reasons,
    ).toContain('cooldown');
  });
  it('本愿额外照拂去重，普通目标重合才增效，其他施术者印记不吃联动', () => {
    const b = setup('compassion').b;
    for (const u of b.state.units.filter((u) => u.side === 0))
      u.attrs.hp = 1000;
    round(b, { s: skill('vow', 'a4') });
    b.applyStatus('a3', T('vow'), 1, 'a');
    round(b, { s: skill('nectar', 'a') });
    expect(heal(b, 'a')).toEqual([520]);
    expect(heal(b, 'a4')).toEqual([520, 200]);
    expect(heal(b, 'a3')).toEqual([]);
    round(b, { s: skill('nectar', 'a4') });
    expect(heal(b, 'a4').slice(-2)).toEqual([780, 200]);
    round(b, { s: skill('vow', 'a1') });
    expect(status(b, 'a4', 'vow')).toBeUndefined();
    expect(status(b, 'a3', 'vow')?.sourceId).toBe('a');
  });
  it('护生／破障按施术者快照计算，只持续当前回合；安抚包含增减伤愿法', () => {
    const b = setup('compassion', ['2.1']).b;
    b.unit('a').kind = 'pet';
    let snapshot = 0;
    b.hooks.on('afterAction', (h) => {
      if (h.source?.id === 's')
        snapshot = status(b, 'a', 'ward')?.snapshotModifiers?.[0]
          .allDamageTakenBonus as number;
    });
    round(b, { s: skill('ward', 'a') });
    expect(snapshot).toBe(-0.25);
    expect(status(b, 'a', 'ward')).toBeUndefined();
  });
  it('愿归一心只收拢增减伤愿法，甘露仍扩目标且护生不超过80%', () => {
    const b = setup('compassion', ['2.3']).b;
    b.unit('s').attrs.healPower = 10000;
    enter(b, 3);
    let count = 0,
      reduction = 0;
    b.hooks.on('afterAction', (h) => {
      if (h.source?.id === 's') {
        count = b.state.units.filter((u) => status(b, u.id, 'ward')).length;
        reduction = status(b, 'a', 'ward')?.snapshotModifiers?.[0]
          .allDamageTakenBonus as number;
      }
    });
    round(b, { s: skill('ward', 'a') });
    expect(count).toBe(1);
    expect(reduction).toBe(-0.8);
    for (const u of b.state.units.filter((u) => u.side === 0))
      u.attrs.hp = 1000;
    round(b, { s: skill('nectar', 'a') });
    expect(
      b.log().filter((e) => e.type === 'heal' && e.sourceId === 's'),
    ).toHaveLength(4);
  });
  it('腰带局部增幅只在队伍唯一无相时生效，含法术易伤代价', () => {
    const b = setup('wrath', ['5.2']).b;
    b.unit('s').combatFacts = { beltMaxHp: 100, beltPhysicalDef: 50 };
    enter(b, 2);
    expect(effectiveAttrs(b.unit('s')).maxHp).toBe(100040);
    expect(b.unit('s').attrs.maxHp).toBe(100040);
    expect(effectiveAttrs(b.unit('s')).physicalDef).toBe(310);
    expect(
      form(b)?.snapshotModifiers?.find((m) => m.when?.requireKind === 'spell')
        ?.damageTakenBonus,
    ).toBe(0.2);
    const c = setup('wrath', ['5.2']).b;
    c.unit('s').combatFacts = { beltMaxHp: 100 };
    c.unit('a').tags.push('sect.wuxiang');
    enter(c, 3);
    expect(effectiveAttrs(c.unit('s')).maxHp).toBe(100000);
  });
  it('装备特技才获念／返战意，普通技能不返还', () => {
    const b = setup('wrath', ['6.2']).b;
    enter(b, 3);
    b.unit('s').skills.push('dao_equipment.skill.diefeng');
    round(b, {
      s: {
        type: 'skill',
        skillId: 'dao_equipment.skill.diefeng',
        targets: ['t'],
      },
    });
    expect(
      b.unit('s').resources.find((r) => r.id === 'combat.resource.rage')
        ?.current,
    ).toBe(130);
  });
  it('解缚逐次扣30战意，拘灵未解除不复活，基础复活不越过拘灵', () => {
    const b = setup('compassion', ['6.3']).b;
    b.unit('a').attrs.hp = 0;
    b.unit('a').flags.downed = true;
    b.applyStatus('a', 'youdu.status.soul_seal', 2, 't');
    round(b, { s: skill('unbind', 'a') });
    expect(b.unit('a').flags.downed).toBe(true);
    expect(
      b.unit('s').resources.find((r) => r.id === 'combat.resource.rage')
        ?.current,
    ).toBe(120);
    round(b, { s: skill('unbind', 'a') });
    expect(b.unit('a').flags.downed).toBe(false);
    expect(
      b.unit('s').resources.find((r) => r.id === 'combat.resource.rage')
        ?.current,
    ).toBe(90);
    expect(b.unit('s').skills).not.toContain(S('revive'));
    const base = setup('compassion').b;
    base.unit('a').attrs.hp = 0;
    base.unit('a').flags.downed = true;
    base.applyStatus('a', 'youdu.status.soul_seal', 3, 't');
    round(base, { s: skill('revive', 'a') });
    expect(base.unit('a').flags.downed).toBe(true);
    const short = setup('compassion', ['6.3']).b;
    short.unit('a').attrs.hp = 0;
    short.unit('a').flags.downed = true;
    short.applyStatus('a', 'youdu.status.soul_seal', 3, 't');
    short
      .unit('s')
      .resources.find((r) => r.id === 'combat.resource.rage')!.current = 29;
    const mp = short.unit('s').attrs.mp;
    round(short, { s: skill('unbind', 'a') });
    expect(short.unit('s').attrs.mp).toBe(mp);
    expect(
      short.unit('a').statuses.find((s) => s.kind === 'youdu.soul_seal')
        ?.remainingRounds,
    ).toBe(3);
  });
  it('三寂护命只救致死瞬间，法相破损不留念、不计圆融；锻铁放开构成', () => {
    for (const [nodes, fierce] of [
      [[], 0],
      [['3.3'], 3],
    ] as [string[], number][]) {
      const b = setup('wrath', nodes).b;
      enter(b, fierce);
      b.unit('s').attrs.hp = 1;
      round(b, { t: { type: 'attack', target: 's' } });
      expect(b.unit('s').flags.downed).toBe(false);
      expect(b.unit('s').attrs.hp).toBeGreaterThan(1);
      expect(form(b)).toBeUndefined();
      expect(b.unit('s').combatFacts?.['wuxiang_done' + fierce] ?? 0).toBe(0);
    }
    const b = setup().b;
    enter(b, 3);
    b.unit('s').attrs.hp = 1;
    round(b, { t: { type: 'attack', target: 's' } });
    expect(b.unit('s').flags.downed).toBe(true);
    expect(form(b)).toBeUndefined();
  });
  it('净业仅免疫实际驱散的同类异常，回合末退相；次回合可重新附加', () => {
    const b = setup('compassion', ['7.2']).b;
    for (let i = 0; i < 4; i++) round(b);
    enter(b, 0);
    b.applyStatus('a', 'youdu.status.poison', 3, 't');
    b.hooks.on('afterAction', (h) => {
      if (h.source?.id === 's') {
        b.applyStatus('a', 'youdu.status.poison', 3, 't');
        expect(
          b.unit('a').statuses.some((s) => s.id === 'youdu.status.poison'),
        ).toBe(false);
      }
    });
    round(b, { s: skill('cleanse', 'a') });
    expect(form(b)).toBeUndefined();
    b.applyStatus('a', 'youdu.status.poison', 3, 't');
    expect(
      b.unit('a').statuses.some((s) => s.id === 'youdu.status.poison'),
    ).toBe(true);
  });
});

describe('无相经脉条件与代价', () => {
  it('余念只留一枚多数念头；三种强制退相均不计正常圆融', () => {
    const b = setup('wrath', ['1.1']).b;
    vi.spyOn(SeededRng.prototype, 'chance').mockImplementation((p) => p > 0);
    enter(b, 1);
    for (let i = 0; i < 5; i++) round(b);
    expect(thought(b, 'still').current).toBe(1);
    expect(thought(b, 'fierce').current).toBe(0);
    const dead = setup('wrath', ['1.1']).b;
    enter(dead, 3);
    dead.unit('s').attrs.hp = 1;
    round(dead, { t: { type: 'attack', target: 's' } });
    expect(
      thought(dead, 'fierce').current + thought(dead, 'still').current,
    ).toBe(0);
  });
  it('神迹逐个检查人物自己的召唤灵出战历史；风劫只在风行武器触发', () => {
    const b = setup('wrath', ['4.2']).b;
    b.unit('t1').kind = 'pet';
    b.unit('t1').ownerId = 't';
    b.unit('t1').flags.benched = true;
    b.unit('t1').marks.push('battle:deployed');
    vi.spyOn(SeededRng.prototype, 'chance').mockImplementation((p) => p > 0);
    round(b);
    expect(status(b, 't', 'breach')).toBeDefined();
    expect(status(b, 't2', 'breach')).toBeUndefined();
    const standing = setup('wrath', ['4.2']).b;
    standing.unit('t1').kind = 'pet';
    standing.unit('t1').ownerId = 't';
    standing.unit('t1').marks.push('battle:deployed');
    round(standing);
    expect(status(standing, 't', 'breach')).toBeUndefined();
    const wind = setup('wrath', ['4.3']).b;
    wind.unit('s').combatFacts = { wuxiang_wind_weapon: 1 };
    round(wind, { s: skill('stars') });
    expect(damage(wind)).toHaveLength(4);
    const calm = setup('wrath', ['4.3']).b;
    round(calm, { s: skill('stars') });
    expect(damage(calm)).toHaveLength(3);
  });
  it('魔威加命中属性而非概率；猎灵、暴烈仅强化指定攻击', () => {
    const { b, input } = setup('wrath', ['5.1']);
    let hit = 0;
    input.ruleset.formulas.physicalHitChance = (source) => {
      hit = source.attrs.hit;
      return 1;
    };
    round(b, { s: skill('strike') });
    expect(hit).toBe(b.unit('s').attrs.hit + 360);
    round(b, { s: { type: 'attack', target: 't' } });
    expect(hit).toBe(b.unit('s').attrs.hit);
    const base = setup().b,
      hunt = setup('wrath', ['2.2']).b;
    for (const x of [base, hunt]) {
      x.unit('t').kind = 'pet';
      round(x, { s: skill('strike') });
    }
    expect(damage(hunt)[0]).toBe(Math.floor(damage(base)[0] * 1.3));
    const artBase = setup().b,
      artNode = setup('wrath', ['4.1']).b;
    for (const x of [artBase, artNode]) {
      x.unit('s').skills.push('dao_equipment.skill.cuiling');
      round(x, {
        s: {
          type: 'skill',
          skillId: 'dao_equipment.skill.cuiling',
          targets: ['t'],
        },
      });
    }
    expect(damage(artNode)[0]).toBe(Math.floor(damage(artBase)[0] * 1.2));
  });
  it('灵悟只在本相装备特技后产念，36%失败时不产；不把普通治疗当特技', () => {
    const b = setup('wrath', ['3.1']).b;
    b.unit('s').skills.push('dao_equipment.skill.diefeng');
    thought(b, 'still').current = 1;
    vi.spyOn(SeededRng.prototype, 'chance').mockImplementation((p) => p > 0);
    round(b, {
      s: {
        type: 'skill',
        skillId: 'dao_equipment.skill.diefeng',
        targets: ['t'],
      },
    });
    expect(thought(b, 'still').current).toBe(2);
    round(b, { s: skill('nectar', 'a') });
    expect(form(b)?.id).toBe(T('buddha'));
    expect(thought(b, 'still').current).toBe(3);
    const c = setup('wrath', ['3.1']).b;
    c.unit('s').skills.push('dao_equipment.skill.diefeng');
    vi.spyOn(SeededRng.prototype, 'chance').mockImplementation((p) => p >= 1);
    round(c, {
      s: {
        type: 'skill',
        skillId: 'dao_equipment.skill.diefeng',
        targets: ['t'],
      },
    });
    expect(thought(c, 'still').current + thought(c, 'fierce').current).toBe(0);
  });
  it('返照本相疗伤，入相重置冷却；显相延长一回合', () => {
    const b = setup().b;
    b.unit('s').attrs.hp = 1000;
    b.unit('s').wound = 1000;
    round(b, { s: skill('restore', 's') });
    expect(b.unit('s').wound).toBe(640);
    enter(b, 2);
    expect(b.unit('s').cooldowns?.[S('restore')]).toBeLessThanOrEqual(
      b.state.round,
    );
    const remaining = form(b)!.remainingRounds;
    round(b, { s: skill('restore', 's') });
    expect(form(b)?.remainingRounds).toBe(remaining);
  });
  it('永动必须记录四种完整自然循环，之后仅三烈延时', () => {
    const b = setup('wrath', ['6.3']).b;
    for (const a of [0, 1, 2, 3]) {
      enter(b, a);
      const turns = form(b)!.remainingRounds;
      for (let i = 0; i < turns; i++) round(b);
    }
    expect(
      [0, 1, 2, 3].map((a) => b.unit('s').combatFacts?.['wuxiang_done' + a]),
    ).toEqual([1, 1, 1, 1]);
    enter(b, 3);
    expect(form(b)?.remainingRounds).toBe(6);
  });
  it('慧眼无道具依赖，观照生慧使用人物等级；众生安住只在全队无人倒地时累积', () => {
    const b = setup('compassion', ['5.1']).b;
    b.unit('a').wound = 500;
    round(b, { s: skill('insight', 'a') });
    expect(b.unit('a').wound).toBe(140);
    expect(status(b, 'a', 'insight')?.attrMods.healPower).toBe(90);
    expect(status(b, 's', 'insight_self')?.attrMods.healPower).toBe(180);
    expect(b.unit('s').combatFacts?.wuxiang_resist).toBe(2);
    b.unit('a').flags.downed = true;
    b.unit('a').attrs.hp = 0;
    round(b);
    expect(b.unit('s').combatFacts?.wuxiang_resist).toBe(2);
  });
  it('本愿深结只将独立印记治疗翻倍；危中自渡也增强别人给予自己的护生愿', () => {
    const b = setup('compassion', ['2.2']).b;
    b.unit('a').attrs.hp = 1000;
    round(b, { s: skill('vow', 'a') });
    round(b, { s: skill('nectar', 'a') });
    expect(heal(b, 'a')).toEqual([546, 400]);
    const c = setup('compassion', ['3.1']).b;
    c.unit('s').attrs.hp = 1000;
    c.unit('a').skills.push(S('ward'));
    let reduced = 0;
    c.hooks.on('afterAction', (h) => {
      if (h.source?.id === 'a')
        reduced = status(c, 's', 'ward')?.snapshotModifiers?.[0]
          .allDamageTakenBonus as number;
    });
    round(c, { a: skill('ward', 's') });
    expect(reduced).toBe(-0.25);
  });
  it('济世独行判断治疗流派角色，非治疗队友有回血技能不影响唯一性', () => {
    const alone = setup('compassion', ['3.2']).b,
      duo = setup('compassion', ['3.2']).b;
    for (const b of [alone, duo]) {
      b.unit('a').attrs.hp = 1000;
      b.unit('a').skills.push(S('nectar'));
      enter(b, 0);
    }
    duo.unit('a').tags.push('role.healer');
    round(alone, { s: skill('nectar', 'a') });
    round(duo, { s: skill('nectar', 'a') });
    expect(heal(alone, 'a')[0]).toBeGreaterThan(heal(duo, 'a')[0]);
  });
  it.each([true, false])(
    '魔临两式共用初始冷却；未击倒时回合末过载退相（摧岳式=%s）',
    (single) => {
      const b = setup('wrath', ['7.2']).b;
      expect(b.unit('s').cooldowns?.[S('overload')]).toBe(3);
      round(b);
      enter(b, 3);
      vi.spyOn(SeededRng.prototype, 'chance').mockImplementation((p) =>
        p === 0.5 ? single : p >= 1,
      );
      round(b, { s: skill('overload') });
      expect(damage(b)).toHaveLength(single ? 1 : 6);
      expect(form(b)).toBeUndefined();
      expect(b.unit('s').combatFacts?.wuxiang_done3 ?? 0).toBe(0);
    },
  );
  it('魔临摧岳击倒延长法相并免去本次过载退出，不将总伤害翻倍', () => {
    const b = setup('wrath', ['7.2']).b;
    round(b);
    enter(b, 3);
    b.unit('t').attrs.hp = 1;
    vi.spyOn(SeededRng.prototype, 'chance').mockImplementation(
      (p) => p === 0.5 || p >= 1,
    );
    round(b, { s: skill('overload') });
    expect(form(b)?.remainingRounds).toBe(3);
    expect(b.unit('s').combatFacts?.wuxiang_overload).toBe(0);
  });
  it('1%门派减伤覆盖毒跳伤；护生愿也覆盖本回合的持续伤害', () => {
    const base = setup('compassion').b,
      ward = setup('compassion').b;
    for (const b of [base, ward]) {
      b.applyStatus('s', 'youdu.status.poison', 3, 't');
      b
        .unit('s')
        .statuses.find((s) => s.id === 'youdu.status.poison')!.tickSkillLevel =
        180;
    }
    round(base);
    round(ward, { s: skill('ward', 's') });
    const get = (b: Battle) =>
      b
        .log()
        .flatMap((e) =>
          e.type === 'damage' && e.targetId === 's' ? [e.amount] : [],
        )
        .at(-1)!;
    expect(get(ward)).toBeLessThan(get(base));
    expect(base.unit('s').attrs.hp).toBe(100000 - get(base));
  });
});

it('多段攻击刚附加的破绽留到下一次动作；已有破绽只放大第一击', () => {
  const { b, input } = setup();
  const original = input.skills!.find((s) => s.id === S('strike'))!;
  b.unit('s').skillOverrides[S('strike')] = {
    ...original,
    effects: [{ type: 'physicalHit', coeff: 1, hits: 3 }],
  };
  vi.spyOn(SeededRng.prototype, 'chance').mockImplementation((p) => p > 0);
  round(b, { s: skill('strike') });
  expect(new Set(damage(b)).size).toBe(1);
  expect(status(b, 't', 'breach')).toBeDefined();
  round(b, { s: skill('strike') });
  const hits = damage(b).slice(-3);
  expect(hits[0]).toBeGreaterThan(hits[1]);
  expect(hits[1]).toBe(hits[2]);
  expect(status(b, 't', 'breach')).toBeUndefined();
});

it('众生安住的封抗累积进入实际封印公式，不能只显示在面板', () => {
  const { b, input } = setup('compassion', ['4.2']);
  let sealResist = -1;
  input.ruleset.formulas.sealHitChance = (_source, target) => { sealResist = target.attrs.sealResist; return 0; };
  b.unit('t').skills.push('test.seal');
  b.unit('t').skillOverrides['test.seal'] = { id: 'test.seal', name: '封印', tags: ['spell'], targeting: { side: 'enemy' }, effects: [{ type: 'applyStatus', statusId: 'youdu.status.soul_seal', duration: 3, hit: 'seal' }] };
  round(b); round(b, { t: { type: 'skill', skillId: 'test.seal', targets: ['s'] } });
  expect(sealResist).toBe(2);
});
