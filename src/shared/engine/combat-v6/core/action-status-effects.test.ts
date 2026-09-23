import { describe, expect, it } from 'vitest';
import { createBattle, type Command, type SkillDef, type StatusDef } from './index';
import { createDaoyouRuleset } from '../rules-daoyou';
import { COMBAT_V6_PHASE_6D_VERSIONS as versions } from '../version';
const attack: SkillDef = { id: 'strike', name: '打击', tags: ['spell'], targeting: { side: 'enemy' }, effects: [{ type: 'spellHit', coeff: 1, power: 0 }] };
function setup(skills: SkillDef[] = [attack], statuses: StatusDef[] = [], hit = 1) {
  return createBattle({ seed: 1, versions, skills, statusDefs: statuses,
    ruleset: createDaoyouRuleset({ formulas: { baseDamage: () => 100, physicalHitChance: () => hit, spellHitChance: () => hit, fluctuationMin: 1, fluctuationMax: 1, physicalFluctuationMin: 1, physicalFluctuationMax: 1 } }),
    units: [{ id: 's', name: '施法者', kind: 'player', side: 0, attrs: { hp: 10000, maxHp: 10000, speed: 100 }, skills: skills.map(s => s.id) }, { id: 't', name: '目标', kind: 'player', side: 1, attrs: { hp: 10000, maxHp: 10000, speed: 1 } }],
  });
}
type B = ReturnType<typeof setup>;
function round(b: B, command: Command = { type: 'skill', skillId: 'strike', targets: ['t'] }) { b.submit('s', command); b.submit('t', { type: 'defend' }); b.lockAndResolve(); }
function shield(b: B, amount: number, id = 'shield') { b.unit('t').barriers.push({ id, kind: id, name: id, current: amount, sourceId: 't', appliedRound: 0, remainingRounds: 5 }); }
const weak: StatusDef = { id: 'weak', name: '弱化下次出手', kind: 'weak', consumeAfterDamagingAction: true, damageDealtPhysical: .5, damageDealtSpell: .5 };
describe('护盾额外损伤', () => {
  it.each([[0, 100, 0], [60, 70, 0], [300, 0, 100]])('护盾 %s 不放大气血伤害', (barrier, hpLoss, remainder) => {
    const b = setup([{ ...attack, modifiers: [{ barrierDamageBonus: 1 }] }]);
    if (barrier) shield(b, barrier);
    round(b);
    expect(10000 - b.unit('t').attrs.hp).toBe(hpLoss);
    expect(b.unit('t').barriers.reduce((n, x) => n + x.current, 0)).toBe(remainder);
  });
  it('多个护盾只消耗等价伤害预算，默认行为保持不变', () => {
    for (const factor of [0, 1]) {
      const b = setup([{ ...attack, modifiers: [{ barrierDamageBonus: factor }] }]);
      shield(b, 60, 'a'); shield(b, 60, 'b'); round(b);
      expect(b.unit('t').attrs.hp).toBe(factor ? 9960 : 10000);
      expect(b.unit('t').barriers.reduce((n, x) => n + x.current, 0)).toBe(factor ? 0 : 20);
    }
  });
});
describe('下一次伤害行动状态', () => {
  it('整次多段攻击都受削弱，随后消耗；辅助行动不消耗', () => {
    const b = setup([{ ...attack, effects: [attack.effects[0], attack.effects[0]] }], [weak]);
    b.applyStatus('s', 'weak', 5);
    round(b, { type: 'defend' }); expect(b.unit('s').statuses.some(s => s.id === 'weak')).toBe(true);
    round(b); expect(b.unit('t').attrs.hp).toBe(9900); expect(b.unit('s').statuses).toEqual([]);
    round(b); expect(b.unit('t').attrs.hp).toBe(9700);
  });
  it('全未命中不消耗，护盾完全吸收仍消耗', () => {
    const miss = setup([attack], [weak], 0); miss.applyStatus('s', 'weak', 5); round(miss);
    expect(miss.unit('s').statuses.some(s => s.id === 'weak')).toBe(true);
    const blocked = setup([attack], [weak]); blocked.applyStatus('s', 'weak', 5); shield(blocked, 1000); round(blocked);
    expect(blocked.unit('t').attrs.hp).toBe(10000); expect(blocked.unit('s').statuses).toEqual([]);
  });
  it('普攻也消耗；无出手时按持续时间过期', () => {
    const b = setup([attack], [weak]); b.applyStatus('s', 'weak', 5); round(b, { type: 'attack', target: 't' });
    expect(b.unit('s').statuses).toEqual([]);
    b.applyStatus('s', 'weak', 1); round(b, { type: 'defend' }); round(b, { type: 'defend' });
    expect(b.unit('s').statuses).toEqual([]);
  });
});
describe('持续治疗', () => {
  it('继承技能等级并经过通用治疗加成，每回合一次，到期停止', () => {
    const heal: SkillDef = { id: 'hot', name: '生息', tags: ['spell'], targeting: { side: 'self' }, effects: [{ type: 'applyStatus', statusId: 'hot', duration: 2 }] };
    const amplify: SkillDef = { id: 'amplify', name: '通用治疗', tags: ['passive'], targeting: { side: 'self' }, effects: [], hooks: [{ on: 'onHealCalc', sourceIsSelf: true, effects: [{ type: 'modifyHeal', factor: 2 }] }] };
    const b = setup([heal, amplify], [{ id: 'hot', name: '生息', kind: 'hot', category: 'buff', ticks: 'roundEnd', healingPerRound: 'skillLevel*2' }, { id: 'healing', name: '施疗', kind: 'healing', healDealt: 1.5, healTaken: .5 }]);
    b.unit('s').passives = ['amplify']; b.unit('s').skillLevels.hot = 100; b.unit('s').attrs.hp = 1000; b.applyStatus('s', 'healing', 5);
    round(b, { type: 'skill', skillId: 'hot', targets: ['s'] }); expect(b.unit('s').attrs.hp).toBe(1300);
    round(b, { type: 'defend' }); expect(b.unit('s').attrs.hp).toBe(1600);
    round(b, { type: 'defend' }); expect(b.unit('s').attrs.hp).toBe(1600);
  });
});
