import { afterEach, describe, expect, it, vi } from 'vitest';
import { createBattle } from '@daoyou/combat-core/session';
import { SeededRng } from '@daoyou/combat-core/rng';
import { effectiveAttrs } from '@daoyou/combat-core/units';
import type { Command, CreateBattleInput, LineupUnit, SkillDef } from '@daoyou/combat-core/types';
import {
  WANQIAO_V6_DEFINITION as definition, WANQIAO_SKILL_ID as skillId,
  WANQIAO_STATUS_ID as statusId, WANQIAO_RESOURCE_ID as resourceId,
} from '@daoyou/game-content/sects/wanqiao';
import { JIUJIE_V6_DEFINITION, JIUJIE_STATUS_ID } from '@daoyou/game-content/sects/jiujie';
import { COMBAT_V6_CHARACTER_BUILD_VERSIONS as versions } from '@daoyou/game-domain/combat';
import type { MeridianNodeDefV6, SectCombatProgressV6 } from '@daoyou/game-domain/combat';
import { compileSectDefinitionV6 } from '../sects/compiler.js';
import { createDaoyouRuleset, daoyouFormulasV3 } from './daoyou/index.js';

type Path = 'resonance' | 'subtlety';

function project(pathName: Path = 'resonance', positions: string[] = [], breathLevel = 180) {
  const path = definition.paths.find(p => p.id.endsWith(`.${pathName}`))!;
  const chosen = positions.map(position => {
    const [layer, slot] = position.split('.').map(Number);
    const node = path.nodes.find(n => n.layer === layer && n.slot === slot && !n.automatic);
    if (!node) throw new Error(`Unknown node ${pathName}/${position}`);
    return node;
  });
  const depth = Math.max(0, ...chosen.map(n => n.layer));
  const findRoute = (layer: number, route: MeridianNodeDefV6[]): MeridianNodeDefV6[] | undefined => {
    if (layer > depth) return route;
    const required = chosen.find(n => n.layer === layer);
    const candidates = required ? [required] : [2, 1, 3].flatMap(slot => path.nodes.filter(n => n.layer === layer && n.slot === slot && !n.automatic));
    for (const node of candidates) {
      if (route.length && Math.abs(route.at(-1)!.slot - node.slot) > 1) continue;
      const found = findRoute(layer + 1, [...route, node]);
      if (found) return found;
    }
    return undefined;
  };
  const route = findRoute(1, []);
  if (!route) throw new Error(`Disconnected route ${pathName}/${positions.join(',')}`);
  const progress: SectCombatProgressV6 = {
    version: 1, sectId: 'wanqiao', activePathId: path.id,
    methods: Object.fromEntries(definition.methods.map(m => [m.id, m.slot === 6 ? breathLevel : 180])),
    meridianDepth: depth as SectCombatProgressV6['meridianDepth'],
    meridianLoadouts: [
      { pathId: definition.paths[0].id, revision: 0, nodeIds: path.id === definition.paths[0].id ? route.map(n => n.id) : [] },
      { pathId: definition.paths[1].id, revision: 0, nodeIds: path.id === definition.paths[1].id ? route.map(n => n.id) : [] },
    ],
  };
  const result = compileSectDefinitionV6({ definition, progress, characterLevel: 180 });
  if (!result.ok) throw new Error(JSON.stringify(result.diagnostics));
  return result.projection;
}

const attrs = { hp: 10000, maxHp: 10000, mp: 100000, maxMp: 100000, speed: 1000,
  physicalAtk: 1000, physicalDef: 300, magicAtk: 1000, magicDef: 300, critRate: 0, spellCritRate: 0 };

function musician(id: string, projection: ReturnType<typeof project>, slot = 0): LineupUnit {
  return { id, name: id, side: 0, kind: 'player', level: 180, slot,
    attrs: { ...attrs, speed: 1000 - slot }, tags: projection.unitTags,
    skills: projection.activeSkillIds, passives: projection.passiveSkillIds,
    skillLevels: projection.skillLevels, skillOverrides: projection.skillOverrides,
    combatFacts: { wanqiao_undertone_level: 180 },
    resources: projection.resources };
}

function setup(path: Path = 'resonance', positions: string[] = [], options: { breathLevel?: number; seed?: number; secondMusician?: boolean } = {}) {
  const projection = project(path, positions, options.breathLevel);
  const input: CreateBattleInput = {
    seed: options.seed ?? 19, versions,
    ruleset: { ...createDaoyouRuleset({ maxRounds: 30, formulas: { ...daoyouFormulasV3,
      physicalHitChance: () => 1, spellHitChance: () => 1, sealHitChance: () => 1,
      fluctuationMin: 1, fluctuationMax: 1, physicalFluctuationMin: 1, physicalFluctuationMax: 1, defendPhysicalFactor: 1 } }),
      deferredPlayerCommands: true },
    skills: [...projection.skills], statusDefs: [...projection.statusDefs],
    units: [musician('s', projection), options.secondMusician ? musician('a', projection, 1) :
      { id: 'a', name: '同伴', side: 0, kind: 'player', level: 180, attrs: { ...attrs, speed: 500 } },
      ...Array.from({ length: 6 }, (_, slot) => ({ id: `t${slot}`, name: '敌手', side: 1 as const,
        kind: 'player' as const, level: 180, slot, attrs: { ...attrs, hp: 100000, maxHp: 100000, speed: 100 - slot } }))],
  };
  return { input, projection };
}

type Battle = ReturnType<typeof createBattle>;
function round(battle: Battle, commands: Record<string, Command> = {}) {
  for (const unit of battle.state.units) if (!unit.flags.dead && !unit.flags.downed && !unit.flags.benched && !unit.flags.escaped)
    battle.submit(unit.id, commands[unit.id] ?? { type: 'defend' });
  battle.lockAndResolve();
}
const cast = (id: string, targets = ['t0']): Command => ({ type: 'skill', skillId: id, targets });
const breath = (battle: Battle, id = 's') => battle.unit(id).resources.find(r => r.id === resourceId.Breath)!;
const echo = (battle: Battle, target = 't0', source = 's') => battle.unit(target).statuses.find(s => s.id === statusId.Echo && s.sourceId === source);
const noProc = () => vi.spyOn(SeededRng.prototype, 'chance').mockImplementation(p => p >= 1);
const everyProc = () => vi.spyOn(SeededRng.prototype, 'chance').mockImplementation(p => p > 0);
const directHits = (battle: Battle, cursor = 0) => battle.log().slice(cursor).filter(e => e.type === 'damage' && e.sourceId === 's' && e.kind === 'spell');
afterEach(() => vi.restoreAllMocks());

describe('万窍山真实技能与经脉战斗组合', () => {
  it('裂帛扣息后刷新法攻，回护只按实际消耗生成一次护盾', () => {
    noProc();
    const { input } = setup('resonance', ['1.2']);
    const battle = createBattle(input);
    expect(breath(battle).current).toBe(3);
    breath(battle).current = 6;
    const attacks: number[] = [];
    battle.hooks.on('onHitCalc', h => { if (h.source?.id === 's') attacks.push(effectiveAttrs(h.source).magicAtk); });
    round(battle, { s: cast(skillId.Pierce) });
    expect(attacks).toEqual([1030]);
    expect(breath(battle).current).toBe(3);
    expect(effectiveAttrs(battle.unit('s')).magicAtk).toBe(1030);
    expect(battle.unit('s').barriers.reduce((sum, b) => sum + b.current, 0)).toBe(1080);
    expect(battle.unit('s').attrs.mp).toBe(attrs.mp - 30);
  });

  it.each([false, true])('群法复响沿用原目标而不补选，一次付费与追击扣息，原主目标倒地=%s', downed => {
    everyProc();
    const { input } = setup('resonance', ['1.2', '2.1']);
    if (downed) input.units.find(unit => unit.id === 't5')!.attrs.hp = 1;
    const battle = createBattle(input);
    const attacks: number[] = [];
    battle.hooks.on('onHitCalc', h => { if (h.source?.id === 's') attacks.push(effectiveAttrs(h.source).magicAtk); });
    round(battle, { s: cast(skillId.Chorus, ['t5']) });
    const hits = directHits(battle);
    expect(hits).toHaveLength(downed ? 9 : 10);
    const targets = hits.map(e => e.type === 'damage' ? e.targetId : '');
    expect(targets.slice(0, 5).filter(id => !downed || id !== 't5')).toEqual(targets.slice(5));
    expect(new Set(targets).size).toBe(5);
    expect(targets[0]).toBe('t5');
    expect(attacks).toEqual([...Array(5).fill(1030), ...Array(downed ? 4 : 5).fill(1020)]);
    expect(breath(battle).current).toBe(2);
    expect(battle.unit('s').attrs.mp).toBe(attrs.mp - 150);
    expect(battle.unit('s').barriers.reduce((sum, b) => sum + b.current, 0)).toBe(360);
  });

  it('法力不足不会先消耗窍息、生成回护或执行技能附属效果', () => {
    noProc();
    const battle = createBattle(setup('resonance', ['1.2']).input);
    breath(battle).current = 6;
    battle.unit('s').attrs.mp = 29;
    expect(battle.queryCommands('s').skills.find(s => s.skillId === skillId.Pierce)?.costs.mp).toBe(30);
    round(battle, { s: cast(skillId.Pierce) });
    expect(breath(battle).current).toBe(6);
    expect(battle.unit('s').attrs.mp).toBe(29);
    expect(battle.unit('s').barriers).toEqual([]);
    expect(battle.unit('s').skillUses?.[skillId.Pierce] ?? 0).toBe(0);
  });

  it.each([
    { targetStatus: undefined, spent: 0 },
    { targetStatus: JIUJIE_STATUS_ID.Electric, spent: 0 },
    { targetStatus: JIUJIE_STATUS_ID.RestMinor, spent: 2 },
    { targetStatus: JIUJIE_STATUS_ID.RestMajor, spent: 2 },
  ])('随隙识别真实调息状态，不把普通减益当作调息：$targetStatus', ({ targetStatus, spent }) => {
    noProc();
    const { input } = setup('subtlety', ['3.3']);
    input.statusDefs!.push(...JIUJIE_V6_DEFINITION.statuses);
    const battle = createBattle(input);
    if (targetStatus) battle.applyStatus('t0', targetStatus, 2, 't0');
    round(battle, { s: cast(skillId.Fissure) });
    expect(battle.unit('s').combatFacts?.wanqiao_spent).toBe(spent);
    expect(breath(battle).current).toBe(3 - spent);
    expect(battle.unit('s').attrs.mp).toBe(attrs.mp - 30);
  });

  it('基础偶数轮恢复与凝听互斥，资源恢复后法攻状态同步', () => {
    noProc();
    const plain = createBattle(setup().input);
    const concentrated = createBattle(setup('resonance', ['1.1']).input);
    round(plain); round(concentrated);
    breath(plain).current = 0; breath(concentrated).current = 0;
    round(plain); round(concentrated);
    expect([breath(plain).current, breath(concentrated).current]).toEqual([1, 0]);
    expect([effectiveAttrs(plain.unit('s')).magicAtk, effectiveAttrs(concentrated.unit('s')).magicAtk]).toEqual([1010, 1000]);
  });

  it('潜籁按行动前已有留音返息，多目标及复响不重复返还或刷新旧咒年龄', () => {
    everyProc();
    const { input } = setup('subtlety');
    input.units[0]!.combatFacts!.wanqiao_undertone_level = 120;
    input.units[0]!.skillLevels = { ...input.units[0]!.skillLevels, [skillId.Echo]: 120 };
    const battle = createBattle(input);
    const afterActions: number[] = [];
    battle.hooks.on('afterAction', h => { if (h.source?.id === 's') afterActions.push(breath(battle).current); });
    round(battle, { s: cast(skillId.Undertone) });
    expect(afterActions).toEqual([3]);
    const affected = battle.state.units.filter(u => u.side === 1 && echo(battle, u.id));
    expect(affected).toHaveLength(5);
    expect(affected.every(u => echo(battle, u.id)!.stacks === 1)).toBe(true);
    expect(battle.log().filter(e => e.type === 'damage' && e.sourceId === 's' && e.kind === 'fixed')
      .map(e => e.type === 'damage' ? e.amount : 0)).toEqual(Array(5).fill(60));
    round(battle, { s: cast(skillId.Undertone) });
    expect(afterActions).toEqual([3, 4]);
    expect(breath(battle).current).toBe(5);
    expect(affected.every(u => echo(battle, u.id)!.appliedRound === 1 && echo(battle, u.id)!.remainingRounds === 2)).toBe(true);
    expect(battle.unit('s').attrs.mp).toBe(attrs.mp - 300);
  });

  it('伏声只提高复响挂咒率，五目标共耗一息而非每目标付费', () => {
    vi.spyOn(SeededRng.prototype, 'chance').mockImplementation(p => p >= 1 || Math.abs(p - 0.02) < 1e-9 || Math.abs(p - 0.25) < 1e-9);
    const battle = createBattle(setup('subtlety', ['2.1']).input);
    round(battle, { s: cast(skillId.Undertone) });
    const rolls = battle.log().filter(e => e.type === 'chanceResolved');
    expect(rolls.filter(e => e.type === 'chanceResolved' && Math.abs(e.chance - 0.2) < 1e-9)).toHaveLength(5);
    expect(rolls.filter(e => e.type === 'chanceResolved' && Math.abs(e.chance - 0.25) < 1e-9)).toHaveLength(5);
    expect(battle.state.units.filter(u => u.side === 1 && echo(battle, u.id))).toHaveLength(5);
    expect(breath(battle).current).toBe(2);
    expect(battle.unit('s').attrs.mp).toBe(attrs.mp - 150);
  });

  it('两位音修的留音、引响和驱散各自独立，强化只影响本人咒印', () => {
    noProc();
    const { input } = setup('subtlety', [], { secondMusician: true });
    const dispel: SkillDef = { id: 'test.dispel', name: '驱散', tags: ['support'], targeting: { side: 'enemy' },
      effects: [{ type: 'dispel', statusIds: [statusId.Echo], maxCount: 1 }] };
    input.skills!.push(dispel); input.units[1]!.skills = [...input.units[1]!.skills!, dispel.id];
    const battle = createBattle(input);
    round(battle, { s: cast(skillId.Echo), a: cast(skillId.Echo) });
    expect([echo(battle)!.stacks, echo(battle, 't0', 'a')!.stacks]).toEqual([1, 1]);
    const cursor = battle.log().length;
    round(battle, { s: cast(skillId.Catalyze) });
    const damage = battle.log().slice(cursor).filter(e => e.type === 'damage' && e.targetId === 't0');
    expect(damage.filter(e => e.type === 'damage' && e.sourceId === 's').map(e => e.type === 'damage' ? e.amount : 0)).toEqual([180, 381]);
    expect(damage.filter(e => e.type === 'damage' && e.sourceId === 'a').map(e => e.type === 'damage' ? e.amount : 0)).toEqual([180]);
    round(battle, { a: cast(dispel.id) });
    expect(echo(battle)).toBeUndefined();
    expect(echo(battle, 't0', 'a')).toBeDefined();
    expect(battle.unit('t0').statuses.some(s => s.id === statusId.Amplified && s.sourceId === 's')).toBe(false);
  });

  it('内和驱散恢复使用剩余轮数与原施放心法级，后改技能级不追溯', () => {
    noProc();
    const { input } = setup('resonance', ['6.2'], { breathLevel: 130 });
    const dispel: SkillDef = { id: 'test.dispel', name: '驱散', tags: ['support'], targeting: { side: 'enemy' },
      effects: [{ type: 'dispel', statusIds: [statusId.Harmony], maxCount: 1 }] };
    input.skills!.push(dispel); input.units[2]!.skills = [dispel.id];
    const battle = createBattle(input);
    battle.unit('s').attrs.hp = 5000;
    round(battle, { s: cast(skillId.Harmony, ['s']) });
    battle.unit('s').skillLevels[skillId.Harmony] = 180;
    round(battle, { t0: cast(dispel.id, ['s']) });
    expect(battle.unit('s').attrs.hp).toBe(5520);
    expect(battle.unit('s').attrs.mp).toBe(attrs.mp - 25);
    expect(battle.unit('s').statuses.some(s => s.id === statusId.Harmony)).toBe(false);
  });

  it.each([1000, 1])('截声冻结只限制下一完整回合，施术者速度=%i', speed => {
    vi.spyOn(SeededRng.prototype, 'chance').mockImplementation(p => p >= 1 || Math.abs(p - 0.2) < 1e-9);
    const { input } = setup();
    const probe: SkillDef = { id: 'test.probe', name: '攻击', tags: ['spell'], targeting: { side: 'enemy' }, effects: [{ type: 'fixedHit', power: 17 }] };
    input.skills!.push(probe); input.units[2]!.skills = [probe.id];
    input.units[0]!.attrs.speed = speed; input.units[2]!.kind = 'pet'; input.units[2]!.ownerId = 't1';
    const battle = createBattle(input);
    round(battle, { s: cast(skillId.Silence), t0: cast(probe.id, ['s']) });
    expect(battle.unit('s').attrs.hp).toBe(attrs.hp - 17);
    round(battle, { t0: cast(probe.id, ['s']) });
    expect(battle.unit('s').attrs.hp).toBe(attrs.hp - 17);
    round(battle, { t0: cast(probe.id, ['s']) });
    expect(battle.unit('s').attrs.hp).toBe(attrs.hp - 34);
  });

  it('泣血吟只支付一次气血且次轮仅禁法，仍可普攻防御', () => {
    noProc();
    const battle = createBattle(setup().input);
    round(battle, { s: cast(skillId.Blood) });
    expect(battle.unit('s').attrs.hp).toBe(8000);
    expect(battle.queryCommands('s').skills.find(s => s.skillId === skillId.Chorus)?.ready).toBe(false);
    expect(battle.queryCommands('s').canDefend).toBe(true);
    const before = battle.unit('t0').attrs.hp;
    round(battle, { s: { type: 'attack', target: 't0' } });
    expect(battle.unit('t0').attrs.hp).toBeLessThan(before);
    expect(battle.queryCommands('s').skills.find(s => s.skillId === skillId.Chorus)?.ready).toBe(true);
    expect(battle.unit('s').attrs.hp).toBe(8000);
  });

  it('无声之章以seed处理半层预算，逐层跳过满层者且不吞其他来源层数', () => {
    const budgets = new Set<number>();
    for (let seed = 1; seed <= 20; seed++) {
      const battle = createBattle(setup('subtlety', ['7.2'], { seed }).input);
      for (let i = 0; i < 3; i++) battle.applyStatus('t1', statusId.Echo, 4, 's');
      for (let i = 0; i < 3; i++) battle.applyStatus('t2', statusId.Echo, 4, 'a');
      round(battle, { s: cast(skillId.Coda) });
      const half = battle.log().find(e => e.type === 'chanceResolved' && e.chance === 0.5);
      expect(half).toBeDefined();
      const expected = 4 + (half?.type === 'chanceResolved' && half.success ? 1 : 0);
      const own = battle.state.units.flatMap(u => u.statuses.filter(s => s.id === statusId.Echo && s.sourceId === 's'));
      const allocated = own.reduce((sum, s) => sum + s.stacks, 0) - 3;
      budgets.add(allocated);
      expect(allocated).toBe(expected);
      expect(own.every(s => s.stacks <= 3)).toBe(true);
      expect(echo(battle, 't2', 'a')!.stacks).toBe(3);
      expect(breath(battle).current).toBe(0);
      expect(battle.unit('s').attrs.mp).toBe(attrs.mp - 100);
      expect(battle.unit('s').cooldowns?.[skillId.Coda]).toBe(9);
    }
    expect([...budgets].sort()).toEqual([4, 5]);
  });

  it('含虚真实技能先支付30法力，再以法力抵消盾后名义伤害', () => {
    noProc();
    const { input } = setup();
    const probe: SkillDef = { id: 'test.probe', name: '攻击', tags: ['spell'], targeting: { side: 'enemy' }, effects: [{ type: 'fixedHit', power: 101 }] };
    input.skills!.push(probe); input.units[2]!.skills = [probe.id];
    const battle = createBattle(input);
    battle.unit('s').attrs.mp = 70;
    round(battle, { s: cast(skillId.Hollow, ['s']), t0: cast(probe.id, ['s']) });
    expect(battle.unit('s').attrs.hp).toBe(attrs.hp - 61);
    expect(battle.unit('s').attrs.mp).toBe(0);
    const costs = battle.log().filter(e => e.type === 'mpCost' && e.unitId === 's');
    expect(costs.map(e => e.type === 'mpCost' ? [e.amount, e.absorbedDamage ?? 0] : [])).toEqual([[30, 0], [40, 40]]);
  });

  it('留音按完整固定公式计算名义伤害，含虚不因目标最大气血较低而少扣法力', () => {
    noProc();
    const { input } = setup('subtlety');
    input.units[2]!.attrs = { ...input.units[2]!.attrs, hp: 100, maxHp: 100, mp: 1000, maxMp: 1000 };
    const battle = createBattle(input);
    for (let i = 0; i < 3; i++) battle.applyStatus('t0', statusId.Echo, 4, 's');
    battle.applyStatus('t0', statusId.Hollow, 4, 't0');
    round(battle);
    expect(battle.log().filter(e => e.type === 'mpCost' && e.unitId === 't0'))
      .toEqual([{ type: 'mpCost', unitId: 't0', amount: 135, mpAfter: 865, absorbedDamage: 135, statusId: statusId.Hollow }]);
    expect(battle.log().filter(e => e.type === 'damage' && e.targetId === 't0'))
      .toEqual([{ type: 'damage', sourceId: 's', targetId: 't0', amount: 135, hpAfter: 0, kind: 'fixed' }]);
    expect(battle.unit('t0').flags.downed).toBe(true);
  });

  it('流韵在本次根行动完成后强化留音DOT，直伤与周期伤害各只计一次', () => {
    noProc();
    const improved = createBattle(setup('subtlety', ['5.2']).input);
    const plain = createBattle(setup('subtlety', ['5.1']).input);
    for (const battle of [improved, plain]) round(battle, { s: cast(skillId.Echo) });
    const bases = [0, 0];
    [improved, plain].forEach((battle, index) => battle.hooks.on('onHitCalc', h => {
      if (h.source?.id === 's' && h.skillId === skillId.Pierce) bases[index] = h.damage ?? 0;
    }));
    const cursors = [improved.log().length, plain.log().length];
    round(improved, { s: cast(skillId.Pierce) });
    round(plain, { s: cast(skillId.Pierce) });
    const damage = [improved, plain].map((battle, index) => battle.log().slice(cursors[index]).filter(e => e.type === 'damage' && e.sourceId === 's' && e.targetId === 't0'));
    const amount = (events: typeof damage[number], kind: 'spell' | 'fixed') => events.find(e => e.type === 'damage' && e.kind === kind);
    const improvedDirect = amount(damage[0]!, 'spell'); const plainDirect = amount(damage[1]!, 'spell');
    expect(bases[0]).toBe(bases[1]);
    expect(improvedDirect?.type === 'damage' && improvedDirect.amount).toBe(Math.floor(bases[0]! * 1.55));
    expect(plainDirect?.type === 'damage' && plainDirect.amount).toBe(Math.floor(bases[1]! * 1.45));
    expect(amount(damage[0]!, 'fixed')).toMatchObject({ amount: 216 });
    expect(amount(damage[1]!, 'fixed')).toMatchObject({ amount: 180 });
  });
});
