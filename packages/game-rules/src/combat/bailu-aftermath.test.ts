import { describe, expect, it } from 'vitest';
import { createBattle, restoreBattle, type Command, type CreateBattleInput, type SkillDef } from '@daoyou/combat-core';
import { effectiveAttrs } from '@daoyou/combat-core/units';
import { BAILU_V6_DEFINITION as definition } from '@daoyou/game-content/sects/bailu';
import { COMBAT_V6_CHARACTER_BUILD_VERSIONS as versions } from '@daoyou/game-domain/combat';
import { createDaoyouRuleset } from './daoyou/index.js';

const P = (id: string) => `bailu.passive.${id}`;
const T = (id: string) => `bailu.status.${id}`;
const kill: SkillDef = { id: 'test.kill', name: '击倒', tags: ['spell'], targeting: { side: 'enemy', count: 1 }, effects: [{ type: 'fixedHit', power: 2000 }] };
const revive: SkillDef = { id: 'test.revive', name: '复起', tags: ['support'], targeting: { side: 'ally', count: 1, includeDowned: true }, effects: [{ type: 'restoreHp', power: 5000, revive: true }] };
const contentSkills = [...definition.skills, ...definition.paths.flatMap(path => [
  ...path.foundationPassives ?? [], ...path.grantSkills ?? [],
  ...path.nodes.flatMap(node => [...node.passives ?? [], ...node.grantSkills ?? []]),
])].map(skill => skill.definition);
const skills = [...new Map(contentSkills.map(skill => [skill.id, skill])).values(), kill, revive];

function setup(passives: string[], seed = 11) {
  const input: CreateBattleInput = {
    seed, versions, skills, statusDefs: definition.statuses,
    ruleset: createDaoyouRuleset({ formulas: { sealHitChance: () => 1, fluctuationMin: 1, fluctuationMax: 1 } }),
    units: [
      { id: 's', name: '学子', kind: 'player', side: 0, level: 180, tags: ['sect.bailu'],
        attrs: { hp: 10000, mp: 10000, magicAtk: 100, speed: 100 }, skills: ['test.kill', 'bailu.skill.fuyuan'], passives: passives.map(P),
        skillLevels: Object.fromEntries(skills.map(skill => [skill.id, 180])) },
      { id: 'a', name: '同伴', kind: 'player', side: 0, level: 180, attrs: { hp: 10000, mp: 10000, speed: 1 }, skills: ['test.kill'] },
      { id: 't', name: '敌手', kind: 'player', side: 1, level: 180, attrs: { hp: 1000, maxHp: 10000, mp: 10000, speed: 10 }, skills: ['test.kill'] },
      { id: 'e', name: '敌方医者', kind: 'player', side: 1, level: 180, attrs: { hp: 10000, mp: 10000, speed: 5 }, skills: ['test.revive'] },
    ],
  };
  return { b: createBattle(input), input };
}
type Battle = ReturnType<typeof setup>['b'];
const cast = (skillId: string, target: string): Command => ({ type: 'skill', skillId, targets: [target] });
function round(b: Battle, commands: Record<string, Command> = {}) {
  for (const unit of b.state.units) if (!unit.flags.dead && !unit.flags.downed) b.submit(unit.id, commands[unit.id] ?? { type: 'defend' });
  b.lockAndResolve();
}
const has = (b: Battle, target: string, id: string) => b.unit(target).statuses.some(status => status.id === T(id));

describe('白鹿倒地与资源交换', () => {
  it('击倒前记录法术事实，戒辞、定论与余论能够附着并跨倒地保留', () => {
    const { b } = setup(['jiejci', 'dinglun', 'yulun']);
    b.applyStatus('t', T('law'), 6, 's');
    b.applyStatus('t', T('mark'), 99, 's');
    round(b, { s: cast(kill.id, 't') });
    expect(b.unit('t').flags.downed).toBe(true);
    for (const status of ['cage', 'verdict', 'echo']) expect(has(b, 't', status)).toBe(true);
    expect(has(b, 't', 'mark')).toBe(false);
    expect(b.unit('t').statuses.filter(status => ['cage', 'verdict', 'echo'].includes(status.id.split('.').at(-1)!)).every(status => status.sourceId === 's')).toBe(true);
  });

  it('定论允许队友补刀，但不借用其他施术者的法术攻击事实', () => {
    for (const ownAttack of [false, true]) {
      const { b } = setup(['dinglun']);
      if (ownAttack) b.unit('t').combatFacts = { 'spellAttackedRound:s': 1 };
      else b.unit('t').combatFacts = { 'spellAttackedRound:a': 1 };
      round(b, { a: cast(kill.id, 't') });
      expect(has(b, 't', 'verdict')).toBe(ownAttack);
    }
  });

  it('余论复起后每目标每轮只追击一次，快照恢复不重新发放机会', () => {
    const { b, input } = setup(['yulun']);
    b.applyStatus('t', T('mark'), 99, 's');
    round(b, { s: cast(kill.id, 't'), e: cast(revive.id, 't') });
    const chaseRounds = () => {
      let current = 0;
      return b.log().flatMap(event => {
        if (event.type === 'roundStart') current = event.round;
        return event.type === 'damage' && event.sourceId === 's' && event.targetId === 't' && event.kind === 'spell' ? [current] : [];
      });
    };
    // lockAndResolve also opens the following round, whose opening chase is independent.
    expect(chaseRounds().filter(value => value === 1)).toHaveLength(1);
    expect(chaseRounds().filter(value => value === 2)).toHaveLength(1);
    const restored = restoreBattle(input, JSON.parse(JSON.stringify(b.snapshot())), [...b.log()]);
    const before = chaseRounds().length;
    round(b); round(restored);
    expect(chaseRounds().length - before).toBe(1);
    expect(restored.snapshot()).toEqual(b.snapshot());
    expect(restored.log()).toEqual(b.log());
  });

  it('文脉不绝仅在倒地当回合末尝试，成功先修伤势并按次数累加不屈', () => {
    let success: Battle | undefined;
    let failure: Battle | undefined;
    for (let seed = 1; seed <= 100 && (!success || !failure); seed++) {
      const { b } = setup(['lore_revive', 'buqu'], seed);
      b.unit('s').attrs.hp = 1000;
      b.unit('s').wound = 3000;
      round(b, { t: cast(kill.id, 's') });
      if (b.unit('s').flags.downed) failure = b;
      else success = b;
    }
    expect(success).toBeDefined(); expect(failure).toBeDefined();
    expect(success!.unit('s').attrs.hp).toBe(2000);
    expect(success!.unit('s').wound).toBe(1000);
    expect(success!.unit('s').combatFacts?.bailu_revives).toBe(1);
    expect(effectiveAttrs(success!.unit('s')).magicAtk).toBe(140);
    round(failure!);
    expect(failure!.unit('s').flags.downed).toBe(true);
    expect(failure!.unit('s').combatFacts?.bailu_revives ?? 0).toBe(0);
  });

  it('复元吐纳受伤势、缺血及剩余法力约束，额外交换只扣实需法力', () => {
    const { b } = setup(['tuna']);
    b.unit('s').attrs.hp = 3000;
    b.unit('s').attrs.mp = 120;
    b.unit('s').wound = 1000;
    round(b, { s: cast('bailu.skill.fuyuan', 's') });
    expect(b.unit('s').attrs.hp).toBe(3590); // 180+10 base, then remaining 100 MP -> 400 HP.
    expect(b.unit('s').attrs.mp).toBe(0);
    expect(b.unit('s').wound).toBe(1000);
  });
});
