import { afterEach, describe, expect, it, vi } from 'vitest';
import { createBattle, effectiveAttrs, restoreBattle, SeededRng, type Command, type SkillDef } from '../core';
import { createDaoyouRuleset } from '../rules-daoyou';
import { COMBAT_V6_PHASE_6D_VERSIONS as versions } from '../version';
import { createEmptySectCombatProgressV6 } from '../build-state';
import { compileSectDefinitionV6 } from './compiler';
import { YOUDU_V6_DEFINITION as definition } from './youdu';
import { DAO_EQUIPMENT_ARTS_V1 } from '../equipment/special-content';
import { BEAST_SKILLS, BEAST_STATUS_DEFS } from '../beasts/content';

const S = (x: string) => `youdu.skill.${x}`;
const T = (x: string) => `youdu.status.${x}`;
const skill = (x: string, target = 't'): Command => ({ type: 'skill', skillId: S(x), targets: [target] });
function setup(nodeNames: string[] = [], pathName = 'soul_judge', enemyCount = 3) {
  const path = definition.paths.find(p => p.id === `youdu.path.${pathName}`)!;
  const selected = nodeNames.map(name => path.nodes.find(n => n.name === name && !n.automatic)!);
  const last = Math.max(0, ...selected.map(n => n.layer));
  const chain = Array.from({ length: last }, (_, i) => selected.find(n => n.layer === i + 1) ?? path.nodes.find(n => n.layer === i + 1 && n.slot === 2)!);
  const progress = createEmptySectCombatProgressV6('youdu', path.id, Object.fromEntries(definition.methods.map(m => [m.id, 180])));
  progress.meridianDepth = 7;
  progress.meridianLoadouts.find(l => l.pathId === path.id)!.nodeIds = chain.map(n => n.id);
  const result = compileSectDefinitionV6({ definition, progress, characterLevel: 180 });
  if (!result.ok || result.projection.diagnostics.some(d => d.code === 'MERIDIAN_CONNECTION_INCOMPLETE')) throw new Error(JSON.stringify(result));
  const p = result.projection;
  const dispel: SkillDef = { id: 'test.cleanse', name: '解毒', tags: ['spell'], targeting: { side: 'ally' }, effects: [{ type: 'dispel', categories: ['dot'] }] };
  const input = {
    seed: 19, versions, ruleset: createDaoyouRuleset({ formulas: { sealHitChance: () => 1, physicalHitChance: () => 1, fluctuationMin: 1, fluctuationMax: 1, physicalFluctuationMin: 1, physicalFluctuationMax: 1 } }),
    skills: [...p.skills, dispel, ...DAO_EQUIPMENT_ARTS_V1.map(a => a.skill)], statusDefs: p.statusDefs,
    units: [
      { id: 's', name: '幽都', side: 0 as const, kind: 'player' as const, level: 180,
        attrs: { hp: 100000, mp: 100000, speed: 1000, physicalAtk: 1000, physicalDef: 300 },
        tags: p.unitTags, skills: p.activeSkillIds, passives: p.passiveSkillIds, skillLevels: p.skillLevels, skillOverrides: p.skillOverrides,
        resources: [{ id: 'combat.resource.rage', name: '战意', current: 0, max: 150 }] },
      { id: 'a', name: '队友', side: 0 as const, kind: 'player' as const, level: 180, attrs: { hp: 100000, mp: 100000, speed: 500, physicalAtk: 1000, physicalDef: 300 }, skills: ['test.cleanse'] },
      ...Array.from({ length: enemyCount }, (_, i) => ({ id: i === 0 ? 't' : `t${i}`, name: '对手', side: 1 as const, kind: 'player' as const, level: 180,
        attrs: { hp: 100000, mp: 100000, speed: 10, physicalAtk: 1000, physicalDef: 300 }, skills: ['test.cleanse'] })),
    ],
  };
  return { b: createBattle(input), input, p };
}
type Battle = ReturnType<typeof setup>['b'];
function round(b: Battle, commands: Record<string, Command> = {}) {
  for (const u of b.state.units) if (!u.flags.downed && !u.flags.dead) b.submit(u.id, commands[u.id] ?? { type: 'defend' });
  b.lockAndResolve();
}
const status = (b: Battle, unit: string, id: string) => b.unit(unit).statuses.find(s => s.id === T(id));
const damage = (b: Battle, source = 's') => b.log().filter(e => e.type === 'damage' && e.sourceId === source).map(e => e.type === 'damage' ? e.amount : 0);
const rage = (b: Battle) => b.unit('s').resources[0].current;

afterEach(() => vi.restoreAllMocks());

describe('幽都经脉触发与边界', () => {
  it('夜行常驻半值，阎罗只读取武器贡献；敌方非宠物倒地给下次灭魂杀充能', () => {
    const n = setup(['夜行']);
    expect(n.p.panel).toContainEqual({ attr: 'physicalAtk', mode: 'add', value: 20 });
    expect(n.p.panel).toContainEqual({ attr: 'speed', mode: 'add', value: 20 });
    const base = setup(); round(base.b, { s: skill('edict') }); round(n.b, { s: skill('edict') });
    expect(damage(n.b)[0] - damage(base.b)[0]).toBe(25);
    const { b } = setup(['阎罗']); b.unit('t').attrs.hp = 1;
    round(b, { a: { type: 'attack', target: 't' } });
    expect(status(b, 's', 'judgment_ready')).toBeDefined();
    round(b, { s: skill('judge', 't1') });
    expect(status(b, 's', 'judgment_ready')).toBeUndefined();
  });
  it('回旋只减法术攻击，包括固伤；不减物理攻击或毒跳伤', () => {
    const base = setup(), guard = setup(['回旋']);
    for (const { b } of [base, guard]) {
      b.unit('t').skills.push(S('judge'));
      round(b, { t: skill('judge', 's') });
    }
    expect(damage(base.b, 't')[0] - damage(guard.b, 't')[0]).toBe(65);
    const base2 = setup(), guard2 = setup(['回旋']);
    for (const { b } of [base2, guard2]) round(b, { t: { type: 'attack', target: 's' } });
    expect(damage(base2.b, 't')).toEqual(damage(guard2.b, 't'));
  });
  it('入骨只响应自己魂毒被驱散，不响应自然到期或其他施毒者', () => {
    const { b } = setup(['入骨']);
    b.applyStatus('t', T('poison'), 3, 's');
    round(b, { t: { type: 'skill', skillId: 'test.cleanse', targets: ['t'] } });
    expect(b.unit('t').attrs.hp).toBe(99100);
    const other = setup(['入骨']).b; other.applyStatus('t', T('poison'), 3, 'a');
    round(other, { t: { type: 'skill', skillId: 'test.cleanse', targets: ['t'] } });
    expect(other.unit('t').attrs.hp).toBe(100000);
    const expiry = setup(['入骨']).b; expiry.applyStatus('t', T('poison'), 1, 's'); round(expiry);
    expect(damage(expiry)).toHaveLength(1);
  });
  it('聚魂增强摄魂；拘魄允许倒地标记，复起、再倒地仍保留且不叠加', () => {
    const a = setup(['聚魂']).b; round(a, { s: skill('siphon') });
    expect(status(a, 't', 'siphon_strong')).toBeDefined();
    const { b } = setup(['拘魄']); b.unit('t').attrs.hp = 0; b.unit('t').flags.downed = true;
    expect(b.queryCommands('s').skills.find(s => s.skillId === S('siphon'))!.selectableTargetIds).toContain('t');
    round(b, { s: skill('siphon') }); round(b, { s: skill('siphon') });
    expect(b.unit('t').statuses.filter(s => s.id === T('bound_soul'))).toHaveLength(1);
    b.unit('t').flags.downed = false; b.unit('t').attrs.hp = 1;
    round(b, { a: { type: 'attack', target: 't' } });
    expect(status(b, 't', 'bound_soul')).toBeDefined();
  });
  it('克敌只查自身武器，命中持续+1；黄泉强化减速；幽冥延长法眼', () => {
    for (const allowed of [false, true]) {
      const { b } = setup(['克敌']); if (allowed) b.unit('s').tags.push('equipment.weapon.water_ice_earth');
      round(b, { s: skill('soul_seal') });
      expect(status(b, 't', 'soul_seal')!.remainingRounds).toBe(allowed ? 6 : 5);
    }
    const slow = setup(['黄泉']).b; round(slow, { s: skill('pursuit') });
    expect(status(slow, 't', 'slow_strong')!.speedMod).toBe(-54);
    const eye = setup(['幽冥']).b; round(eye, { s: skill('insight', 's') });
    expect(status(eye, 's', 'insight')!.remainingRounds).toBe(6);
  });
  it('泉爆只在唯一幽都的首次滞魂咒生效，快照恢复不重置次数', () => {
    const base = setup(); round(base.b, { s: skill('pursuit') });
    const { b, input } = setup(['泉爆']); round(b, { s: skill('pursuit') });
    expect(damage(b)[0]).toBe(damage(base.b)[0] * 4);
    const restored = restoreBattle(input, b.snapshot(), [...b.log()]);
    round(restored, { s: skill('pursuit') }); expect(damage(restored).at(-1)).toBe(damage(base.b)[0]);
  });
  it('鬼火按原始特技价格返16战意，普通技能不触发', () => {
    const { b } = setup(['鬼火']); b.unit('s').skills.push('dao_equipment.skill.diefeng'); b.unit('s').resources[0].current = 100;
    round(b, { s: { type: 'skill', skillId: 'dao_equipment.skill.diefeng', targets: ['t'] } });
    expect(rage(b)).toBe(36);
    round(b, { s: skill('judge') }); expect(rage(b)).toBe(36);
  });
  it('魂飞不要求驱散到增益，队友当回合击倒也会附加拘灵，跨回合不触发', () => {
    const { b } = setup(['魂飞']); b.unit('t').attrs.hp = 1;
    round(b, { s: skill('dispel'), a: { type: 'attack', target: 't' } });
    expect(status(b, 't', 'soul_seal')!.remainingRounds).toBe(2);
    const c = setup(['魂飞']).b; round(c, { s: skill('dispel') }); c.unit('t').attrs.hp = 1;
    round(c, { a: { type: 'attack', target: 't' } }); expect(status(c, 't', 'soul_seal')).toBeUndefined();
  });
  it('汲魂按敌方人物每次倒地回血，不治疗灵兽死亡，也不能自复活', () => {
    const { b } = setup(['汲魂']); b.unit('s').attrs.hp = 50000; b.unit('t').attrs.hp = 1;
    round(b, { a: { type: 'attack', target: 't' } }); expect(b.unit('s').attrs.hp).toBe(51080);
    b.unit('t1').kind = 'pet'; b.unit('t1').attrs.hp = 1;
    round(b, { a: { type: 'attack', target: 't1' } }); expect(b.unit('s').attrs.hp).toBe(51080);
    b.unit('s').flags.downed = true; b.unit('s').attrs.hp = 0; b.unit('t2').attrs.hp = 1;
    round(b, { a: { type: 'attack', target: 't2' } }); expect(b.unit('s').attrs.hp).toBe(0);
  });
  it('回音限定自己拘灵的目标，下次使用后消耗，即使未命中', () => {
    const { b, input } = setup(['回音']); b.applyStatus('t', T('soul_seal'), 5, 's'); b.unit('t').attrs.hp = 1;
    round(b, { a: { type: 'attack', target: 't' } }); expect(status(b, 's', 'death_echo')).toBeDefined();
    round(b, { s: skill('soul_seal', 't1') }); expect(status(b, 't1', 'soul_seal')!.remainingRounds).toBe(6); expect(status(b, 's', 'death_echo')).toBeUndefined();
    b.applyStatus('s', T('death_echo'), 3, 's'); input.ruleset.formulas.sealHitChance = () => 0;
    round(b, { s: skill('soul_seal', 't2') }); expect(status(b, 's', 'death_echo')).toBeUndefined(); expect(status(b, 't2', 'soul_seal')).toBeUndefined();
  });
  it('魍魉追魂只给倒地友军留印，不复活；印记数动态叠加而单体标记不叠层', () => {
    const { b } = setup(['魍魉追魂']); b.unit('a').attrs.hp = 0; b.unit('a').flags.downed = true;
    round(b, { s: skill('soul_chase', 'a') });
    expect(b.unit('a').flags.downed).toBe(true); expect(status(b, 'a', 'soul_chase')).toBeDefined();
    expect(b.unit('s').cooldowns![S('soul_chase')]).toBe(5);
    b.unit('a').flags.downed = false; b.unit('a').attrs.hp = 100000;
    round(b, { a: { type: 'attack', target: 't' } });
    const first = damage(b, 'a').at(-1)!;
    b.applyStatus('s', T('soul_chase'), 1, 's');
    round(b, { a: { type: 'attack', target: 't' } }); expect(damage(b, 'a').at(-1)).toBeGreaterThan(first);
  });
  it('入魂只在摄魂后的下一回合增加物理伤害', () => {
    const { b } = setup(['入魂'], 'poison_master'); round(b, { s: skill('siphon') });
    expect(status(b, 's', 'enter_soul')).toBeDefined();
    round(b, { s: { type: 'attack', target: 't1' } }); const boosted = damage(b).at(-1)!;
    expect(status(b, 's', 'enter_soul')).toBeUndefined();
    round(b, { s: { type: 'attack', target: 't1' } }); expect(boosted).toBeCloseTo(damage(b).at(-1)! * 1.15, -1);
  });
  it('破毒以出手前的魂毒快照加成，不因第一刀附毒让第二刀增伤，也不触发群疗', () => {
    const { b } = setup(['破毒'], 'poison_master'); b.unit('s').skills.push('dao_equipment.skill.diefeng'); b.unit('s').resources[0].current = 150; b.unit('a').attrs.hp = 50000;
    round(b, { s: { type: 'skill', skillId: 'dao_equipment.skill.diefeng', targets: ['t'] } });
    const hits = damage(b).slice(0, 2); expect(hits[0]).toBe(hits[1]); expect(status(b, 't', 'poison')).toBeDefined(); expect(b.unit('a').attrs.hp).toBe(50000);
  });
  it('狂宴在护盾全吸收时仍回复战意；同一目标多段只算一次', () => {
    const { b } = setup(['狂宴'], 'poison_master'); b.unit('s').skills.push('dao_equipment.skill.diefeng'); b.unit('s').resources[0].current = 100;
    b.applyStatus('t', T('poison'), 3, 'a'); b.unit('t').barriers.push({ id: 'barrier', kind: 'barrier', name: '盾', current: 100000, remainingRounds: 3, sourceId: 't', appliedRound: 1 });
    round(b, { s: { type: 'skill', skillId: 'dao_equipment.skill.diefeng', targets: ['t'] } }); expect(rage(b)).toBe(22);
  });
  it('追命只认本人击倒玩家且队伍唯一幽都；恶焰只认击飞，不认人物倒地', () => {
    const { b } = setup(['追命'], 'poison_master'); b.unit('t').attrs.hp = 1;
    round(b, { a: { type: 'attack', target: 't' } }); expect(status(b, 't', 'soul_seal')).toBeUndefined();
    b.unit('t1').attrs.hp = 1; round(b, { s: { type: 'attack', target: 't1' } }); expect(status(b, 't1', 'soul_seal')!.remainingRounds).toBe(3);
    const c = setup(['恶焰'], 'poison_master').b; c.applyStatus('t', T('poison'), 3, 'a'); c.unit('t').attrs.hp = 1;
    round(c, { s: { type: 'attack', target: 't' } }); expect(status(c, 's', 'evil_flame')).toBeUndefined();
    c.unit('t1').kind = 'pet'; c.unit('t1').attrs.hp = 1; c.applyStatus('t1', T('poison'), 3, 'a');
    round(c, { s: { type: 'attack', target: 't1' } }); expect(status(c, 's', 'evil_flame')).toBeDefined();
  });
  it('轮回维持6个中毒单位门槛，唯一幽都条件不因同门倒地消失', () => {
    const { b } = setup(['轮回'], 'poison_master', 6);
    for (let i = 0; i < 5; i++) b.applyStatus(i ? `t${i}` : 't', T('poison'), 3, 'a');
    round(b); expect(status(b, 's', 'reincarnation')).toBeUndefined();
    b.applyStatus('t5', T('poison'), 3, 'a'); round(b); expect(status(b, 's', 'reincarnation')).toBeDefined();
    expect(effectiveAttrs(b.unit('s')).physicalAtk).toBe(1060);
    const c = setup(['轮回'], 'poison_master', 6).b; c.unit('a').tags.push('sect.youdu'); c.unit('a').flags.downed = true; c.unit('a').attrs.hp = 0;
    for (const u of c.state.units.filter(u => u.side === 1)) c.applyStatus(u.id, T('poison'), 3, 'a');
    round(c); expect(status(c, 's', 'reincarnation')).toBeUndefined();
  });
  it('生杀予夺开场18、使用后36回合冷却，按敌方中毒与倒地人数额外减冷却', () => {
    const { b, input } = setup(['生杀予夺'], 'poison_master');
    expect(b.queryCommands('s').skills.find(s => s.skillId === S('life_and_death'))!.cooldownRemaining).toBe(18);
    b.applyStatus('t', T('poison'), 3, 's'); b.unit('t1').flags.downed = true; b.unit('t1').attrs.hp = 0;
    round(b); expect(b.unit('s').cooldowns![S('life_and_death')]).toBe(15);
    const restored = restoreBattle(input, b.snapshot(), [...b.log()]);
    expect(restored.unit('s').cooldowns).toEqual(b.unit('s').cooldowns);
    b.unit('s').cooldowns![S('life_and_death')] = b.state.round; b.unit('t').statuses = []; b.unit('t1').flags.downed = false; b.unit('t1').attrs.hp = 100000;
    const castRound = b.state.round; round(b, { s: skill('life_and_death') }); expect(b.unit('s').cooldowns![S('life_and_death')]).toBe(castRound + 36);
  });
  it('生杀回血只按此次实际气血损失，排除护盾和过量伤害；驱散可驱散增益', () => {
    const { b } = setup(['生杀予夺'], 'poison_master'); b.unit('s').cooldowns![S('life_and_death')] = 1; b.unit('s').attrs.hp = 50000; b.unit('t').attrs.hp = 10;
    b.unit('t').barriers.push({ id: 'b', kind: 'b', name: '护盾', current: 100, remainingRounds: 3, appliedRound: 1, sourceId: 't' });
    round(b, { s: skill('life_and_death') });
    // Sixth-layer 汲魂 in the legal prefix also heals 1080 on player death.
    expect(b.unit('s').attrs.hp).toBe(51090);
  });
  it('冥毒只穿透高级毒性，不穿透鬼魂的异常免疫', () => {
    for (const enabled of [false, true]) for (const immunity of ['beast.advanced-poison', 'beast.ghost']) {
      const { input } = setup(enabled ? ['冥毒'] : [], 'poison_master');
      const b = createBattle({ ...input, skills: [...input.skills, ...BEAST_SKILLS], statusDefs: [...input.statusDefs, ...BEAST_STATUS_DEFS] });
      b.unit('t').passives.push(immunity);
      round(b, { s: skill('wither') });
      expect(Boolean(status(b, 't', 'poison'))).toBe(enabled && immunity === 'beast.advanced-poison');
    }
  });
  it('无赦消耗50法力、替代涤魂；任意毒类异常使随机驱散增为2个，保护不可驱散状态', () => {
    for (const poisoned of [false, true]) {
      const { input, p } = setup(['无赦咒令'], 'poison_master');
      expect(p.activeSkillIds).not.toContain(S('dispel'));
      const b = createBattle({ ...input, statusDefs: [...input.statusDefs, ...BEAST_STATUS_DEFS] });
      b.applyStatus('t', T('insight'), 5, 't'); b.applyStatus('t', T('revival'), 5, 't'); b.applyStatus('t', T('soul_chase'), 1, 't');
      if (poisoned) b.applyStatus('t', BEAST_STATUS_DEFS.find(s => s.kind === 'beast.poison')!.id, 3, 't');
      round(b, { s: skill('pardonless') });
      expect(b.unit('s').attrs.mp).toBe(99950);
      expect(b.log().filter(e => e.type === 'statusRemoved' && e.reason === 'dispel')).toHaveLength(poisoned ? 2 : 1);
      expect(status(b, 't', 'soul_chase')).toBeDefined();
    }
  });
  it('破印只强化灵兽，毒慑读取任意敌方魂毒而非受击目标；瘴幕读取攻击者魂毒', () => {
    const base = setup([], 'poison_master');
    round(base.b, { s: { type: 'attack', target: 't' } }); const ordinary = damage(base.b)[0];
    const pet = setup(['破印'], 'poison_master').b; pet.unit('t').kind = 'pet';
    round(pet, { s: { type: 'attack', target: 't' } }); expect(damage(pet)[0]).toBeCloseTo(ordinary * 1.3, -1);
    const npc = setup(['破印'], 'poison_master').b; npc.unit('t').kind = 'npc';
    round(npc, { s: { type: 'attack', target: 't' } }); expect(damage(npc)[0]).toBe(ordinary);
    const dread = setup(['毒慑'], 'poison_master').b; dread.applyStatus('t1', T('poison'), 3, 'a');
    round(dread, { s: { type: 'attack', target: 't' } }); expect(damage(dread)[0]).toBeCloseTo(ordinary * 1.06, -1);
    const guard = setup(['瘴幕'], 'poison_master').b, naked = setup([], 'poison_master').b;
    guard.applyStatus('t', T('poison'), 3, 'a');
    for (const b of [guard, naked]) round(b, { t: { type: 'attack', target: 's' } });
    expect(damage(guard, 't')[0]).toBeCloseTo(damage(naked, 't')[0] * 0.96, -1);
  });
  it('阎罗充能后的灭魂杀再次击倒非宠物时保留下次充能，击飞宠物则消耗', () => {
    for (const kind of ['player', 'pet'] as const) {
      const { b } = setup(['阎罗']); b.applyStatus('s', T('judgment_ready'), 1, 's'); b.unit('t').attrs.hp = 1; b.unit('t').kind = kind;
      round(b, { s: skill('judge') }); expect(Boolean(status(b, 's', 'judgment_ready'))).toBe(kind === 'player');
    }
  });

  it('索魂逐回合增加至12个百分点；伤魂区分普通毒20点与魂毒24点', () => {
    for (const [r, expected] of [[1, 0.505], [24, 0.62], [40, 0.62]]) {
      const { b, input } = setup(['索魂']); input.ruleset.formulas.sealHitChance = () => 0.5; b.state.round = r;
      const rolls = vi.spyOn(SeededRng.prototype, 'chance'); round(b, { s: skill('soul_seal') });
      expect(rolls.mock.calls.some(([p]) => Math.abs(p - expected) < 1e-10)).toBe(true); rolls.mockRestore();
    }
    for (const [kind, expected] of [['beast.poison', 0.7], ['youdu.poison', 0.74]] as const) {
      const { input } = setup(['伤魂']); input.ruleset.formulas.sealHitChance = () => 0.5;
      const b = createBattle({ ...input, statusDefs: [...input.statusDefs, ...BEAST_STATUS_DEFS] });
      const def = [...input.statusDefs, ...BEAST_STATUS_DEFS].find(s => s.kind === kind)!; b.applyStatus('t', def.id, 3, 'a');
      const rolls = vi.spyOn(SeededRng.prototype, 'chance'); round(b, { s: skill('soul_seal') });
      expect(rolls.mock.calls.some(([p]) => Math.abs(p - expected) < 1e-10)).toBe(true); rolls.mockRestore();
    }
  });
  it('幽光只穿透法眼抗封，保留神魂自守；冥视的法眼系数为0.85', () => {
    for (const ignore of [false, true]) {
      const { b, input } = setup(ignore ? ['幽光'] : []); input.ruleset.formulas.sealHitChance = () => 0.5;
      b.unit('t').passives.push('youdu.passive.soul_guard'); b.applyStatus('t', T('insight_strong'), 5, 't');
      const rolls = vi.spyOn(SeededRng.prototype, 'chance'); round(b, { s: skill('soul_seal') });
      const expected = 0.5 * 0.7 * (ignore ? 1 : 0.85);
      expect(rolls.mock.calls.some(([p]) => Math.abs(p - expected) < 1e-10)).toBe(true); rolls.mockRestore();
    }
    const { b } = setup(['冥视']); round(b, { s: skill('insight', 's') }); expect(status(b, 's', 'insight_strong')).toBeDefined();
  });
  it('阴翳只强化带魂毒的血影；毒炽增加12个百分点且不让固定伤害暴击', () => {
    const base = setup([], 'poison_master').b, shade = setup(['阴翳'], 'poison_master').b;
    for (const b of [base, shade]) { b.applyStatus('t', T('poison'), 3, 'a'); round(b, { s: skill('blood_shadow') }); }
    expect(damage(shade)[0]).toBeCloseTo(damage(base)[0] * 1.3, -1);
    const { b } = setup(['毒炽'], 'poison_master'); b.applyStatus('t', T('poison'), 3, 'a');
    const rolls = vi.spyOn(SeededRng.prototype, 'chance'); round(b, { s: skill('blood_shadow') });
    expect(rolls.mock.calls.some(([p]) => Math.abs(p - (0.12 + 80 / 1800)) < 1e-10)).toBe(true); rolls.mockRestore();
    const c = setup(['毒炽'], 'poison_master').b; c.applyStatus('t', T('poison'), 3, 'a'); round(c, { s: skill('edict') });
    expect(c.log().filter(e => e.type === 'hit').every(e => e.type === 'hit' && !e.crit)).toBe(true);
  });
  it('森罗迷障是10回合自身增益，百鬼攻击4目标按每人35法力收费，附毒概率受迷障提高', () => {
    const { b } = setup([], 'poison_master', 6);
    round(b, { s: skill('poison_shroud', 's') });
    expect(status(b, 's', 'poison_shroud')!.remainingRounds).toBe(10);
    expect(b.unit('s').attrs.mp).toBe(99900);
    expect(b.state.units.filter(u => u.side === 1).every(u => !u.statuses.some(s => s.kind === 'youdu.poison'))).toBe(true);
    const rolls = vi.spyOn(SeededRng.prototype, 'chance'); round(b, { s: skill('ghost_swarm') });
    expect(b.unit('s').attrs.mp).toBe(99760);
    expect(rolls.mock.calls.filter(([p]) => p === 0.6)).toHaveLength(4);
  });

  it('生杀不吸取保护者分担的伤害，倒地期间也按场面缩短冷却', () => {
    const { b } = setup(['生杀予夺'], 'poison_master'); b.unit('s').cooldowns![S('life_and_death')] = 1; b.unit('s').attrs.hp = 50000;
    round(b, { s: skill('life_and_death'), t1: { type: 'protect', target: 't' } });
    expect(b.unit('t1').attrs.hp).toBeLessThan(100000);
    expect(b.unit('s').attrs.hp - 50000).toBe(100000 - b.unit('t').attrs.hp);
    b.unit('s').attrs.hp = 0; b.unit('s').flags.downed = true; b.unit('t1').flags.downed = true; b.unit('t1').attrs.hp = 0;
    const ready = b.unit('s').cooldowns![S('life_and_death')];
    round(b); expect(b.unit('s').cooldowns![S('life_and_death')]).toBe(ready - 2);
  });

});
