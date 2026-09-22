import { describe, expect, it } from 'vitest';
import { createBattle, restoreBattle, type Command, type LineupUnit, type SkillDef } from '../core';
import { effectiveSpeed, healTakenFactor } from '../core/units';
import { createDaoyouRuleset } from '../rules-daoyou';
import { COMBAT_V6_PHASE_6D_VERSIONS as versions } from '../version';
import { createEmptySectCombatProgressV6 } from '../build-state';
import { compileSectDefinitionV6 } from './compiler';
import { LINGXIAO_V6_DEFINITION } from './lingxiao';
// 单独验证节点机制，不让前置节点的战斗效果干扰数值断言。
const definition = structuredClone(LINGXIAO_V6_DEFINITION);
for (const path of definition.paths) path.requiresConnectedNodes = false;

const S = (id: string) => `lingxiao.skill.${id}`;
const T = (id: string) => `lingxiao.status.${id}`;
const R = (id = 'sword_intent') => `lingxiao.resource.${id}`;
const ruleset = { ...createDaoyouRuleset({ formulas: {
  physicalHitChance: () => 1, fluctuationMin: 1, fluctuationMax: 1, defendPhysicalFactor: 1,
  baseDamage: ({ source, target, coeff, power }) => Math.max(1, (source.attrs.physicalAtk - target.attrs.physicalDef) * coeff + power),
} }), deferredPlayerCommands: true };
function projection(path: 'guiyi' | 'zhanchen', nodes: string[] = [], depth = 6) {
  const progress = createEmptySectCombatProgressV6('lingxiao', `lingxiao.path.${path}`, Object.fromEntries(definition.methods.map(m => [m.id, 180])));
  progress.meridianDepth = depth as 6;
  progress.meridianLoadouts.find(l => l.pathId === progress.activePathId)!.nodeIds = nodes.map(n => `lingxiao.node.${path}.${n}`);
  const result = compileSectDefinitionV6({ definition, progress, characterLevel: 180 });
  if (!result.ok) throw new Error(JSON.stringify(result.diagnostics));
  return result.projection;
}
function setup(path: 'guiyi' | 'zhanchen' = 'guiyi', nodes: string[] = [], extras: SkillDef[] = [], enemyKind: 'player' | 'npc' = 'player') {
  const p = projection(path, nodes, nodes.some(n => n.startsWith('7.')) ? 7 : 6);
  const source: LineupUnit = { id: 's', name: '剑修', kind: 'player', side: 0, level: 180,
    attrs: { hp: 10000, mp: 10000, speed: 100, physicalAtk: 1000, physicalDef: 0 },
    skills: [...p.activeSkillIds, ...extras.map(s => s.id)], passives: p.passiveSkillIds, skillLevels: p.skillLevels,
    skillOverrides: p.skillOverrides, tags: p.unitTags, resources: [...p.resources, { id: 'combat.resource.rage', name: '战意', current: 0, max: 150 }] };
  const input = { seed: 12, versions, ruleset, skills: [...p.skills, ...extras], statusDefs: p.statusDefs,
    units: [source, { id: 'ally', name: '队友', kind: 'player' as const, side: 0 as const, attrs: { hp: 10000, speed: 1, physicalAtk: 1000, physicalDef: 0 } },
      ...Array.from({ length: 6 }, (_, i): LineupUnit => ({ id: `t${i}`, name: '敌人', kind: enemyKind, side: 1, attrs: { hp: 100000, speed: 1, physicalAtk: 0, physicalDef: 100 } })),
      { id: 'pet', name: '召唤灵', kind: 'pet' as const, ownerId: 't0', side: 1 as const, attrs: { hp: 100000, speed: 1, physicalAtk: 0, physicalDef: 0 } }] };
  return { b: createBattle(input), input };
}
type Battle = ReturnType<typeof setup>['b'];
function round(b: Battle, command: Command = { type: 'defend' }, other: Record<string, Command> = {}) {
  for (const u of b.state.units) if (!u.flags.dead && !u.flags.downed) b.submit(u.id, u.id === 's' ? command : other[u.id] ?? { type: 'defend' });
  b.lockAndResolve();
}
const cast = (name: string, target = 't0'): Command => ({ type: 'skill', skillId: S(name), targets: [target] });
const attack: Command = { type: 'attack', target: 't0' };
const damage = (b: Battle, id = 't0') => b.log().filter(e => e.type === 'damage' && e.sourceId === 's' && e.targetId === id).map(e => e.type === 'damage' ? e.amount : 0);
const resource = (b: Battle, id = 'sword_intent') => b.unit('s').resources.find(r => r.id === R(id))!;
function ready(b: Battle) { b.unit('s').attrs.hp = 10000; b.unit('s').flags.skipNextAction = false; b.unit('s').statuses = b.unit('s').statuses.filter(s => s.id !== T('recovery')); }

describe('无双流派基础能力和剑意门槛', () => {
  it('三扫只加一层，惊鸿和临渊不加；26层仍能继续累计，失败不加', () => {
    const { b } = setup();
    round(b, cast('triple')); expect(resource(b).current).toBe(1);
    expect(b.log()).toContainEqual(expect.objectContaining({ type: 'chanceResolved', branchId: S('triple') + '.recovery', chance: 0.01 }));
    ready(b); round(b, cast('shadow_strike')); expect(resource(b).current).toBe(1);
    b.unit('s').attrs.hp = 4000; round(b, cast('formation')); expect(resource(b).current).toBe(1);
    ready(b); resource(b).current = 26; round(b, cast('triple')); expect(resource(b).current).toBe(27);
    ready(b); b.unit('s').attrs.hp = 5000; round(b, cast('triple')); expect(resource(b).current).toBe(27);
  });
  it('剑意倒地保留、复起继承，快照恢复仍无上限', () => {
    const kill: SkillDef = { id: 'kill', name: '击倒', tags: [], targeting: { side: 'enemy' }, effects: [{ type: 'fixedHit', power: 100000 }] };
    const revive: SkillDef = { id: 'revive', name: '复起', tags: [], targeting: { side: 'ally', includeDowned: true }, effects: [{ type: 'revive', hpRatio: 1 }] };
    const { b, input } = setup('guiyi', [], [kill, revive]); resource(b).current = 26;
    b.unit('t0').skills = ['kill']; round(b, { type: 'defend' }, { t0: { type: 'skill', skillId: 'kill', targets: ['s'] } });
    expect(b.unit('s').flags.downed).toBe(true); expect(resource(b).current).toBe(26);
    const restored = restoreBattle(input, JSON.parse(JSON.stringify(b.snapshot())), [...b.log()]);
    for (const session of [b, restored]) { session.unit('ally').skills = ['revive']; round(session, { type: 'defend' }, { ally: { type: 'skill', skillId: 'revive', targets: ['s'] } }); round(session, cast('triple')); }
    expect(resource(b).current).toBe(27); expect(restored.snapshot()).toEqual(b.snapshot()); expect(restored.log()).toEqual(b.log());
  });
  it('5层基础5%和连斩每层1.5%相加，不依赖破军', () => {
    const { b } = setup('guiyi', ['6.2']); resource(b).current = 10; round(b, attack);
    expect(damage(b)).toEqual([1080]);
  });
  it.each([[10, 0], [11, 3], [17, 4]] as const)('%i层破军溅射%i人，保护只在11层前生效', (layers, count) => {
    const { b } = setup('guiyi', ['7.2']); resource(b).current = layers;
    round(b, cast('triple'), { t1: { type: 'protect', target: 't0' } });
    const protection = b.log().filter(e => e.type === 'protectTrigger');
    expect(protection.length > 0).toBe(layers < 11);
    if (count) {
      const dealt = b.log().filter(e => e.type === 'damage' && e.sourceId === 's');
      expect(dealt).toHaveLength(3 * (1 + count));
      expect(new Set(dealt.map(e => e.type === 'damage' ? e.targetId : ''))).toHaveLength(1 + count);
      const first = damage(b)[0];
      expect(dealt.slice(1, 1 + count)).toEqual(Array.from({ length: count }, () => expect.objectContaining({ amount: Math.floor(first * .45) })));
    }
  });
  it('23层只豁免禁复活，不能自动复活；查询和施法一致', () => {
    const revive: SkillDef = { id: 'revive', name: '复起', tags: [], targeting: { side: 'ally', onlyDowned: true, includeDowned: true, requireRevivable: true }, effects: [{ type: 'revive', hpRatio: .5 }] };
    const { input } = setup('guiyi', ['7.2'], [revive]);
    const b = createBattle({ ...input, statusDefs: [...input.statusDefs, { id: 'ban', name: '禁复活', kind: 'ban', blocksRevive: true, persistWhenDowned: true }] });
    b.applyStatus('s', 'ban', 10); b.unit('s').flags.downed = true; b.unit('s').attrs.hp = 0; b.unit('ally').skills = ['revive']; resource(b).current = 22;
    expect(b.queryCommands('ally').skills[0].selectableTargetIds).not.toContain('s');
    resource(b).current = 23; expect(b.unit('s').flags.downed).toBe(true);
    expect(b.queryCommands('ally').skills[0].selectableTargetIds).toContain('s');
    round(b, { type: 'defend' }, { ally: { type: 'skill', skillId: 'revive', targets: ['s'] } }); expect(b.unit('s').attrs.hp).toBe(5000);
  });
  it('勇进仅PVP首次成功断尘必连破；熟练基础合计18%', () => {
    const { b } = setup('guiyi', ['1.2']); round(b, cast('triple'));
    expect(b.unit('s').flags.skipNextAction).toBe(false); expect(b.unit('s').statuses.some(s => s.id === T('recovery'))).toBe(false);
    round(b, cast('triple')); expect(b.log().filter(e => e.type === 'chanceResolved').at(-1)).toMatchObject({ chance: .01 });
    const c = setup('guiyi', ['6.3']).b; round(c, cast('triple'));
    expect(c.log().filter(e => e.type === 'chanceResolved').at(-1)?.chance).toBeCloseTo(.18);
    const npc = setup('guiyi', ['1.2'], [], 'npc').b; round(npc, cast('triple'));
    expect(npc.log().filter(e => e.type === 'chanceResolved').at(-1)).toMatchObject({ chance: .01 });
  });
});

describe('经典技能强化与代价', () => {
  it('惊鸿基础为普攻、50法力、6回合冷却，仅下一回合加速15%', () => {
    const { b } = setup('zhanchen'); round(b, cast('shadow_strike'));
    expect(damage(b)).toEqual([900]); expect(b.unit('s').attrs.mp).toBe(9950); expect(effectiveSpeed(b.unit('s'))).toBe(115);
    expect(b.queryCommands('s').skills.find(s => s.skillId === S('shadow_strike'))!.reasons).toContain('cooldown');
    round(b); expect(effectiveSpeed(b.unit('s'))).toBe(100);
    while (b.state.round < 7) round(b);
    expect(b.queryCommands('s').skills.find(s => s.skillId === S('shadow_strike'))!.ready).toBe(true);
  });
  it('翩鸿击倒不进入冷却，无双伤害按当前剑意强化', () => {
    const { b } = setup('guiyi', ['2.1']); resource(b).current = 4; b.unit('t0').attrs.hp = 1;
    round(b, cast('shadow_strike'));
    expect(damage(b)).toEqual([1395]); expect(b.unit('s').cooldowns?.[S('shadow_strike')]).toBeUndefined(); expect(resource(b).current).toBe(4);
  });
  it('长驱替换惊鸿，110%伤害结果，无视保护', () => {
    const { b } = setup('zhanchen', ['2.3']);
    expect(b.unit('s').skills).not.toContain(S('shadow_strike'));
    round(b, cast('zhanchen_long_drive'), { t1: { type: 'protect', target: 't0' } });
    expect(damage(b)).toEqual([990]); expect(b.log().some(e => e.type === 'protectTrigger')).toBe(false);
  });
  it('无敌保留前三段，第四段为1.10', () => {
    const { b } = setup('zhanchen', ['7.2']); round(b, cast('triple'));
    expect(damage(b)).toEqual([675, 765, 855, 990]); expect(b.unit('s').flags.skipNextAction).toBe(true);
  });
  it('勇武改为回血和10战意，后发附加防御结果并仅对施法者易伤', () => {
    const { b } = setup('zhanchen', ['2.2']); b.unit('s').attrs.hp = 5000;
    round(b, cast('waiting')); expect(b.unit('s').attrs.hp).toBe(6440); expect(b.unit('s').resources.find(r => r.id === 'combat.resource.rage')!.current).toBe(10);
    round(b); expect(damage(b)).toEqual([1120]);
    round(b, attack, { ally: attack }); expect(damage(b).at(-1)).toBe(990);
    expect(b.log().filter(e => e.type === 'damage' && e.sourceId === 'ally').at(-1)).toMatchObject({ amount: 900 });
  });
  it('乘势取消血线和耗血，追击复制每段至召唤灵，未击倒即消费', () => {
    const { b } = setup('zhanchen', ['4.3']); round(b, cast('pursuit', 's')); b.unit('s').attrs.hp = 100;
    expect(b.queryCommands('s').skills.find(s => s.skillId === S('triple'))!.ready).toBe(true);
    round(b, cast('triple')); expect(b.unit('s').attrs.hp).toBe(100); expect(damage(b, 'pet')).toEqual(damage(b));
    expect(b.unit('s').statuses.some(s => s.id === T('pursuit'))).toBe(false);
  });
  it('追击击倒主目标保留；普通击倒不再给浴血免休息', () => {
    const { b } = setup('zhanchen'); round(b, cast('pursuit', 's')); b.unit('t0').attrs.hp = 1; round(b, cast('triple'));
    expect(b.unit('s').statuses.some(s => s.id === T('pursuit'))).toBe(true); expect(b.unit('s').flags.skipNextAction).toBe(true);
  });
  it('干将强化破极剑意，普通版本不能覆盖强化版本', () => {
    const { b } = setup('zhanchen', ['4.1']); round(b, cast('sword_aura', 's'));
    b.applyStatus('s', T('sword_aura'), 5, 'ally');
    expect(b.unit('s').statuses.filter(s => s.kind === 'lingxiao.sword_aura')).toEqual([expect.objectContaining({ id: T('sword_aura_ganjiang'), remainingRounds: 5 })]);
    round(b, attack); expect(damage(b)).toEqual([915]);
  });
  it('两名施法者的破绽独立保留；同类降疗不叠加，额外受疗增益仍生效', () => {
    const { input } = setup('zhanchen');
    const b = createBattle({ ...input, statusDefs: [...input.statusDefs, { id: 'healing', name: '受疗增益', kind: 'healing', healTaken: 1.2 }] });
    b.applyStatus('t0', T('wound'), 2, 's'); b.applyStatus('t0', T('wound'), 3, 'ally');
    b.applyStatus('t0', T('wound'), 2, 's');
    expect(b.unit('t0').statuses).toHaveLength(2);
    b.applyStatus('t0', 'healing', 5, 't0'); expect(healTakenFactor(b.unit('t0'))).toBeCloseTo(.84);
    round(b, attack, { ally: attack }); expect(damage(b)).toEqual([990]);
    expect(b.log().filter(e => e.type === 'damage' && e.sourceId === 'ally').at(-1)).toMatchObject({ amount: 990 });
    round(b); round(b); expect(b.unit('t0').statuses.filter(s => s.id === T('wound')).map(s => s.sourceId)).toEqual(['ally']);
  });
});

describe('装备、队伍与保护联动', () => {
  it('杀伐可由队友击倒触发，每回合最多成功一次，倒地及装备不符合三行条件均不能获取', () => {
    const kill: SkillDef = { id: 'kill_all', name: '击倒', tags: [], targeting: { side: 'enemy', mode: 'all' }, effects: [{ type: 'fixedHit', power: 200000 }] };
    let triggered = 0;
    for (let seed = 1; seed <= 12; seed++) {
      for (const [fire, downed] of [[true, false], [true, true], [false, false]]) {
        const { input } = setup('guiyi', ['4.2'], [kill]);
        const b = createBattle({ ...input, seed });
        if (fire) b.unit('s').tags.push('equipment.weapon_armor.metal_fire_wind');
        if (downed) { b.unit('s').flags.downed = true; b.unit('s').attrs.hp = 0; }
        b.unit('ally').skills = [kill.id];
        round(b, { type: 'defend' }, { ally: { type: 'skill', skillId: kill.id, targets: ['t0'] } });
        expect(resource(b).current).toBeLessThanOrEqual(1);
        if (!fire || downed) expect(resource(b).current).toBe(0);
        else triggered += resource(b).current;
      }
    }
    expect(triggered).toBeGreaterThan(0);
  });
  it('念心检查召唤灵是否存活；鬼魂倒地同样视为不在场', () => {
    const rates: number[] = [];
    for (const downed of [false, true]) {
      const { b } = setup('guiyi', ['3.2']);
      if (downed) { b.unit('pet').flags.dead = true; b.unit('pet').attrs.hp = 0; b.unit('pet').flags.reviveAtRound = 10; }
      b.hooks.on('onCritRoll', ctx => { if (ctx.source?.id === 's') rates.push(ctx.chance ?? 0); });
      round(b, attack);
    }
    expect(rates).toEqual([0, .15]);
  });
  it('静岳回合末补盾，未耗尽时不反复刷新；执剑只扩展首次临渊', () => {
    const { b } = setup('zhanchen', ['3.3', '5.1']); round(b);
    expect(b.unit('s').barriers[0]).toMatchObject({ current: 180, untilBattleEnd: true });
    const appliedRound = b.unit('s').barriers[0].appliedRound;
    round(b); expect(b.unit('s').barriers[0].appliedRound).toBe(appliedRound);
    b.unit('s').attrs.hp = 4000;
    expect(b.queryCommands('s').skills.find(s => s.skillId === S('formation'))!.targetCount).toBe(6);
    round(b, cast('formation')); ready(b); b.unit('s').attrs.hp = 4000;
    expect(b.queryCommands('s').skills.find(s => s.skillId === S('formation'))!.targetCount).toBe(3);
  });
  it('突刺用施放前90%血线，突进逐段积累；破血只加强已有双剑合璧', () => {
    const { b } = setup('guiyi', ['1.3', '5.3']); b.unit('s').attrs.hp = 9000;
    round(b, cast('triple')); expect(damage(b)).toEqual([708, 804, 900]); expect(resource(b, 'advance').current).toBe(3);
    const art: SkillDef = { id: 'dao_equipment.skill.diefeng', name: '双剑合璧', tags: ['physical', 'art'], targeting: { side: 'enemy' }, effects: [{ type: 'physicalHit', hits: 2, coeff: 1 }] };
    const c = setup('zhanchen', ['4.2'], [art]).b;
    round(c, { type: 'skill', skillId: art.id, targets: ['t0'] }); expect(damage(c)).toEqual([900, 900, 900]);
    expect(setup('zhanchen', ['4.2']).b.unit('s').skills).not.toContain(art.id);
  });
  it('金火风装备只增加暴击倍率，两件合计+0.40', () => {
    const { b } = setup('zhanchen', ['3.1']); b.unit('s').attrs.critRate = 1; b.unit('s').combatFacts = { metalFireWindEquipmentCount: 2 };
    round(b, attack); expect(damage(b)).toEqual([2160]);
  });
  it('玄锋忽防仅由武器等级提供；剑破只追加两倍武器玄锋贡献', () => {
    const { b } = setup('guiyi', ['5.2', '6.1']); b.unit('s').combatFacts = { weaponXuanfengLevel: 18, weaponXuanfengAttack: 108 };
    resource(b).current = 12; round(b, attack); expect(damage(b)).toEqual([951]);
    resource(b).current = 13; round(b, attack); expect(damage(b).at(-1)).toBe(1178);
  });
  it('扶阵覆盖固定伤害，同名不叠加，队友可以受益', () => {
    const fixed: SkillDef = { id: 'fixed', name: '固定', tags: [], targeting: { side: 'enemy' }, effects: [{ type: 'fixedHit', power: 100 }] };
    const { b } = setup('zhanchen', ['1.3'], [fixed]); b.unit('ally').passives = [...b.unit('s').passives]; b.unit('ally').skills = ['fixed'];
    round(b, { type: 'defend' }, { ally: { type: 'skill', skillId: 'fixed', targets: ['t0'] } });
    // This fixture's formula deliberately includes the same 900 base term for all damage kinds.
    expect(b.log().filter(e => e.type === 'damage' && e.sourceId === 'ally').at(-1)).toMatchObject({ amount: 1030 });
  });
  it('保护分摊七三；破空仅放大被保护者份额', () => {
    const { b } = setup('zhanchen', ['6.1']); round(b, attack, { t1: { type: 'protect', target: 't0' } });
    expect(damage(b, 't1')).toEqual([630]); expect(damage(b)).toEqual([310]);
  });
  it('亢强用器诀原价，折扣后实际支付不改变下一次连破概率', () => {
    const art: SkillDef = { id: 'art', name: '器诀', tags: ['art'], resourceCosts: [{ resourceId: 'combat.resource.rage', amount: 64 }], originalResourceCosts: [{ resourceId: 'combat.resource.rage', amount: 80 }], targeting: { side: 'self' }, effects: [] };
    const { b } = setup('guiyi', ['3.1'], [art]); b.unit('s').resources.find(r => r.id === 'combat.resource.rage')!.current = 100;
    round(b, { type: 'skill', skillId: 'art', targets: ['s'] }); expect(resource(b, 'art_momentum').current).toBe(80);
    round(b, cast('triple')); expect(b.log().filter(e => e.type === 'chanceResolved').at(-1)).toMatchObject({ chance: .25 }); expect(resource(b, 'art_momentum').current).toBe(0);
  });
  it('历战PVP血线为≥10%，PVE仍必须低于50%', () => {
    for (const [kind, hp, ready] of [['player', 1000, true], ['player', 999, false], ['player', 9000, true], ['npc', 9000, false]] as const) {
      const { b } = setup('zhanchen', ['6.2'], [], kind); b.unit('s').attrs.hp = hp;
      expect(b.queryCommands('s').skills.find(s => s.skillId === S('formation'))!.reasons.includes('hp-requirement')).toBe(!ready);
    }
  });
  it('第七层旧左右选择映射中央，独立奖励不互斥', () => {
    for (const path of ['guiyi', 'zhanchen'] as const) {
      const left = projection(path, ['7.1'], 7), middle = projection(path, ['7.2'], 7), right = projection(path, ['7.3'], 7);
      expect(left).toEqual(middle); expect(right).toEqual(middle);
      expect(middle.panel.slice(-2)).toEqual(Array.from({ length: 2 }, () => ({ attr: path === 'guiyi' ? 'maxHp' : 'physicalAtk', mode: 'add', value: path === 'guiyi' ? 280 : 40 })));
    }
  });
});

describe('经脉附加效果不要求穿透护盾', () => {
  function shield(b: Battle) {
    b.unit('t0').barriers.push({ id: 'shield', kind: 'shield', name: '护盾', current: 1000000, remainingRounds: 10, sourceId: 't0', appliedRound: 1 });
  }
  it('翩鸿命中护盾仍驱散，未命中不驱散', () => {
    for (const hit of [true, false]) {
      const { input } = setup('zhanchen', ['2.1']);
      const b = createBattle({ ...input, ruleset: { ...ruleset, formulas: { ...ruleset.formulas, physicalHitChance: () => hit ? 1 : 0 } } });
      shield(b); b.applyStatus('t0', T('clarity'), 5, 't0'); round(b, cast('shadow_strike'));
      expect(b.unit('t0').attrs.hp).toBe(100000);
      expect(b.unit('t0').statuses.some(s => s.id === T('clarity'))).toBe(!hit);
    }
  });
  it('长驱命中护盾时仍按相同概率判定重创', () => {
    let procs = 0;
    for (let seed = 1; seed <= 24; seed++) {
      const results = [false, true].map(hasShield => {
        const { input } = setup('zhanchen', ['2.3']); const b = createBattle({ ...input, seed });
        if (hasShield) shield(b); round(b, cast('zhanchen_long_drive'));
        return b.unit('t0').statuses.some(s => s.id === T('wound'));
      });
      expect(results[1]).toBe(results[0]); procs += Number(results[1]);
    }
    expect(procs).toBeGreaterThan(0); expect(procs).toBeLessThan(24);
  });
  it('勇武命中护盾仍留破绽；突进仍要求实际扣血', () => {
    const b = setup('zhanchen', ['2.2']).b; shield(b); round(b, cast('waiting')); round(b);
    expect(b.unit('t0').statuses.some(s => s.id === T('bravery'))).toBe(true);
    const c = setup('guiyi', ['5.3']).b; shield(c); round(c, attack);
    expect(resource(c, 'advance').current).toBe(0);
  });
  it('执剑只增加首次临渊的目标数及暴击率', () => {
    const b = setup('zhanchen', ['5.1']).b;
    const chances: number[] = [];
    b.hooks.on('onCritRoll', h => { if (h.source?.id === 's') chances.push(h.chance ?? 0); });
    b.unit('s').attrs.hp = 4000; round(b, cast('formation'));
    expect(chances).toEqual(Array(6).fill(.1));
    chances.length = 0; ready(b); b.unit('s').attrs.hp = 4000; round(b, cast('formation'));
    expect(chances).toEqual([0, 0, 0]);
  });
});
