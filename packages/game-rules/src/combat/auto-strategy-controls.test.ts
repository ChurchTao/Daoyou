import { describe, expect, it } from 'vitest';
import { createBattle } from '@daoyou/combat-core/session';
import type { SkillDef, StatusDef } from '@daoyou/combat-core/types';
import { COMBAT_V6_CHARACTER_BUILD_VERSIONS } from '@daoyou/game-domain/combat';
import {
  AUTO_POLICY_VERSION,
  SaveAutoStrategySchema,
  type AutoComparison,
  type AutoStrategy,
} from '@daoyou/game-domain/combat/auto';
import { automaticCommands } from './auto.js';
import { daoyouRulesetV6 } from './daoyou/index.js';

type Condition = AutoStrategy['rules'][number]['conditions'][number];

const skills: SkillDef[] = [
  {
    id: 'strike', name: '攻击术', tags: ['spell'], costMp: 10,
    targeting: { side: 'enemy' }, effects: [{ type: 'spellHit', power: 400 }],
  },
  {
    id: 'heal', name: '治疗', tags: ['support'], costMp: 10,
    targeting: { side: 'ally' }, effects: [{ type: 'heal', power: 100 }],
  },
  {
    id: 'revive', name: '复活', tags: ['support'], costMp: 10,
    targeting: { side: 'ally', includeDowned: true },
    effects: [{ type: 'revive', hpRatio: 0.3 }],
  },
];
const statusDefs: StatusDef[] = [
  { id: 'mark', name: '印记', kind: 'mark', sourceBound: true },
  { id: 'permanent', name: '常驻印记', kind: 'permanent', untilBattleEnd: true },
  { id: 'hidden', name: '隐身', kind: 'hidden', untargetable: true },
  { id: 'no-summon', name: '禁召', kind: 'no-summon', blockedCommands: ['summon'] },
];

function fixture(skillIds = ['strike', 'heal', 'revive']) {
  const attrs = {
    hp: 1000, maxHp: 1000, mp: 100, maxMp: 100,
    speed: 50, physicalAtk: 50, physicalDef: 50,
  };
  return createBattle({
    seed: 42,
    versions: {
      ...COMBAT_V6_CHARACTER_BUILD_VERSIONS,
      autoPolicyVersion: AUTO_POLICY_VERSION,
    },
    ruleset: daoyouRulesetV6,
    skills,
    statusDefs,
    units: [
      { id: 'player', name: '人物', kind: 'player', side: 0, slot: 0, level: 60, skills: skillIds, attrs },
      { id: 'ally', name: '队友', kind: 'player', side: 0, slot: 1, level: 60, attrs },
      { id: 'pet', name: '本宠', kind: 'pet', ownerId: 'player', side: 0, slot: 4, level: 60, attrs },
      { id: 'ally-pet', name: '队友灵兽', kind: 'pet', ownerId: 'ally', side: 0, slot: 5, level: 60, attrs },
      // Carry order deliberately differs from both ID and slot order.
      { id: 'reserve-z', name: '第一后备', kind: 'pet', ownerId: 'player', side: 0, slot: 9, level: 60, benched: true, attrs },
      { id: 'reserve-a', name: '第二后备', kind: 'pet', ownerId: 'player', side: 0, slot: 2, level: 60, benched: true, attrs },
      { id: 'enemy', name: '敌人', kind: 'npc', side: 1, slot: 0, level: 60, attrs },
    ],
  });
}

type Battle = ReturnType<typeof fixture>;

function chooseGroup(battle: Battle, strategy?: AutoStrategy, ownerId = 'player') {
  return automaticCommands(
    battle.snapshot(), ownerId, skills, id => battle.queryCommands(id),
    { statusDefs, ...(strategy ? { strategies: { [ownerId]: strategy } } : {}) },
  );
}

function choose(battle: Battle, strategy?: AutoStrategy) {
  return chooseGroup(battle, strategy).find(entry => entry.unitId === 'player')!.command;
}

function attackWhen(condition: Condition): AutoStrategy {
  return {
    version: 1,
    fallback: 'defend',
    rules: [{ conditions: [condition], action: { type: 'attack' }, target: 'best' }],
  };
}

function killPet(battle: Battle, id = 'pet') {
  battle.unit(id).attrs.hp = 0;
  battle.unit(id).flags.dead = true;
}

const summonStrategy: AutoStrategy = {
  version: 1,
  fallback: 'attack',
  rules: [{ conditions: [], action: { type: 'summonNext' }, target: 'best' }],
};

describe('自动战术的候选目标与回退限制', () => {
  it('最低血友方从合法本宠候选中选择，不被更低血的人物或队友灵兽截断', () => {
    const battle = fixture(['heal']);
    battle.unit('player').attrs.hp = 50;
    battle.unit('ally-pet').attrs.hp = 10;
    battle.unit('pet').attrs.hp = 400;
    expect(choose(battle, {
      version: 1,
      fallback: 'attack',
      rules: [{
        conditions: [],
        action: { type: 'skill', skillId: 'heal' },
        target: 'lowestHpAlly', targetScope: 'ownPet',
      }],
    })).toEqual({ type: 'skill', skillId: 'heal', targets: ['pet'] });
  });

  it('最低血友方可选复活候选中的倒地队友', () => {
    const battle = fixture(['revive']);
    battle.unit('player').attrs.hp = 50;
    battle.unit('ally').attrs.hp = 0;
    battle.unit('ally').flags.downed = true;
    expect(choose(battle, {
      version: 1,
      fallback: 'defend',
      rules: [{
        conditions: [{ type: 'allyDowned' }],
        action: { type: 'skill', skillId: 'revive' },
        target: 'lowestHpAlly', targetScope: 'teammatePlayer',
      }],
    })).toEqual({ type: 'skill', skillId: 'revive', targets: ['ally'] });
  });

  it('普通治疗的最低血选择忽略等待队友复活的倒地候选', () => {
    const battle = fixture(['heal']);
    battle.unit('player').attrs.hp = 400;
    battle.unit('ally').attrs.hp = 0;
    battle.unit('ally').flags.downed = true;
    expect(battle.queryCommands('player').skills.find(skill => skill.skillId === 'heal')?.selectableTargetIds).toContain('ally');
    expect(choose(battle, {
      version: 1,
      fallback: 'defend',
      rules: [{
        conditions: [], action: { type: 'skill', skillId: 'heal' }, target: 'lowestHpAlly',
      }],
    })).toEqual({ type: 'skill', skillId: 'heal', targets: ['player'] });
  });

  it.each(['best', 'lowestHpAlly'] as const)('普通治疗配合目标血线和%s不会治疗倒地队友', target => {
    const battle = fixture(['heal']);
    battle.unit('player').attrs.hp = 400;
    battle.unit('ally').attrs.hp = 0;
    battle.unit('ally').flags.downed = true;
    const strategy: AutoStrategy = {
      version: 1,
      fallback: 'defend',
      rules: [{
        conditions: [{ type: 'targetHpBelow', percent: 50 }],
        action: { type: 'skill', skillId: 'heal' }, target,
      }],
    };
    expect(choose(battle, strategy)).toEqual({ type: 'skill', skillId: 'heal', targets: ['player'] });
    battle.unit('player').attrs.hp = 1000;
    expect(choose(battle, strategy)).toEqual({ type: 'defend' });
  });

  it.each([
    ['utility', 'skill'], ['attack', 'attack'], ['defend', 'defend'],
  ] as const)('%s 回退遵守所选模式', (fallback, expected) => {
    const battle = fixture(['strike']);
    expect(choose(battle, { version: 1, rules: [], fallback }).type).toBe(expected);
  });

  it('省略回退模式仍与临场应变相同', () => {
    const battle = fixture(['strike']);
    expect(choose(battle, { version: 1, rules: [] })).toEqual(
      choose(battle, { version: 1, rules: [], fallback: 'utility' }),
    );
  });

  it('普攻回退无合法目标时防御', () => {
    const battle = fixture(['strike']);
    battle.applyStatus('enemy', 'hidden', 3);
    expect(battle.queryCommands('player').attackTargetIds).toEqual([]);
    expect(choose(battle, { version: 1, rules: [], fallback: 'attack' })).toEqual({ type: 'defend' });
  });

  it('仅规则命中技能不会泄漏到临场应变，命中时仍可施放', () => {
    const battle = fixture(['strike']);
    const strategy: AutoStrategy = {
      version: 1,
      fallback: 'utility',
      rules: [{
        conditions: [{ type: 'selfHpBelow', percent: 50 }],
        action: { type: 'skill', skillId: 'strike' },
        target: 'best', onlyWhenMatched: true,
      }],
    };
    expect(choose(battle, strategy).type).toBe('attack');
    expect(choose(battle, {
      ...strategy, rules: [{ ...strategy.rules[0], onlyWhenMatched: false }],
    })).toMatchObject({ type: 'skill', skillId: 'strike' });
    battle.unit('player').attrs.hp = 400;
    expect(choose(battle, strategy)).toMatchObject({ type: 'skill', skillId: 'strike' });
  });

  it('同一受限技能可在另一条命中规则中使用', () => {
    const battle = fixture(['strike']);
    expect(choose(battle, {
      version: 1,
      rules: [
        {
          conditions: [{ type: 'selfHpBelow', percent: 50 }],
          action: { type: 'skill', skillId: 'strike' }, target: 'best', onlyWhenMatched: true,
        },
        { conditions: [], action: { type: 'skill', skillId: 'strike' }, target: 'best' },
      ],
    })).toMatchObject({ type: 'skill', skillId: 'strike' });
  });

  it('旧策略版本忽略新的回退和补宠配置', () => {
    const battle = fixture(['strike']);
    killPet(battle);
    battle.state.versions.autoPolicyVersion = 'combat_auto_rules_v3';
    expect(choose(battle, { ...summonStrategy, fallback: 'defend' })).toEqual(choose(battle));
  });
});

describe('自动战术的状态、回合与本宠条件', () => {
  it.each([
    ['enemyHpBelow', 7], ['enemyHpBelow', 57],
    ['targetHpBelow', 7], ['targetHpBelow', 57],
  ] as const)('%s 的百分之%d整数血线在公开比例换算后保持比较边界', (type, percent) => {
    const battle = fixture([]);
    const enemy = battle.unit('enemy');
    enemy.attrs.maxHp = 100;
    const cases: [AutoComparison, readonly boolean[]][] = [
      ['lt', [true, false, false]], ['lte', [true, true, false]],
      ['eq', [false, true, false]], ['gte', [false, true, true]], ['gt', [false, false, true]],
    ];
    for (const [comparison, expected] of cases) {
      const strategy = attackWhen({ type, percent, comparison });
      for (const [index, hp] of [percent - 1, percent, percent + 1].entries()) {
        enemy.attrs.hp = hp;
        expect(choose(battle, strategy).type, `${hp}/100 ${comparison} ${percent}%`).toBe(expected[index] ? 'attack' : 'defend');
      }
    }
    enemy.attrs.maxHp = 10000;
    enemy.attrs.hp = percent * 100 - 1;
    expect(choose(battle, attackWhen({ type, percent, comparison: 'eq' })).type).toBe('defend');
    expect(choose(battle, attackWhen({ type, percent, comparison: 'lt' })).type).toBe('attack');
  });

  it.each([
    ['selfStatus', 'player'], ['allyStatus', 'ally'], ['targetStatus', 'enemy'],
  ] as const)('%s 的层数与时长必须由同一状态实例满足', (type, targetId) => {
    const battle = fixture([]);
    battle.applyStatus(targetId, 'mark', 3, 'player');
    battle.applyStatus(targetId, 'mark', 1, 'ally');
    const statuses = battle.unit(targetId).statuses;
    expect(statuses).toHaveLength(2);
    statuses[0].stacks = 4;
    const condition: Condition = {
      type, kind: 'mark', present: true,
      ...(type === 'selfStatus' ? {} : { ownedBySelf: false }),
      stacks: { comparison: 'gte', amount: 4 },
      remainingRounds: { comparison: 'lte', amount: 1 },
    };
    const strategy = attackWhen(condition);
    expect(choose(battle, strategy).type).toBe('defend');
    statuses[1].stacks = 4;
    expect(choose(battle, strategy).type).toBe('attack');
  });

  it('状态层数和时长筛选仍保留本人来源约束', () => {
    const battle = fixture([]);
    battle.applyStatus('enemy', 'mark', 1, 'ally');
    battle.unit('enemy').statuses[0].stacks = 4;
    const strategy = attackWhen({
      type: 'targetStatus', kind: 'mark', present: true, ownedBySelf: true,
      stacks: { comparison: 'eq', amount: 4 },
      remainingRounds: { comparison: 'eq', amount: 1 },
    });
    expect(choose(battle, strategy).type).toBe('defend');
    battle.applyStatus('enemy', 'mark', 1, 'player');
    battle.unit('enemy').statuses.find(status => status.sourceId === 'player')!.stacks = 4;
    expect(choose(battle, strategy).type).toBe('attack');
  });

  it.each([
    ['lt', [true, false, false]], ['lte', [true, true, false]],
    ['eq', [false, true, false]], ['gte', [false, true, true]], ['gt', [false, false, true]],
  ] as const)('回合 %s 在阈值两侧和相等时生效', (comparison, expected) => {
    const battle = fixture([]);
    const strategy = attackWhen({ type: 'roundNumber', round: 2, comparison });
    for (const [index, round] of [1, 2, 3].entries()) {
      battle.state.round = round;
      expect(choose(battle, strategy).type).toBe(expected[index] ? 'attack' : 'defend');
    }
  });

  it('本宠在场条件不把后备或队友灵兽当成本宠', () => {
    const battle = fixture([]);
    const strategy = attackWhen({ type: 'ownPetPresent', present: true });
    expect(choose(battle, strategy).type).toBe('attack');
    killPet(battle);
    expect(choose(battle, strategy).type).toBe('defend');
    expect(choose(battle, attackWhen({ type: 'ownPetPresent', present: false })).type).toBe('attack');
  });

  it.each(['ownPetHp', 'ownPetMp'] as const)('%s 只读取在场本宠并支持相等边界', type => {
    const battle = fixture([]);
    battle.unit('ally-pet').attrs.hp = 1;
    battle.unit('ally-pet').attrs.mp = 1;
    battle.unit('reserve-z').attrs.hp = 1;
    battle.unit('reserve-z').attrs.mp = 1;
    const attribute = type === 'ownPetHp' ? 'hp' : 'mp';
    const scale = type === 'ownPetHp' ? 10 : 1;
    const strategy = attackWhen({ type, percent: 50, comparison: 'eq' });
    for (const value of [49, 50, 51]) {
      battle.unit('pet').attrs[attribute] = value * scale;
      expect(choose(battle, strategy).type).toBe(value === 50 ? 'attack' : 'defend');
    }
    killPet(battle);
    expect(choose(battle, attackWhen({ type, percent: 50, comparison: 'lt' })).type).toBe('defend');
  });

  it('本宠零法力可以用等于0触发', () => {
    const battle = fixture([]);
    const strategy = attackWhen({ type: 'ownPetMp', percent: 0, comparison: 'eq' });
    expect(SaveAutoStrategySchema.safeParse(strategy).success).toBe(true);
    expect(choose(battle, strategy).type).toBe('defend');
    battle.unit('pet').attrs.mp = 0;
    expect(choose(battle, strategy).type).toBe('attack');
  });

  it('持续至战斗结束的状态不被有限剩余回合条件视为即将到期', () => {
    const battle = fixture([]);
    battle.applyStatus('enemy', 'permanent', 1, 'player');
    const make = (comparison: 'lte' | 'gt', amount: number) => attackWhen({
      type: 'targetStatus', kind: 'permanent', present: true, ownedBySelf: true,
      remainingRounds: { comparison, amount },
    });
    expect(choose(battle, make('lte', 1)).type).toBe('defend');
    expect(choose(battle, make('gt', 10000)).type).toBe('attack');
  });

  it('不存在状态时不能同时设置层数或时长，非技能不能限制仅命中使用', () => {
    expect(SaveAutoStrategySchema.safeParse(attackWhen({
      type: 'selfStatus', kind: 'mark', present: false,
      stacks: { comparison: 'gte', amount: 1 },
    })).success).toBe(false);
    expect(SaveAutoStrategySchema.safeParse(attackWhen({
      type: 'selfStatus', kind: 'mark', present: false,
      remainingRounds: { comparison: 'lte', amount: 1 },
    })).success).toBe(false);
    expect(SaveAutoStrategySchema.safeParse({
      ...summonStrategy, rules: [{ ...summonStrategy.rules[0], onlyWhenMatched: true }],
    }).success).toBe(false);
  });

  it('回合条件拒绝越界和小数，旧策略省略新增可选字段仍可读', () => {
    for (const round of [0, -1, 1.5, 10001]) {
      expect(SaveAutoStrategySchema.safeParse(attackWhen({ type: 'roundNumber', round })).success).toBe(false);
    }
    expect(SaveAutoStrategySchema.parse({
      version: 1,
      rules: [{
        conditions: [{ type: 'selfStatus', kind: 'mark', present: true }],
        action: { type: 'skill', skillId: 'strike' }, target: 'best',
      }],
    })).toEqual({
      version: 1,
      rules: [{
        conditions: [{ type: 'selfStatus', kind: 'mark', present: true }],
        action: { type: 'skill', skillId: 'strike' }, target: 'best',
      }],
    });
  });
});

describe('自动战术补召下一只灵兽', () => {
  it.each([
    { name: '最低血敌人', patch: { target: 'lowestHpEnemy' } },
    { name: '最低血友方', patch: { target: 'lowestHpAlly' } },
    { name: '友方灵兽范围', patch: { targetScope: 'allyPet' } },
    { name: '本宠范围', patch: { targetScope: 'ownPet' } },
    { name: '队友人物范围', patch: { targetScope: 'teammatePlayer' } },
    { name: '目标血线条件', patch: { conditions: [{ type: 'targetHpBelow', percent: 50 }] } },
    { name: '目标状态条件', patch: { conditions: [{ type: 'targetStatus', kind: 'mark', present: true, ownedBySelf: false }] } },
  ])('补宠规则拒绝不适用的$name', ({ patch }) => {
    expect(SaveAutoStrategySchema.safeParse({
      ...summonStrategy, rules: [{ ...summonStrategy.rules[0], ...patch }],
    }).success).toBe(false);
  });

  it('无目标设置的补宠规则可以读取，也允许显式不限目标范围', () => {
    const rule = { conditions: [], action: { type: 'summonNext' } };
    expect(SaveAutoStrategySchema.parse({ version: 1, rules: [rule] })).toEqual({
      version: 1, rules: [{ ...rule, target: 'best' }],
    });
    expect(SaveAutoStrategySchema.safeParse({
      version: 1, rules: [{ ...rule, target: 'best', targetScope: 'any' }],
    }).success).toBe(true);
  });

  it('按携带顺序补未出场灵兽，后备用尽后回退且不额外提交新宠行动', () => {
    const battle = fixture([]);
    killPet(battle);
    const first = chooseGroup(battle, summonStrategy);
    expect(first).toEqual([{ unitId: 'player', command: { type: 'summon', petId: 'reserve-z' } }]);
    battle.submit('player', first[0].command);
    battle.submit('ally', { type: 'defend' });
    battle.submit('ally-pet', { type: 'defend' });
    battle.submit('enemy', { type: 'defend' });
    battle.lockAndResolve();
    expect(battle.unit('reserve-z').flags.benched).toBe(false);
    expect(battle.unit('reserve-z').marks).toContain('battle:deployed');
    expect(choose(battle, summonStrategy).type).toBe('attack');
    killPet(battle, 'reserve-z');
    expect(choose(battle, summonStrategy)).toEqual({ type: 'summon', petId: 'reserve-a' });
    battle.unit('reserve-a').marks.push('battle:deployed');
    killPet(battle, 'reserve-a');
    expect(choose(battle, summonStrategy).type).toBe('attack');
  });

  it('已经出场并召回的灵兽不再作为下一只后备', () => {
    const battle = fixture([]);
    killPet(battle);
    battle.unit('reserve-z').marks.push('battle:deployed');
    expect(choose(battle, summonStrategy)).toEqual({ type: 'summon', petId: 'reserve-a' });
    battle.unit('reserve-a').marks.push('battle:deployed');
    expect(choose(battle, summonStrategy).type).toBe('attack');
  });

  it('无条件补宠规则也不会主动替换仍在场的本宠', () => {
    const battle = fixture([]);
    battle.unit('pet').attrs.hp = 1;
    battle.unit('pet').attrs.mp = 0;
    expect(battle.queryCommands('player').summonablePets).toHaveLength(2);
    expect(choose(battle, summonStrategy).type).toBe('attack');
    expect(battle.unit('pet').flags.benched).toBe(false);
  });

  it.each([1, 3])('等待第%d回合复生的本宠阻止补宠，逃离或召回后不阻止', reviveAtRound => {
    const battle = fixture([]);
    killPet(battle);
    battle.unit('pet').flags.reviveAtRound = reviveAtRound;
    expect(choose(battle, summonStrategy).type).toBe('attack');
    battle.unit('pet').flags.escaped = true;
    expect(choose(battle, summonStrategy)).toEqual({ type: 'summon', petId: 'reserve-z' });
    battle.unit('pet').flags.escaped = false;
    battle.unit('pet').flags.benched = true;
    expect(choose(battle, summonStrategy)).toEqual({ type: 'summon', petId: 'reserve-z' });
  });

  it('跳过不可召唤后备，召唤受限时顺延到下一规则', () => {
    const battle = fixture([]);
    killPet(battle);
    killPet(battle, 'reserve-z');
    expect(choose(battle, summonStrategy)).toEqual({ type: 'summon', petId: 'reserve-a' });
    battle.applyStatus('player', 'no-summon', 3);
    expect(battle.queryCommands('player').summonablePets).toEqual([]);
    expect(choose(battle, {
      ...summonStrategy,
      rules: [...summonStrategy.rules, { conditions: [], action: { type: 'defend' }, target: 'best' }],
    })).toEqual({ type: 'defend' });
  });

  it('默认策略与NPC不会自行补宠，人物战术不覆盖宠物既有选招', () => {
    const battle = fixture([]);
    const petBefore = chooseGroup(battle).find(entry => entry.unitId === 'pet');
    const petAfter = chooseGroup(battle, {
      version: 1, rules: [], fallback: 'defend',
    }).find(entry => entry.unitId === 'pet');
    expect(petAfter).toEqual(petBefore);
    killPet(battle);
    expect(choose(battle).type).not.toBe('summon');
    expect(choose(battle, { version: 1, rules: [] }).type).not.toBe('summon');
    expect(chooseGroup(battle, summonStrategy, 'enemy')).toEqual(chooseGroup(battle, undefined, 'enemy'));
  });
});
