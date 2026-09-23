import { afterEach, describe, expect, it, vi } from 'vitest';
import { createBattle, effectiveAttrs, restoreBattle, SeededRng, type Command, type CreateBattleInput, type SkillDef } from '../core';
import { createEmptySectCombatProgressV6 } from '../build-state';
import { createDaoyouRuleset } from '../rules-daoyou';
import { COMBAT_V6_PHASE_6D_VERSIONS as versions } from '../version';
import { DAO_EQUIPMENT_ARTS_V1 } from '../equipment/special-content';
import { YOUDU_COMBAT } from './youdu-pack';
import { JIUJIE_V6_DEFINITION as definition } from './jiujie';
import { JIUJIE_COMBAT } from './jiujie-pack';
import { daoyouFormulas } from '../rules-daoyou/formulas';
import { compileSectDefinitionV6 } from './compiler';

const S = (x: string) => `jiujie.skill.${x}`;
const T = (x: string) => `jiujie.status.${x}`;
const R = 'jiujie.resource.charge';
const cmd = (x: string, targets = ['t']): Command => ({type:'skill', skillId:S(x), targets});
function setup(pathName = 'law', nodes: string[] = []) {
  const path = definition.paths.find(p=>p.id.endsWith('.'+pathName))!;
  const chosen = nodes.map(id=>path.nodes.find(n=>n.id.endsWith('.'+id))!);
  const depth = Math.max(0,...chosen.map(n=>n.layer));
  const chain = Array.from({length:depth},(_,i)=> chosen.find(n=>n.layer===i+1) ?? path.nodes.find(n=>n.layer===i+1 && n.slot===2)!);
  const progress = createEmptySectCombatProgressV6('jiujie', path.id, Object.fromEntries(definition.methods.map(m=>[m.id,180])));
  progress.meridianDepth = 7;
  progress.meridianLoadouts.find(l=>l.pathId===path.id)!.nodeIds=chain.map(n=>n.id);
  const result = compileSectDefinitionV6({definition,progress,characterLevel:180});
  if(!result.ok) throw new Error(JSON.stringify(result));
  const p=result.projection;
  const attrs = {hp:100000,maxHp:100000,mp:100000,maxMp:100000,speed:1000,physicalAtk:1000,physicalDef:300,magicAtk:1000,magicDef:300,critRate:0,spellCritRate:0};
  const input:CreateBattleInput = {seed:19,versions,ruleset:createDaoyouRuleset({formulas:{physicalHitChance:()=>1,spellHitChance:()=>1,sealHitChance:()=>1,fluctuationMin:1,fluctuationMax:1,physicalFluctuationMin:1,physicalFluctuationMax:1}}),skills:[...p.skills,...DAO_EQUIPMENT_ARTS_V1.map(a=>a.skill)],statusDefs:[...p.statusDefs,...YOUDU_COMBAT.statuses],units:[
    {id:'s',name:'九劫',side:0,kind:'player',level:180,attrs,tags:p.unitTags,skills:p.activeSkillIds,passives:p.passiveSkillIds,skillLevels:p.skillLevels,skillOverrides:p.skillOverrides,resources:[...p.resources,{id:'combat.resource.rage',name:'战意',current:150,max:150}],combatFacts:{thunderMethodLevel:180,spiritPoints:100,lingyaoMagicAtk:80}},
    {id:'a',name:'队友',side:0,kind:'player',level:180,attrs:{...attrs,speed:500}},
    ...Array.from({length:6},(_,i)=>({id:i?'t'+i:'t',name:'敌人',side:1 as const,kind:'player' as const,level:180,attrs:{...attrs,speed:100-i}})),
  ]};
  return {b:createBattle(input),input,p};
}
type B=ReturnType<typeof setup>['b'];
function round(b:B, commands:Record<string,Command>={}) {
  for (const u of b.state.units) if(!u.flags.downed&&!u.flags.dead&&!u.flags.benched) b.submit(u.id,commands[u.id]??{type:'defend'});
  b.lockAndResolve();
}
const st=(b:B,id:string,name:string)=>b.unit(id).statuses.find(s=>s.id===T(name));
const res=(b:B)=>b.unit('s').resources.find(r=>r.id===R)!;
const noProc=()=>vi.spyOn(SeededRng.prototype,'chance').mockImplementation(p=>p>=1);
const restProc=()=>vi.spyOn(SeededRng.prototype,'chance').mockImplementation(p=>p>=0.5);
function grant(b:B,id:string) { b.unit('s').skills.push(id); }
const hits=(b:B,id='t')=>b.log().filter(e=>e.type==='damage' && e.sourceId==='s' && e.targetId===id).map(e=>e.type==='damage'?e.amount:0);
afterEach(()=>vi.restoreAllMocks());

describe('九劫还原修正回归', () => {
  it.each([true, false])('九劫归一依实际掠霆重数选人并支付对应法力（强化单体=%s）', single => {
    vi.spyOn(SeededRng.prototype, 'next').mockReturnValue(0);
    vi.spyOn(SeededRng.prototype, 'chance').mockImplementation(p => p >= 1 || (p === 0.5 && single));
    const { b } = setup('law', ['7.2']);
    b.unit('s').cooldowns![S('tribulation')] = 0;
    round(b, { s: cmd('tribulation', ['t3']) });
    const count = single ? 3 : 5;
    expect(b.unit('s').combatFacts!.jiujie_sweep_rank).toBe(single ? 1 : 3);
    expect(b.log().filter(e => e.type === 'damage' && e.sourceId === 's' && e.targetId !== 's')).toHaveLength(count);
    expect(hits(b, 't3')).toHaveLength(1);
    expect(b.unit('s').attrs.mp).toBe(100000 - (20 * count + 10));
  });

  it.each(['law', 'thunder'])('雷醒包含回合末持续伤害（%s）', path => {
    noProc();
    const { input } = setup(path, ['4.2']);
    input.statusDefs!.push({ id: 'test.dot', kind: 'test.dot', category: 'dot', ticks: 'roundEnd', onTick: { type: 'dot', ratioOfMaxHp: 0.3 } });
    const b = createBattle(input);
    b.applyStatus('s', T('suppress'), 5);
    b.applyStatus('s', 'youdu.status.soul_seal', 5);
    b.applyStatus('s', T('rest_minor'), 5);
    b.applyStatus('s', 'test.dot', 1);
    round(b);
    expect(b.unit('s').attrs.hp).toBe(70000);
    expect(st(b, 's', 'suppress')).toBeUndefined();
    expect(b.unit('s').statuses.some(s => s.id === 'youdu.status.soul_seal')).toBe(false);
    expect(st(b, 's', 'rest_minor')).toBeDefined();
    b.applyStatus('s', T('suppress'), 5);
    round(b);
    expect(st(b, 's', 'suppress')).toBeDefined();
  });

  it('雷醒包含反震掉血，护盾吸收与主动气血成本不计入', () => {
    noProc();
    const { input } = setup('law', ['4.2']);
    const reflect: SkillDef = { id: 'test.reflect', name: '反震', tags: ['passive'], targeting: { side: 'self' }, effects: [], hooks: [{ on: 'onBeHit', targetIsSelf: true, aim: 'hookSource', effects: [{ type: 'fixedHit', power: 30000 }] }] };
    input.skills!.push(reflect); input.units[2].passives = [reflect.id];
    const b = createBattle(input);
    b.applyStatus('s', T('suppress'), 5);
    round(b, { s: { type: 'attack', target: 't' } });
    expect(st(b, 's', 'suppress')).toBeUndefined();
    expect(b.unit('s').hpDamageThisRound).toEqual({ round: 1, amount: 30000 });
    b.applyStatus('s', T('suppress'), 5);
    b.unit('s').barriers.push({ id: 'test', kind: 'test', name: '护盾', sourceId: 's', current: 30000, remainingRounds: 3, appliedRound: b.state.round });
    round(b, { s: { type: 'attack', target: 't' } });
    expect(st(b, 's', 'suppress')).toBeDefined();
    round(b, { s: cmd('charge', ['s']) });
    expect(st(b, 's', 'suppress')).toBeDefined();
    expect(b.unit('s').hpDamageThisRound).toEqual({ round: 1, amount: 30000 });
  });

  it('九劫归一蓝不足不执行准备；最高掠霆可覆盖七人且只消费一层灌注', () => {
    noProc();
    const { input } = setup('law', ['7.2']);
    input.units.push({ ...input.units[2], id: 't6' });
    const b = createBattle(input);
    b.unit('s').cooldowns![S('tribulation')] = 0;
    res(b).current = 2;
    b.unit('s').attrs.mp = 149;
    const rngBefore = b.snapshot().rngState;
    expect(b.queryCommands('s').skills.find(s => s.skillId === S('tribulation'))?.ready).toBe(false);
    expect(b.snapshot().rngState).toBe(rngBefore);
    round(b, { s: cmd('tribulation') });
    expect(b.unit('s').attrs.hp).toBe(100000);
    expect(res(b).current).toBe(2);
    expect(b.unit('s').combatFacts?.jiujie_single_rank).toBeUndefined();
    b.unit('s').attrs.mp = 150;
    vi.spyOn(SeededRng.prototype, 'next').mockReturnValue(0.999);
    round(b, { s: cmd('tribulation', ['t6']) });
    expect(b.unit('s').combatFacts!.jiujie_sweep_rank).toBe(5);
    expect(b.unit('s').attrs.mp).toBe(0);
    expect(res(b).current).toBe(1);
    const action = b.log().find(e => e.type === 'actionStart' && e.command.type === 'skill' && e.command.skillId === S('tribulation'));
    if (action?.type !== 'actionStart' || action.command.type !== 'skill') throw new Error('缺少大招行动');
    expect(action.command.targets).toHaveLength(7);
    expect(action.command.targets[0]).toBe('t6');
  });

  it.each(['physicalHit', 'fixedHit'] as const)('赤印被%s命中后退化，但不额外增伤', type => {
    noProc();
    const { b } = setup('thunder');
    const hit: SkillDef = { id: 'test.nonspell', name: '非术法打击', tags: ['physical'], targeting: { side: 'enemy' }, effects: [{ type, power: 1000, coeff: 1 }] };
    const red: SkillDef = { id: 'test.red', name: '赤印', tags: ['spell'], targeting: { side: 'enemy' }, effects: [{ type: 'applyStatus', statusId: T('red'), duration: 5 }] };
    for (const s of [hit, red]) { grant(b, s.id); b.unit('s').skillOverrides[s.id] = s; }
    round(b, { s: { type: 'skill', skillId: red.id, targets: ['t'] } });
    round(b, { s: { type: 'skill', skillId: hit.id, targets: ['t'] } });
    expect(st(b, 't', 'red')).toBeUndefined();
    expect(st(b, 't', 'electric')).toBeDefined();
    round(b, { s: { type: 'skill', skillId: hit.id, targets: ['t'] } });
    expect(hits(b)[0]).toBe(hits(b)[1]);
  });

  it('共鸣在主人倒地后继续强化本人灵兽', () => {
    noProc();
    const { input } = setup('thunder', ['5.1']);
    const spell: SkillDef = { id: 'beast.thunder', name: '雷击', tags: ['spell'], targeting: { side: 'enemy' }, effects: [{ type: 'spellHit', coeff: 1 }] };
    input.skills!.push(spell);
    input.units.push({ id: 'pet', name: '本宠', side: 0, kind: 'pet', ownerId: 's', attrs: { hp: 10000, mp: 1000, speed: 300, magicAtk: 1000 }, skills: [spell.id] });
    const b = createBattle(input);
    round(b, { pet: { type: 'skill', skillId: spell.id, targets: ['t'] } });
    b.unit('s').attrs.hp = 0; b.unit('s').flags.downed = true;
    round(b, { pet: { type: 'skill', skillId: spell.id, targets: ['t'] } });
    const damage = b.log().filter(e => e.type === 'damage' && e.sourceId === 'pet');
    expect(damage).toHaveLength(2);
    if (damage[0].type === 'damage' && damage[1].type === 'damage') expect(damage[1].amount).toBe(damage[0].amount);
  });

  it('以身承雷同时提供物理收益、法伤与封印代价，固伤不受影响', () => {
    noProc();
    const damage = (foundation: boolean, type: 'physicalHit' | 'spellHit' | 'fixedHit') => {
      const { b } = setup('law');
      if (!foundation) b.unit('s').passives = b.unit('s').passives.filter(id => id !== 'jiujie.passive.physical');
      const hit: SkillDef = { id: 'test.foundation', name: '测试', tags: [type === 'spellHit' ? 'spell' : 'physical'], targeting: { side: 'enemy' }, effects: [{ type, coeff: 1, power: 1000 }] };
      grant(b, hit.id); b.unit('s').skillOverrides[hit.id] = hit;
      round(b, { s: { type: 'skill', skillId: hit.id, targets: ['t'] } });
      return hits(b)[0];
    };
    expect(damage(true, 'physicalHit') / damage(false, 'physicalHit')).toBeCloseTo(1.1, 2);
    expect(damage(true, 'spellHit') / damage(false, 'spellHit')).toBeCloseTo(0.85, 2);
    expect(damage(true, 'fixedHit')).toBe(damage(false, 'fixedHit'));
    const { b } = setup('law');
    const chance = vi.spyOn(SeededRng.prototype, 'chance');
    round(b, { s: cmd('suppress') });
    expect(chance).toHaveBeenCalledWith(0.85);
  });

  it.each([100, 180])('洞真在%s级按本项目封印量纲增益，双向均不直接顶满概率', level => {
    noProc();
    const { b } = setup('thunder', ['6.1']);
    b.unit('s').level = level; b.unit('t').level = level;
    const source = b.unit('s'), target = b.unit('t');
    const beforeHit = daoyouFormulas.sealHitChance(source, target, level);
    const beforeResist = daoyouFormulas.sealHitChance(target, source, level);
    round(b, { s: cmd('insight', ['s']) });
    const enhanced = { ...source, attrs: effectiveAttrs(source) };
    expect(daoyouFormulas.sealHitChance(enhanced, target, level) - beforeHit).toBeCloseTo(level / 2000);
    expect(beforeResist - daoyouFormulas.sealHitChance(target, enhanced, level)).toBeCloseTo(level / 2000);
  });
});

describe('九劫基础循环与指令',()=>{
  it('一重稳定出手；二重休息禁门派技能，允许普攻和器诀',()=>{
    restProc(); const {b}=setup(); grant(b,'dao_equipment.skill.diefeng');
    round(b,{s:cmd('strike_1')}); expect(st(b,'s','rest_minor')).toBeUndefined();
    round(b,{s:cmd('strike_2')}); expect(st(b,'s','rest_minor')).toBeDefined();
    const o=b.queryCommands('s');
    expect(o.attackTargetIds.length).toBeGreaterThan(0);
    expect(o.skills.find(s=>s.skillId===S('strike_1'))?.ready).toBe(false);
    expect(o.skills.find(s=>s.skillId==='dao_equipment.skill.diefeng')?.ready).toBe(true);
    const mp=b.unit('s').attrs.mp;round(b,{s:cmd('strike_1')});expect(b.unit('s').attrs.mp).toBe(mp);
    expect(b.log().some(e=>e.type==='actionFailed'&&e.reason==='command-restricted')).toBe(true);
  });
  it('三重休息只有防御；净化不能解除休息',()=>{
    restProc();const {b}=setup();round(b,{s:cmd('strike_3')});
    expect(st(b,'s','rest_major')).toBeDefined();
    const o=b.queryCommands('s');expect(o.canDefend).toBe(true);expect(o.attackTargetIds).toEqual([]);expect(o.canFlee).toBe(false);expect(o.skills.every(s=>!s.ready)).toBe(true);
    const calm=JIUJIE_COMBAT.skill(S('calm')).definition; b.unit('a').skills.push(calm.id);b.unit('a').skillOverrides[calm.id]=calm;
    b.unit('a').attrs.speed=2000;
    round(b,{a:{type:'skill',skillId:calm.id,targets:['s']},s:cmd('strike_1')});
    expect(b.log().filter(e=>e.type==='actionFailed'&&e.unitId==='s')).toHaveLength(1);
  });
  it('实际升重参与休息和人数，灌注每次只花一层',()=>{
    restProc();const {b}=setup();res(b).current=3;
    round(b,{s:cmd('sweep_1')});expect(res(b).current).toBe(2);expect(st(b,'s','rest_minor')).toBeDefined();
    expect(b.log().filter(e=>e.type==='damage'&&e.sourceId==='s')).toHaveLength(4);
  });
  it('五雷失败不削蓝，成功扣当前气血并按人物等级封顶',()=>{
    for(const success of [false,true]) {
      vi.restoreAllMocks();vi.spyOn(SeededRng.prototype,'chance').mockImplementation(p=>p===0.5?success:p>=1);
      const {b}=setup();b.unit('s').level=10;b.unit('s').skillLevels[S('five_thunder')]=180;
      round(b,{s:cmd('five_thunder')});
      expect(b.unit('t').attrs.mp).toBe(success?75000:100000);
      expect(hits(b)[0]).toBe(success?500:5000);
    }
  });
  it('禁诀不封门派技，封兵只禁普攻，乱神不随机物理技能目标',()=>{
    noProc();const {b}=setup();grant(b,'dao_equipment.skill.diefeng');
    for(const kind of ['suppress','million_weapons','confuse']) {
      const cast:SkillDef={id:'test.'+kind,name:'封印',tags:['spell'],targeting:{side:'enemy'},effects:[{type:'applyStatus',statusId:T(kind),duration:3}]};
      b.unit('t').skills.push(cast.id);b.unit('t').skillOverrides[cast.id]=cast;
    }
    round(b,{t:{type:'skill',skillId:'test.suppress',targets:['s']}});
    expect(b.queryCommands('s').skills.find(s=>s.skillId==='dao_equipment.skill.diefeng')?.ready).toBe(false);
    expect(b.queryCommands('s').skills.find(s=>s.skillId===S('strike_1'))?.ready).toBe(true);
    round(b,{t:{type:'skill',skillId:'test.million_weapons',targets:['s']}});
    expect(b.queryCommands('s').attackTargetIds).toEqual([]);
    expect(b.queryCommands('s').skills.find(s=>s.skillId===S('strike_1'))?.ready).toBe(true);
    round(b,{t:{type:'skill',skillId:'test.confuse',targets:['s']}});
    const physical:SkillDef={id:'test.physical',name:'物理技能',tags:['physical'],targeting:{side:'enemy'},effects:[{type:'physicalHit',coeff:1}]};
    b.unit('s').skills.push(physical.id);b.unit('s').skillOverrides[physical.id]=physical;
    round(b,{s:{type:'skill',skillId:physical.id,targets:['t3']}});expect(hits(b,'t3')).toHaveLength(1);
  });
  it('天罡护法持续保护物理攻击，法术不分担且不净化',()=>{
    noProc();const {b}=setup();
    round(b,{s:cmd('protection',['a'])});
    round(b,{t:{type:'attack',target:'a'}});
    expect(b.log().some(e=>e.type==='protectTrigger'&&e.protectorId==='s'&&e.originalTargetId==='a')).toBe(true);
    expect(st(b,'a','protection')).toBeDefined();expect(b.unit('s').attrs.mp).toBe(99960);
  });
  it('乱神下施法失败转普攻时仍随机选目标，允许误击队友',()=>{
    noProc(); const {b}=setup();
    b.applyStatus('s',T('confuse'),3);
    // 场上首个可随机攻击对象是队友 a；原指令仍指定敌人 t。
    vi.spyOn(SeededRng.prototype,'next').mockReturnValue(0);
    round(b,{s:cmd('five_thunder')});
    expect(b.log().some(e=>e.type==='actionFailed'&&e.unitId==='s'&&e.reason==='sealed')).toBe(true);
    expect(hits(b,'a')).toHaveLength(1);
    expect(hits(b,'t')).toHaveLength(0);
  });
  it('定神雷音只解除一种常规封印，并给予两回合类别免疫',()=>{
    noProc();const {b}=setup();
    const caster:SkillDef={id:'test.seals',name:'双封',tags:['spell'],targeting:{side:'enemy'},effects:[{type:'applyStatus',statusId:T('suppress'),duration:5},{type:'applyStatus',statusId:T('million_weapons'),duration:5}]};
    b.unit('t').skills.push(caster.id);b.unit('t').skillOverrides[caster.id]=caster;
    round(b,{t:{type:'skill',skillId:caster.id,targets:['a']}});
    round(b,{s:cmd('calm',['a']),t:{type:'skill',skillId:caster.id,targets:['a']}});
    expect(b.unit('a').statuses.filter(s=>s.id===T('suppress')||s.id===T('million_weapons'))).toHaveLength(1);
    expect(Object.values(b.unit('a').flags.statusImmunityThroughRound??{})).toEqual([4]);
  });
});

describe('九劫灌注与霹雳经脉',()=>{
  it('雷吞按金风雷件数增加灌注，主动消耗25%当前气血',()=>{
    noProc();const {b}=setup('law',['4.1']);b.unit('s').combatFacts!.metalWindThunderEquipmentCount=2;
    round(b,{s:cmd('charge',['s'])});expect(res(b).current).toBe(3);expect(b.unit('s').attrs.hp).toBe(75000);
  });
  it('天劫只赠一次灌注；驭雷只在主动灌注后增加战意',()=>{
    noProc();const {b}=setup('thunder',['3.2','4.3']);b.unit('s').resources.find(r=>r.id==='combat.resource.rage')!.current=0;
    round(b,{s:cmd('divine_guardian',['s'])});round(b,{s:cmd('divine_guardian',['s'])});
    expect(res(b).current).toBe(1);expect(b.unit('s').resources.find(r=>r.id==='combat.resource.rage')!.current).toBe(0);
    round(b,{s:cmd('charge',['s'])});expect(b.unit('s').resources.find(r=>r.id==='combat.resource.rage')!.current).toBe(10);
  });
  it('余韵与灌注分别升重，双剑器诀不凭空获得',()=>{
    noProc();const {b}=setup('law',['2.2']);expect(b.unit('s').skills).not.toContain('dao_equipment.skill.diefeng');
    grant(b,'dao_equipment.skill.diefeng');round(b,{s:{type:'skill',skillId:'dao_equipment.skill.diefeng',targets:['t']}});
    res(b).current=1;round(b,{s:cmd('strike_1')});expect(b.unit('s').combatFacts!.jiujie_rank).toBe(3);expect(b.unit('s').combatFacts!.jiujie_echo).toBe(0);expect(res(b).current).toBe(0);
  });
  it('疾雷连续两次免休后生效，真正休息才清除',()=>{
    noProc();const {b}=setup('law',['1.2']);round(b,{s:cmd('strike_2')});round(b,{s:cmd('strike_2')});expect(b.unit('s').combatFacts!.jiujie_streak).toBe(2);
    round(b,{s:cmd('strike_2')});expect(hits(b)[2]).toBeGreaterThan(hits(b)[1]);
    vi.restoreAllMocks();restProc();round(b,{s:cmd('strike_2')});expect(b.unit('s').combatFacts!.jiujie_streak).toBe(0);
  });
  it('电光按强化后的重数判定，已升三重不重复升',()=>{
    vi.spyOn(SeededRng.prototype,'chance').mockImplementation(p=>p===0.18||p>=1);
    const {b}=setup('law',['3.3']);round(b,{s:cmd('strike_1')});expect(b.unit('s').combatFacts!.jiujie_rank).toBe(2);
    res(b).current=1;round(b,{s:cmd('strike_2')});expect(b.unit('s').combatFacts!.jiujie_rank).toBe(3);
  });
  it('劫后逢生有护体条件且每场仅一次',()=>{
    noProc();const {b}=setup('law',['6.1']);round(b,{s:cmd('divine_guardian',['s'])});
    b.unit('s').attrs.hp=10;b.unit('t').attrs.physicalAtk=100000;
    round(b,{s:cmd('five_thunder'),t:{type:'attack',target:'s'}});expect(b.unit('s').attrs.hp).toBe(10000);expect(b.unit('s').flags.downed).toBe(false);
    round(b,{t:{type:'attack',target:'s'}});expect(b.unit('s').flags.downed).toBe(true);
  });
  it('九劫归一自损可致死、中断输出，且入场4回合冷却',()=>{
    noProc();const {b}=setup('law',['7.2']);expect(b.queryCommands('s').skills.find(s=>s.skillId===S('tribulation'))?.ready).toBe(false);
    b.unit('s').cooldowns![S('tribulation')]=0;b.unit('s').attrs.hp=1;
    round(b,{s:cmd('tribulation')});expect(b.unit('s').flags.downed).toBe(true);expect(hits(b)).toHaveLength(0);
  });
  it('九劫归一分别形成震岳与掠霆重数，并保留分段伤害',()=>{
    noProc();const {b}=setup('law',['7.2']);b.unit('s').cooldowns![S('tribulation')]=0;
    round(b,{s:cmd('tribulation')});expect(hits(b)).toHaveLength(1);expect(hits(b,'t1')).toHaveLength(1);
    expect(b.unit('s').combatFacts!.jiujie_single_rank).toBeGreaterThanOrEqual(1);expect(b.unit('s').combatFacts!.jiujie_sweep_rank).toBeLessThanOrEqual(5);
    expect(b.log().filter(e=>e.type==='damage'&&e.targetId==='s').length).toBeGreaterThanOrEqual(2);
  });
});

describe('踏雷雷印与经脉',()=>{
  it('首发铺印不追溯增伤；后续+12%，普通雷印不叠层',()=>{
    noProc();const {b}=setup('thunder');round(b,{s:cmd('thunderstorm')});round(b,{s:cmd('thunderstorm')});
    const values=hits(b);expect(values[1]/values[0]).toBeCloseTo(1.12,2);expect(st(b,'t','electric')?.stacks).toBe(1);expect(b.unit('t').statuses.filter(s=>s.id===T('electric'))).toHaveLength(1);
  });
  it('有灌注群雷六目标，六霄节点保留普通群雷灌注，主动六霄消耗',()=>{
    noProc();const {b}=setup('thunder',['4.1']);res(b).current=2;
    round(b,{s:cmd('thunderstorm')});expect(res(b).current).toBe(2);expect(b.log().filter(e=>e.type==='damage'&&e.sourceId==='s')).toHaveLength(6);
    round(b,{s:cmd('six_thunder')});expect(res(b).current).toBe(1);
  });
  it('敕雷尊重全部指定目标，普通群雷仅接受首目标并补齐',()=>{
    noProc();const {b}=setup('thunder',['1.1']);round(b,{s:cmd('edict',['t3','t4','t5'])});expect(hits(b,'t')).toHaveLength(0);expect(hits(b,'t5')).toHaveLength(1);
    round(b,{s:cmd('thunderstorm',['t3','t4','t5'])});expect(hits(b,'t')).toHaveLength(1);expect(hits(b,'t5')).toHaveLength(1);
  });
  it('赤印增伤70%后退化，护盾全吸收仍触发，吸收采用替代倍率',()=>{
    noProc();const {b}=setup('thunder',['1.3','7.2']);
    const red:SkillDef={id:'test.red',name:'挂印',tags:['spell'],targeting:{side:'enemy'},effects:[{type:'applyStatus',statusId:T('red'),duration:3}]};grant(b,red.id);b.unit('s').skillOverrides[red.id]=red;
    round(b,{s:{type:'skill',skillId:red.id,targets:['t']}});
    round(b,{s:cmd('absorb')});expect(st(b,'t','red')).toBeUndefined();expect(st(b,'t','electric')).toBeUndefined();
    const enhanced=hits(b)[0];round(b,{s:cmd('absorb')});expect(enhanced/hits(b)[1]).toBeCloseTo(3,2);
    round(b,{s:{type:'skill',skillId:red.id,targets:['t']}});
    b.unit('t').barriers.push({id:'test',kind:'test',name:'护盾',current:100000,remainingRounds:3,sourceId:'t',appliedRound:b.state.round});
    const normal:SkillDef={id:'test.spell',name:'法术',tags:['spell'],targeting:{side:'enemy'},effects:[{type:'spellHit',coeff:1}]};grant(b,normal.id);b.unit('s').skillOverrides[normal.id]=normal;
    round(b,{s:{type:'skill',skillId:normal.id,targets:['t']}});expect(st(b,'t','red')).toBeUndefined();expect(st(b,'t','electric')).toBeDefined();
  });
  it('轰鸣、驭意与灵曜来源贡献独立，罡威只放大护体法攻增量',()=>{
    noProc();const {b}=setup('thunder',['2.3','3.3','5.3']);const before=effectiveAttrs(b.unit('s'));round(b,{s:cmd('divine_guardian',['s'])});const after=effectiveAttrs(b.unit('s'));
    expect(before.magicAtk).toBe(1030);expect(before.magicDef).toBe(276);expect(before.speed).toBe(1005);expect(after.magicAtk-before.magicAtk).toBe(216);expect(after.magicDef-before.magicDef).toBe(90);
  });
  it('洞真需主动消耗行动与80法力，六项属性刷新不叠加',()=>{
    noProc();const {b}=setup('thunder',['6.1']);round(b,{s:cmd('insight',['s'])});expect(st(b,'s','insight')?.attrMods.physicalAtk).toBe(360);round(b,{s:cmd('insight',['s'])});expect(b.unit('s').statuses.filter(s=>s.id===T('insight'))).toHaveLength(1);expect(b.unit('s').attrs.mp).toBe(99840);
  });
  it('存档恢复保留灌注、实际重数记录和冷却',()=>{
    noProc();const {b,input}=setup('law');res(b).current=3;round(b,{s:cmd('strike_2')});
    const restored=restoreBattle(input,b.snapshot(),[...b.log()]);
    expect(restored.unit('s').resources).toEqual(b.unit('s').resources);expect(restored.unit('s').combatFacts).toEqual(b.unit('s').combatFacts);
  });
});

describe('九劫触发边界回归',()=>{
  it('门派抵御是15%，同类相加封顶25%，不抵御法术伤害和自身休息',()=>{
    const random=vi.spyOn(SeededRng.prototype,'chance').mockImplementation(p=>p<0.3||p>=1);
    const {b}=setup();
    const bad:SkillDef={id:'test.negative',name:'负面法术',tags:['spell'],targeting:{side:'enemy'},effects:[{type:'spellHit',coeff:1},{type:'applyStatus',statusId:T('suppress'),duration:3}]};
    grant(b,bad.id);b.unit('t').skills.push(bad.id);b.unit('t').skillOverrides[bad.id]=bad;
    round(b,{s:cmd('five_thunder'),t:{type:'skill',skillId:bad.id,targets:['s']}});
    expect(random).toHaveBeenCalledWith(0.15);expect(st(b,'s','suppress')).toBeUndefined();expect(b.unit('s').attrs.hp).toBeLessThan(100000);
    b.unit('s').passives.push('test.resist');b.unit('s').skillOverrides['test.resist']={id:'test.resist',name:'额外抵御',tags:['passive'],targeting:{side:'self'},effects:[],innate:{negativeSpellResistance:0.2}};
    round(b,{t:{type:'skill',skillId:bad.id,targets:['s']}});expect(random).toHaveBeenCalledWith(0.25);
    vi.restoreAllMocks();restProc();round(b,{s:cmd('strike_2')});expect(st(b,'s','rest_minor')).toBeDefined();
  });
  it('震魂能挂在倒地者身上，原期限内复起依然有效',()=>{
    restProc();const {b}=setup('law',['5.3']);b.unit('t').attrs.hp=1;
    round(b,{s:cmd('strike_3')});expect(b.unit('t').flags.downed).toBe(true);expect(st(b,'t','confuse')).toBeDefined();
    const revive:SkillDef={id:'test.revive',name:'复起',tags:['support'],targeting:{side:'ally',includeDowned:true},effects:[{type:'revive',hpRatio:0.5}]};
    b.unit('t1').skills.push(revive.id);b.unit('t1').skillOverrides[revive.id]=revive;b.unit('t1').attrs.speed=5000;
    round(b,{t1:{type:'skill',skillId:revive.id,targets:['t']}});expect(b.unit('t').flags.downed).toBe(false);
    expect(b.log().some(e=>e.type==='statusRemoved'&&e.statusId===T('confuse')&&e.reason==='expired')).toBe(true);
  });
  it('神采每次群攻仅判一次免休，气势只记录实际重数且两类分开',()=>{
    const random=noProc();const {b}=setup('law',['5.1','6.2']);b.unit('t').attrs.hp=1;b.unit('t1').attrs.hp=1;
    round(b,{s:cmd('sweep_3')});
    expect(b.log().filter(e=>e.type==='chanceResolved'&&e.branchId==='jiujie.branch.rest')).toHaveLength(1);
    expect(random).toHaveBeenCalledWith(0.5*0.75*0.85);
    expect(b.unit('s').combatFacts!.jiujie_used_2_3).toBe(1);expect(b.unit('s').combatFacts!.jiujie_used_1_3??0).toBe(0);
  });
  it('雷醒累计伤害达标才解除封印和拘灵，保留休息；倒地不触发',()=>{
    noProc();const {b,input}=setup('law',['4.2']);
    const hit:SkillDef={id:'test.damage',name:'重创',tags:['spell'],targeting:{side:'enemy'},effects:[{type:'applyStatus',statusId:T('rest_minor'),duration:3},{type:'applyStatus',statusId:T('suppress'),duration:3},{type:'applyStatus',statusId:'youdu.status.soul_seal',duration:3},{type:'fixedHit',power:30000}]};
    input.skills!.push(hit);input.units[2].skills=[hit.id];const battle=createBattle(input);
    round(battle,{t:{type:'skill',skillId:hit.id,targets:['s']}});expect(st(battle,'s','suppress')).toBeUndefined();expect(st(battle,'s','rest_minor')).toBeDefined();expect(battle.unit('s').statuses.some(s=>s.id==='youdu.status.soul_seal')).toBe(false);
    expect(b.unit('s').statuses).toEqual([]);
    battle.unit('s').attrs.hp=1;round(battle,{t:{type:'skill',skillId:hit.id,targets:['s']}});expect(battle.unit('s').flags.downed).toBe(true);expect(battle.unit('s').statuses.some(s=>s.id==='youdu.status.soul_seal')).toBe(true);
  });
  it('共鸣只强化本人灵兽的雷击/奔雷，其他宠物和法术不受益',()=>{
    noProc();const {input}=setup('thunder',['5.1']);
    const spell:SkillDef={id:'beast.thunder',name:'雷击',tags:['spell'],targeting:{side:'enemy'},effects:[{type:'spellHit',coeff:1}]};input.skills!.push(spell);
    const attrs={hp:10000,mp:1000,speed:300,physicalAtk:100,physicalDef:100,magicAtk:1000};
    input.units.push({id:'pet',name:'本宠',side:0,kind:'pet',ownerId:'s',attrs,skills:[spell.id]},{id:'other',name:'他宠',side:0,kind:'pet',ownerId:'a',attrs,skills:[spell.id]});
    const b=createBattle(input);round(b,{pet:{type:'skill',skillId:spell.id,targets:['t3']},other:{type:'skill',skillId:spell.id,targets:['t3']}});
    const damage=b.log().filter(e=>e.type==='damage'&&e.targetId==='t3');expect(damage).toHaveLength(2);
    if(damage[0].type==='damage'&&damage[1].type==='damage')expect(damage[0].amount/damage[1].amount).toBeCloseTo(1.12,2);
  });
  it('赤殛需要全队唯一九劫，赤印单次70%替代12%而不叠加',()=>{
    vi.spyOn(SeededRng.prototype,'chance').mockImplementation(p=>p===0.1||p>=1);
    const {b}=setup('thunder',['1.3','5.2']);round(b,{s:cmd('thunderstorm')});expect(st(b,'t','red')).toBeDefined();
    round(b,{s:cmd('thunderstorm')});expect(hits(b)[1]/hits(b)[0]).toBeCloseTo(1.7,2);
    b.unit('a').tags.push('sect.jiujie');round(b,{s:cmd('thunderstorm')});expect(st(b,'t','red')).toBeUndefined();expect(st(b,'t','electric')).toBeDefined();
  });
  it('雷波击倒由本人触发，灵兽同样可触发，队友击倒不触发',()=>{
    noProc();const {b}=setup('thunder',['1.3','6.3']);b.unit('t').attrs.hp=2000;
    round(b,{s:cmd('thunderstorm')});b.unit('t').attrs.hp=1;round(b,{s:cmd('thunderstorm')});expect(st(b,'t5','electric')).toBeDefined();
  });
  it('已掌握摄雷归一不会改变其他法术的伤害',()=>{
    noProc();const a=setup('thunder',['1.3','7.2']).b;const b=setup('thunder',['1.3','6.2']).b;
    round(a,{s:cmd('thunderstorm')});round(b,{s:cmd('thunderstorm')});expect(hits(a)[0]).toBe(hits(b)[0]);
  });
});
