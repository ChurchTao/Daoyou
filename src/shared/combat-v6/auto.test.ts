import { describe, expect, it } from 'vitest';
import { COMBAT_V6_SECT_DEFINITIONS_V4 } from '../engine/combat-v6/content';
import {
  createBattle,
  type SkillDef,
  type StatusDef,
} from '../engine/combat-v6/core';
import type { CombatV6TrainingPlayerInput } from '../engine/combat-v6/encounter';
import { CombatV6PveHostSession } from '../engine/combat-v6/encounter/host';
import { projectCharacterToCombatV6 } from '../engine/combat-v6/projection';
import {
  compileRankingBattle,
  simulateRankingBattle,
} from '../engine/combat-v6/ranking/battle';
import { daoyouRulesetV6 } from '../engine/combat-v6/rules-daoyou';
import { towerReferenceBuild } from '../engine/combat-v6/tower/reference-fixtures';
import { COMBAT_V6_PHASE_6D_VERSIONS } from '../engine/combat-v6/version';
import { automaticCommands, CombatAutoRequestSchema } from './auto';
import { observeAutoBattle } from './auto-observation';
import { AUTO_POLICY_VERSION } from './auto-policy';
import { autoStatusChoices } from './auto-status-options';
import {
  AutoStrategySchema,
  DEFAULT_AUTO_STRATEGIES,
  MAX_AUTO_STRATEGY_RULES,
  SaveAutoStrategySchema,
  type AutoComparison,
  type AutoStrategy,
} from './auto-strategy';
import { rankAutoActions } from './auto-utility';

const skills: SkillDef[] = [
  {
    id: 'heal',
    name: '治疗',
    tags: ['support'],
    costMp: 10,
    targeting: { side: 'ally' },
    effects: [{ type: 'heal', power: 100 }],
  },
  {
    id: 'revive',
    name: '复活',
    tags: ['support'],
    costMp: 10,
    targeting: { side: 'ally', includeDowned: true },
    effects: [{ type: 'revive', hpRatio: 0.3 }],
  },
  {
    id: 'strike',
    name: '攻击术',
    tags: ['spell'],
    costMp: 10,
    targeting: { side: 'enemy' },
    effects: [{ type: 'spellHit', power: 100 }],
  },
  {
    id: 'capture',
    name: '捕捉',
    tags: ['support'],
    targeting: { side: 'enemy' },
    effects: [],
    capture: { targetMpCosts: { enemy: 1 }, capacity: 6, chance: 1 },
  },
  {
    id: 'ward',
    name: '护体',
    tags: ['support'],
    targeting: { side: 'self' },
    effects: [{ type: 'applyStatus', statusId: 'guard', duration: 3 }],
  },
];
function fixture(
  skillIds = ['heal', 'revive', 'strike', 'capture'],
  definitions = skills,
  extraEnemy = false,
) {
  const attrs = {
    hp: 1000,
    maxHp: 1000,
    mp: 100,
    maxMp: 100,
    speed: 50,
    physicalAtk: 50,
    physicalDef: 50,
  };
  return createBattle({
    seed: 42,
    versions: { ...COMBAT_V6_PHASE_6D_VERSIONS, autoPolicyVersion: AUTO_POLICY_VERSION },
    ruleset: daoyouRulesetV6,
    skills: definitions,
    statusDefs: [
      { id: 'guard', name: '护体', kind: 'guard' },
      { id: 'stealth', name: '隐身', kind: 'stealth', untargetable: true },
      { id: 'reveal', name: '感知', kind: 'reveal', revealStealth: true },
      { id: 'fire-mark', name: '火印', kind: 'element-mark' },
      {
        id: 'poison-mark',
        name: '魂毒',
        kind: 'poison-mark',
        sourceBound: true,
      },
    ],
    units: [
      {
        id: 'player',
        name: '人物',
        kind: 'player',
        side: 0,
        level: 60,
        skills: skillIds,
        attrs,
      },
      {
        id: 'ally',
        name: '队友',
        kind: 'player',
        side: 0,
        level: 60,
        slot: 1,
        attrs,
      },
      {
        id: 'pet',
        name: '灵兽',
        kind: 'pet',
        ownerId: 'player',
        side: 0,
        level: 60,
        slot: 4,
        attrs,
      },
      {
        id: 'reserve',
        name: '后备灵兽',
        kind: 'pet',
        ownerId: 'player',
        side: 0,
        level: 60,
        slot: 5,
        benched: true,
        attrs,
      },
      { id: 'enemy', name: '敌人', kind: 'npc', side: 1, level: 60, attrs },
      ...(extraEnemy
        ? [
            {
              id: 'enemy2',
              name: '敌人二',
              kind: 'npc' as const,
              side: 1 as const,
              level: 60,
              attrs,
            },
          ]
        : []),
    ],
  });
}
function choose(battle: ReturnType<typeof fixture>) {
  return automaticCommands(battle.snapshot(), 'player', skills, (id) =>
    battle.queryCommands(id),
  );
}
function chooseWithStrategy(
  battle: ReturnType<typeof fixture>,
  strategy: AutoStrategy,
  statusDefs: readonly StatusDef[] = [],
) {
  return automaticCommands(
    battle.snapshot(),
    'player',
    skills,
    (id) => battle.queryCommands(id),
    { statusDefs, strategies: { player: strategy } },
  )[0].command;
}
function conditionedDefend(
  conditions: AutoStrategy['rules'][number]['conditions'],
): AutoStrategy {
  return {
    version: 1,
    rules: [
      { conditions, action: { type: 'defend' }, target: 'best' },
      { conditions: [], action: { type: 'attack' }, target: 'best' },
    ],
  };
}
describe('当前场次托管', () => {
  it('可配置的宗门状态都来自现行状态定义', () => {
    for (const definition of Object.values(COMBAT_V6_SECT_DEFINITIONS_V4)) {
      const statuses = definition.statuses;
      for (const path of definition.paths) {
        const choices = autoStatusChoices(path.id);
        for (const choice of [...choices.self, ...choices.target]) {
          expect(
            statuses.some(
              (status) =>
                status.kind === choice.kind &&
                (!choice.statusId || status.id === choice.statusId),
            ),
            choice.label,
          ).toBe(true);
        }
      }
    }
  });
  it.each([
    {
      name: '自身气血低于（严格小于）',
      condition: { type: 'selfHpBelow', percent: 50 },
      prepare: (battle: ReturnType<typeof fixture>) => {
        battle.unit('player').attrs.hp = 500;
      },
      trigger: (battle: ReturnType<typeof fixture>) => {
        battle.unit('player').attrs.hp = 499;
      },
    },
    {
      name: '己方气血低于（严格小于）',
      condition: { type: 'allyHpBelow', percent: 50 },
      prepare: (battle: ReturnType<typeof fixture>) => {
        battle.unit('ally').attrs.hp = 500;
      },
      trigger: (battle: ReturnType<typeof fixture>) => {
        battle.unit('ally').attrs.hp = 499;
      },
    },
    {
      name: '敌方气血低于（严格小于）',
      condition: { type: 'enemyHpBelow', percent: 50 },
      prepare: (battle: ReturnType<typeof fixture>) => {
        battle.unit('enemy').attrs.hp = 500;
      },
      trigger: (battle: ReturnType<typeof fixture>) => {
        battle.unit('enemy').attrs.hp = 499;
      },
    },
    {
      name: '有队友倒地',
      condition: { type: 'allyDowned' },
      prepare: (_battle: ReturnType<typeof fixture>) => {},
      trigger: (battle: ReturnType<typeof fixture>) => {
        battle.unit('ally').attrs.hp = 0;
        battle.unit('ally').flags.downed = true;
      },
    },
    {
      name: '存活敌人至少（含边界）',
      condition: { type: 'enemyCountAtLeast', count: 2 },
      prepare: (battle: ReturnType<typeof fixture>) => {
        battle.unit('enemy2').attrs.hp = 0;
        battle.unit('enemy2').flags.dead = true;
      },
      trigger: (battle: ReturnType<typeof fixture>) => {
        battle.unit('enemy2').attrs.hp = 1000;
        battle.unit('enemy2').flags.dead = false;
      },
    },
    {
      name: '自身资源至少（含边界）',
      condition: {
        type: 'selfResourceAtLeast',
        resourceId: 'focus',
        amount: 3,
      },
      prepare: (battle: ReturnType<typeof fixture>) => {
        battle.unit('player').resources.push({
          id: 'focus',
          name: '专注',
          current: 2,
          max: 10,
        });
      },
      trigger: (battle: ReturnType<typeof fixture>) => {
        battle.unit('player').resources[0].current = 3;
      },
    },
  ] as const)(
    '$name 条件不成立时顺延，成立时执行',
    ({ condition, prepare, trigger }) => {
      const battle = fixture(undefined, skills, true);
      const strategy = conditionedDefend([
        condition as AutoStrategy['rules'][number]['conditions'][number],
      ]);
      prepare(battle);
      expect(chooseWithStrategy(battle, strategy).type).toBe('attack');
      trigger(battle);
      expect(chooseWithStrategy(battle, strategy).type).toBe('defend');
    },
  );
  it.each([
    {
      name: '自身气血',
      make: (comparison: AutoComparison) => ({
        type: 'selfHpBelow' as const,
        percent: 50,
        comparison,
      }),
      set: (battle: ReturnType<typeof fixture>, value: number) => {
        battle.unit('player').attrs.hp = value * 10;
      },
    },
    {
      name: '己方气血',
      make: (comparison: AutoComparison) => ({
        type: 'allyHpBelow' as const,
        percent: 50,
        comparison,
      }),
      set: (battle: ReturnType<typeof fixture>, value: number) => {
        battle.unit('ally').attrs.hp = value * 10;
        battle.unit('player').attrs.hp = value * 10;
        battle.unit('pet').attrs.hp = value * 10;
      },
    },
    {
      name: '敌方气血',
      make: (comparison: AutoComparison) => ({
        type: 'enemyHpBelow' as const,
        percent: 50,
        comparison,
      }),
      set: (battle: ReturnType<typeof fixture>, value: number) => {
        battle.unit('enemy').attrs.hp = value * 10;
      },
    },
    {
      name: '自身资源',
      make: (comparison: AutoComparison) => ({
        type: 'selfResourceAtLeast' as const,
        resourceId: 'focus',
        amount: 50,
        comparison,
      }),
      set: (battle: ReturnType<typeof fixture>, value: number) => {
        battle.unit('player').resources = [
          { id: 'focus', name: '专注', current: value, max: 100 },
        ];
      },
    },
  ])('$name 的四种比较关系在阈值两侧与相等时生效', ({ make, set }) => {
    const battle = fixture();
    const cases: [AutoComparison, boolean[]][] = [
      ['lt', [true, false, false]],
      ['lte', [true, true, false]],
      ['gt', [false, false, true]],
      ['gte', [false, true, true]],
    ];
    for (const [comparison, expected] of cases) {
      const strategy = conditionedDefend([make(comparison)]);
      for (const [index, value] of [49, 50, 51].entries()) {
        set(battle, value);
        expect(chooseWithStrategy(battle, strategy).type).toBe(
          expected[index] ? 'defend' : 'attack',
        );
      }
    }
  });
  it('存活敌人数的至多、大于与旧版至少规则在边界生效', () => {
    const battle = fixture(undefined, skills, true);
    const enemy2 = battle.unit('enemy2');
    const chooseCount = (count: number, comparison?: AutoComparison) =>
      chooseWithStrategy(
        battle,
        conditionedDefend([{ type: 'enemyCountAtLeast', count, comparison }]),
      ).type;
    enemy2.flags.dead = true;
    enemy2.attrs.hp = 0;
    expect(chooseCount(1, 'lte')).toBe('defend');
    expect(chooseCount(1, 'gt')).toBe('attack');
    expect(chooseCount(2, 'lt')).toBe('defend');
    expect(chooseCount(2)).toBe('attack');
    enemy2.flags.dead = false;
    enemy2.attrs.hp = 1000;
    expect(chooseCount(1, 'lte')).toBe('attack');
    expect(chooseCount(1, 'gt')).toBe('defend');
    expect(chooseCount(2, 'lt')).toBe('attack');
    expect(chooseCount(2)).toBe('defend');
  });
  it('自身资源至多 0 可用于耗尽时的战术', () => {
    const battle = fixture();
    battle.unit('player').resources = [
      { id: 'focus', name: '专注', current: 0, max: 100 },
    ];
    const strategy = conditionedDefend([
      {
        type: 'selfResourceAtLeast',
        resourceId: 'focus',
        amount: 0,
        comparison: 'lte',
      },
    ]);
    expect(SaveAutoStrategySchema.safeParse(strategy).success).toBe(true);
    expect(chooseWithStrategy(battle, strategy).type).toBe('defend');
    battle.unit('player').resources[0].current = 1;
    expect(chooseWithStrategy(battle, strategy).type).toBe('attack');
  });
  it('自身状态按种类和状态 ID 判断有无，多个条件必须同时成立', () => {
    const battle = fixture(['strike'], skills, true);
    const statusDefs = [
      { id: 'fire-mark', name: '火印', kind: 'element-mark' },
      { id: 'guard', name: '护体', kind: 'guard' },
    ];
    const strategy = conditionedDefend([
      {
        type: 'selfStatus',
        kind: 'element-mark',
        statusId: 'fire-mark',
        present: true,
      },
      { type: 'selfStatus', kind: 'guard', present: false },
      { type: 'enemyCountAtLeast', count: 2 },
    ]);
    expect(chooseWithStrategy(battle, strategy, statusDefs).type).toBe(
      'attack',
    );
    battle.applyStatus('player', 'fire-mark', 3);
    expect(chooseWithStrategy(battle, strategy, statusDefs).type).toBe(
      'defend',
    );
    battle.applyStatus('player', 'guard', 3);
    expect(chooseWithStrategy(battle, strategy, statusDefs).type).toBe(
      'attack',
    );
  });
  it('己方状态只计自己的有效印记，队友施加的同名印记不拦截', () => {
    const battle = fixture();
    const condition = {
      type: 'allyStatus' as const,
      kind: 'guard',
      present: true,
      ownedBySelf: true,
    };
    const strategy = conditionedDefend([condition]);
    const statusDefs = [{ id: 'guard', name: '护体', kind: 'guard' }];
    battle.applyStatus('ally', 'guard', 3, 'ally');
    expect(chooseWithStrategy(battle, strategy, statusDefs).type).toBe('attack');
    battle.applyStatus('pet', 'guard', 3, 'player');
    expect(chooseWithStrategy(battle, strategy, statusDefs).type).toBe('defend');
    battle.unit('pet').flags.downed = true;
    expect(chooseWithStrategy(battle, strategy, statusDefs).type).toBe('attack');
  });
  it('观察保留本人及所控灵兽的状态来源，不泄露其他来源', () => {
    const battle = fixture();
    battle.applyStatus('ally', 'guard', 3, 'pet');
    battle.applyStatus('player', 'fire-mark', 3, 'enemy');
    const observed = observeAutoBattle(battle.snapshot(), 'player', [
      { id: 'guard', name: '护体', kind: 'guard' },
      { id: 'fire-mark', name: '火印', kind: 'element-mark' },
    ]);
    expect(observed.units.find((unit) => unit.id === 'ally')?.statuses[0].sourceId).toBe('pet');
    expect(observed.units.find((unit) => unit.id === 'player')?.statuses[0].sourceId).toBe('');
  });
  it('目标血线只约束选中目标，严格灵兽范围无人可选时顺延', () => {
    const battle = fixture(['heal', 'strike']);
    const strategy: AutoStrategy = {
      version: 1,
      rules: [
        {
          conditions: [{ type: 'targetHpBelow', percent: 50 }],
          action: { type: 'skill', skillId: 'heal' },
          target: 'best',
          targetScope: 'ownPet',
        },
        { conditions: [], action: { type: 'attack' }, target: 'best' },
      ],
    };
    battle.unit('player').attrs.hp = 100;
    expect(chooseWithStrategy(battle, strategy).type).toBe('attack');
    expect(chooseWithStrategy(battle, {
      version: 1,
      rules: [strategy.rules[0]],
    })).toMatchObject({ type: 'skill', skillId: 'strike', targets: ['enemy'] });
    battle.unit('reserve').flags.benched = false;
    battle.unit('reserve').ownerId = 'ally';
    battle.unit('reserve').attrs.hp = 400;
    expect(chooseWithStrategy(battle, strategy).type).toBe('attack');
    expect(chooseWithStrategy(battle, {
      ...strategy,
      rules: [{ ...strategy.rules[0], targetScope: 'allyPet' }, strategy.rules[1]],
    })).toMatchObject({ type: 'skill', skillId: 'heal', targets: ['reserve'] });
    battle.unit('pet').attrs.hp = 400;
    expect(chooseWithStrategy(battle, strategy)).toMatchObject({
      type: 'skill', skillId: 'heal', targets: ['pet'],
    });
    battle.unit('pet').flags.downed = true;
    expect(chooseWithStrategy(battle, strategy).type).toBe('attack');
  });
  it('转移型印记已有有效持有者时不会自动反复转印', () => {
    const battle = fixture(['transfer', 'strike']);
    const transfer: SkillDef = {
      id: 'transfer', name: '转印', tags: ['support'],
      targeting: { side: 'ally' },
      effects: [
        { type: 'removeStatus', kinds: ['guard'], ownedOnly: true,
          targeting: { side: 'ally', mode: 'all', includeDowned: true } },
        { type: 'applyStatus', statusId: 'guard', duration: 3 },
      ],
    };
    battle.unit('player').skillOverrides.transfer = transfer;
    const strategy: AutoStrategy = {
      version: 1,
      rules: [
        { conditions: [{ type: 'targetStatus', kind: 'guard', present: false, ownedBySelf: true }],
          action: { type: 'skill', skillId: 'transfer' }, target: 'best' },
        { conditions: [], action: { type: 'attack' }, target: 'best' },
      ],
    };
    const defs = [{ id: 'guard', name: '护体', kind: 'guard' }];
    expect(chooseWithStrategy(battle, strategy, defs).type).toBe('skill');
    battle.applyStatus('ally', 'guard', 3, 'ally');
    expect(chooseWithStrategy(battle, strategy, defs).type).toBe('skill');
    battle.applyStatus('pet', 'guard', 3, 'player');
    expect(chooseWithStrategy(battle, strategy, defs).type).toBe('attack');
    battle.unit('pet').flags.downed = true;
    expect(chooseWithStrategy(battle, strategy, defs).type).toBe('skill');
  });
  it.each(['combat_auto_rules_v3', undefined])('旧自动策略版本（%s）忽略冻结战术，改用临场应变', (version) => {
    const battle = fixture(['strike']);
    const strategy: AutoStrategy = {
      version: 1,
      rules: [{ conditions: [], action: { type: 'defend' }, target: 'best' }],
    };
    expect(chooseWithStrategy(battle, strategy).type).toBe('defend');
    battle.state.versions.autoPolicyVersion = version;
    expect(chooseWithStrategy(battle, strategy)).toEqual(chooseWithStrategy(battle, { version: 1, rules: [] }));
    expect(chooseWithStrategy(battle, strategy).type).not.toBe('defend');
  });
  it('策略格式拒绝超出边界及多余字段', () => {
    const base = conditionedDefend([{ type: 'selfHpBelow', percent: 50 }]);
    expect(AutoStrategySchema.safeParse(base).success).toBe(true);
    for (const invalid of [
      {
        ...base,
        rules: [
          {
            ...base.rules[0],
            conditions: [{ type: 'selfHpBelow', percent: 0 }],
          },
        ],
      },
      {
        ...base,
        rules: [
          {
            ...base.rules[0],
            conditions: [{ type: 'enemyCountAtLeast', count: 7 }],
          },
        ],
      },
      {
        ...base,
        rules: [
          {
            ...base.rules[0],
            conditions: [
              { type: 'selfResourceAtLeast', resourceId: '', amount: 1 },
            ],
          },
        ],
      },
      {
        ...base,
        rules: [
          {
            ...base.rules[0],
            conditions: [
              { type: 'targetStatus', kind: 'guard', present: true },
            ],
          },
        ],
      },
      { ...base, rules: [{ ...base.rules[0], extra: true }] },
      { ...base, rules: Array(13).fill(base.rules[0]) },
    ])
      expect(AutoStrategySchema.safeParse(invalid).success).toBe(false);
  });
  it('新策略最多 10 条，旧版 11～12 条仍可读取', () => {
    const rule = conditionedDefend([]).rules[0];
    const strategy = (count: number) => ({
      version: 1,
      rules: Array(count).fill(rule),
    });
    expect(SaveAutoStrategySchema.safeParse(strategy(10)).success).toBe(true);
    expect(SaveAutoStrategySchema.safeParse(strategy(11)).success).toBe(false);
    expect(AutoStrategySchema.safeParse(strategy(12)).success).toBe(true);
    expect(AutoStrategySchema.safeParse(strategy(13)).success).toBe(false);
  });
  it('存活敌人至少 1 名是合法条件，并与至少 2 名区分', () => {
    const oneEnemy = conditionedDefend([
      { type: 'enemyCountAtLeast', count: 1 },
    ]);
    const twoEnemies = conditionedDefend([
      { type: 'enemyCountAtLeast', count: 2 },
    ]);
    expect(AutoStrategySchema.safeParse(oneEnemy).success).toBe(true);
    expect(
      AutoStrategySchema.safeParse(
        conditionedDefend([{ type: 'enemyCountAtLeast', count: 0 }]),
      ).success,
    ).toBe(false);
    const battle = fixture();
    expect(chooseWithStrategy(battle, oneEnemy).type).toBe('defend');
    expect(chooseWithStrategy(battle, twoEnemies).type).toBe('attack');
  });
  it('天衍默认规则按自身火印接水术', () => {
    const player = towerReferenceBuild('tianyan', '金丹', '中期', 0);
    const opponent = towerReferenceBuild('jiujie', '金丹');
    opponent.cultivator.id = '00000000-0000-4000-8000-000000000003';
    player.beasts = undefined;
    opponent.beasts = undefined;
    const input = compileRankingBattle([player, opponent], 42);
    const battle = createBattle({ ...input, ruleset: daoyouRulesetV6 });
    const ownerId = player.cultivator.id;
    battle.applyStatus(ownerId, 'tianyan.status.mark.fire', 1);
    const command = automaticCommands(
      battle.snapshot(),
      ownerId,
      input.skills ?? [],
      (id) => battle.queryCommands(id),
      {
        statusDefs: input.statusDefs,
        strategies: {
          [ownerId]: DEFAULT_AUTO_STRATEGIES['tianyan.path.hetu'],
        },
      },
    ).find((entry) => entry.unitId === ownerId)?.command;
    expect(command).toMatchObject({
      type: 'skill',
      skillId: 'tianyan.skill.water',
    });
  });
  it('自身状态规则可接续招式，施法失败不预先推进状态', () => {
    const battle = fixture(['strike']);
    const strategy = {
      version: 1 as const,
      rules: [
        {
          conditions: [
            {
              type: 'selfStatus' as const,
              kind: 'element-mark',
              present: false,
            },
          ],
          action: { type: 'defend' as const },
          target: 'best' as const,
        },
        {
          conditions: [
            {
              type: 'selfStatus' as const,
              kind: 'element-mark',
              statusId: 'fire-mark',
              present: true,
            },
          ],
          action: { type: 'skill' as const, skillId: 'strike' },
          target: 'best' as const,
        },
      ],
    };
    const choose = () =>
      automaticCommands(
        battle.snapshot(),
        'player',
        skills,
        (id) => battle.queryCommands(id),
        {
          statusDefs: [{ id: 'fire-mark', name: '火印', kind: 'element-mark' }],
          strategies: { player: strategy },
        },
      )[0].command;
    expect(choose().type).toBe('defend');
    battle.applyStatus('player', 'fire-mark', 3);
    expect(choose()).toMatchObject({ type: 'skill', skillId: 'strike' });
    battle.unit('player').attrs.mp = 0;
    expect(choose().type).toBe('attack');
  });
  it('目标状态条件只匹配实际命中的目标，并区分自己留下的印', () => {
    const battle = fixture(['strike'], skills, true);
    battle.unit('enemy').attrs.hp = 100;
    battle.unit('enemy2').attrs.hp = 200;
    const strategy = {
      version: 1 as const,
      rules: [
        {
          conditions: [
            {
              type: 'targetStatus' as const,
              kind: 'poison-mark',
              present: false,
              ownedBySelf: true,
            },
          ],
          action: { type: 'attack' as const },
          target: 'lowestHpEnemy' as const,
        },
      ],
    };
    const choose = () =>
      automaticCommands(
        battle.snapshot(),
        'player',
        skills,
        (id) => battle.queryCommands(id),
        {
          statusDefs: [
            {
              id: 'poison-mark',
              name: '魂毒',
              kind: 'poison-mark',
              sourceBound: true,
            },
          ],
          strategies: { player: strategy },
        },
      )[0].command;
    battle.applyStatus('enemy', 'poison-mark', 3, 'ally');
    expect(choose()).toMatchObject({ type: 'attack', target: 'enemy' });
    battle.applyStatus('enemy', 'poison-mark', 3, 'player');
    expect(choose()).toMatchObject({ type: 'attack', target: 'enemy2' });
  });
  it('多个目标状态必须出现在同一目标上，不跨目标拼接', () => {
    const battle = fixture(['strike'], skills, true);
    const statusDefs = [
      {
        id: 'poison-mark',
        name: '魂毒',
        kind: 'poison-mark',
        sourceBound: true,
      },
      { id: 'guard', name: '护体', kind: 'guard' },
    ];
    const strategy: AutoStrategy = {
      version: 1,
      rules: [
        {
          conditions: [
            {
              type: 'targetStatus',
              kind: 'poison-mark',
              present: true,
              ownedBySelf: true,
            },
            {
              type: 'targetStatus',
              kind: 'guard',
              present: false,
              ownedBySelf: false,
            },
          ],
          action: { type: 'attack' },
          target: 'lowestHpEnemy',
        },
        { conditions: [], action: { type: 'defend' }, target: 'best' },
      ],
    };
    battle.unit('enemy').attrs.hp = 100;
    battle.unit('enemy2').attrs.hp = 200;
    battle.applyStatus('enemy', 'poison-mark', 3, 'player');
    battle.applyStatus('enemy', 'guard', 3);
    battle.applyStatus('enemy2', 'poison-mark', 3, 'ally');
    expect(chooseWithStrategy(battle, strategy, statusDefs).type).toBe(
      'defend',
    );
    battle.applyStatus('enemy2', 'poison-mark', 3, 'player');
    expect(chooseWithStrategy(battle, strategy, statusDefs)).toMatchObject({
      type: 'attack',
      target: 'enemy2',
    });
  });
  it('己方目标状态约束最低血治疗目标', () => {
    const battle = fixture(['heal']);
    const strategy: AutoStrategy = {
      version: 1,
      rules: [
        {
          conditions: [
            {
              type: 'targetStatus',
              kind: 'guard',
              present: true,
              ownedBySelf: false,
            },
          ],
          action: { type: 'skill', skillId: 'heal' },
          target: 'lowestHpAlly',
        },
        { conditions: [], action: { type: 'defend' }, target: 'best' },
      ],
    };
    battle.unit('player').attrs.hp = 600;
    battle.unit('ally').attrs.hp = 200;
    battle.applyStatus('player', 'guard', 3);
    expect(
      chooseWithStrategy(battle, strategy, [
        { id: 'guard', name: '护体', kind: 'guard' },
      ]),
    ).toMatchObject({
      type: 'skill',
      skillId: 'heal',
      targets: ['player'],
    });
  });
  it('优先执行第一条可用规则；条件不符或招式不可用时顺延', () => {
    const battle = fixture(['strike'], skills, true);
    const strategy: AutoStrategy = {
      version: 1,
      rules: [
        {
          conditions: [{ type: 'enemyCountAtLeast', count: 3 }],
          action: { type: 'defend' },
          target: 'best',
        },
        {
          conditions: [{ type: 'enemyCountAtLeast', count: 2 }],
          action: { type: 'skill', skillId: 'strike' },
          target: 'best',
        },
        { conditions: [], action: { type: 'attack' }, target: 'best' },
      ],
    };
    expect(chooseWithStrategy(battle, strategy)).toMatchObject({
      type: 'skill',
      skillId: 'strike',
    });
    battle.unit('player').attrs.mp = 0;
    expect(chooseWithStrategy(battle, strategy).type).toBe('attack');
    battle.unit('player').attrs.mp = 100;
    strategy.rules[0].conditions = [{ type: 'enemyCountAtLeast', count: 2 }];
    expect(chooseWithStrategy(battle, strategy).type).toBe('defend');
  });
  it('每个现行宗门流派都有有效的默认规则和已定义技能', () => {
    const paths = Object.values(COMBAT_V6_SECT_DEFINITIONS_V4).flatMap(
      (definition) => definition.paths.map((path) => path.id),
    );
    expect(Object.keys(DEFAULT_AUTO_STRATEGIES).sort()).toEqual(paths.sort());
    for (const definition of Object.values(COMBAT_V6_SECT_DEFINITIONS_V4)) {
      for (const [index, path] of definition.paths.entries()) {
        const skillIds = new Set(
          [
            ...definition.skills,
            ...(path.grantSkills ?? []),
            ...path.nodes.flatMap((node) => node.grantSkills ?? []),
          ].map((skill) => skill.definition.id),
        );
        const strategy = DEFAULT_AUTO_STRATEGIES[path.id];
        expect(strategy.rules.length).toBeGreaterThanOrEqual(2);
        expect(strategy.rules.length).toBeLessThanOrEqual(
          MAX_AUTO_STRATEGY_RULES,
        );
        for (const rule of strategy.rules)
          if (rule.action.type === 'skill')
            expect(skillIds.has(rule.action.skillId), rule.action.skillId).toBe(
              true,
            );
        const statusChoices = autoStatusChoices(path.id);
        for (const condition of strategy.rules.flatMap(
          (rule) => rule.conditions,
        )) {
          if (condition.type === 'selfStatus')
            expect(
              statusChoices.self.some(
                (choice) =>
                  choice.kind === condition.kind &&
                  choice.statusId === condition.statusId,
              ),
            ).toBe(true);
          if (condition.type === 'targetStatus')
            expect(
              statusChoices.target.some(
                (choice) =>
                  choice.kind === condition.kind &&
                  choice.statusId === condition.statusId &&
                  choice.ownedBySelf === condition.ownedBySelf,
              ),
            ).toBe(true);
        }
        const early = projectCharacterToCombatV6({
          ...towerReferenceBuild(definition.id, '炼气', '中期', index as 0 | 1),
          side: 0,
          slot: 0,
          resourcePolicy: 'full',
        });
        expect(early.ok).toBe(true);
        if (!early.ok) continue;
        const unlearned = strategy.rules.flatMap((rule) =>
          rule.action.type === 'skill' &&
          !early.unit.skills.includes(rule.action.skillId)
            ? [rule.action.skillId]
            : [],
        );
        expect(unlearned).toEqual(
          path.id === 'wuxiang.path.compassion' ? ['wuxiang.skill.nectar'] : [],
        );
      }
    }
  });
  it('法术灵兽选有效攻击法术，缺蓝降级；物理灵兽普通攻击', () => {
    const physical: SkillDef = {
      id: 'pet-physical',
      name: '物理技',
      tags: ['physical'],
      targeting: { side: 'enemy' },
      effects: [{ type: 'physicalHit', coeff: 5 }],
    };
    const battle = fixture(['strike'], [...skills, physical]);
    const pet = battle.unit('pet');
    pet.attrs.magicAtk = 300;
    pet.skills = ['strike'];
    const petCommand = () =>
      automaticCommands(
        battle.snapshot(),
        'player',
        [...skills, physical],
        (id) => battle.queryCommands(id),
      ).find((entry) => entry.unitId === 'pet')!.command;
    expect(petCommand()).toMatchObject({ type: 'skill', skillId: 'strike' });
    pet.attrs.mp = 0;
    expect(petCommand().type).toBe('attack');
    pet.attrs.mp = 100;
    pet.skills = ['pet-physical'];
    expect(petCommand().type).toBe('attack');
  });
  it('大乘红尘正常构筑会进攻，而不是反复施放剑意增益', () => {
    const lingxiao = towerReferenceBuild('lingxiao', '大乘');
    const youdu = towerReferenceBuild('youdu', '大乘');
    youdu.cultivator.id = '00000000-0000-4000-8000-000000000003';
    youdu.beasts = undefined;
    const input = compileRankingBattle([lingxiao, youdu], 42);
    const battle = createBattle({ ...input, ruleset: daoyouRulesetV6 });
    const ownerId = lingxiao.cultivator.id;
    const commands = automaticCommands(
      battle.snapshot(),
      ownerId,
      input.skills ?? [],
      (id) => battle.queryCommands(id),
      { statusDefs: input.statusDefs },
    );
    const playerCommand = commands.find(
      ({ unitId }) => unitId === ownerId,
    )?.command;
    expect(playerCommand).toMatchObject({
      type: 'skill',
      skillId: 'lingxiao.skill.shadow_strike',
    });
    const ranked = rankAutoActions(
      observeAutoBattle(battle.snapshot(), ownerId, input.statusDefs ?? []),
      ownerId,
      input.skills ?? [],
      input.statusDefs ?? [],
      battle.queryCommands(ownerId),
    );
    expect(ranked[0].benefits.offense).toBeGreaterThan(0);
    for (const skillId of [
      'lingxiao.skill.sword_aura',
      'lingxiao.skill.clarity',
    ]) {
      expect(
        ranked.find(
          ({ command }) =>
            command.type === 'skill' && command.skillId === skillId,
        )?.score,
      ).toBeLessThan(ranked[0].score);
    }
    const trace = simulateRankingBattle(input);
    const playerActions = trace.rounds.flatMap(({ commands }) =>
      commands
        .filter(({ unitId }) => unitId === ownerId)
        .map(({ command }) => command),
    );
    const buffCount = playerActions.filter(
      (command) =>
        command.type === 'skill' &&
        ['lingxiao.skill.sword_aura', 'lingxiao.skill.clarity'].includes(
          command.skillId,
        ),
    ).length;
    expect(playerActions.length - buffCount).toBeGreaterThan(buffCount);
  });
  it('AUTO 是带回合和版本号的一次性请求，不接受旧开关协议', () => {
    expect(
      CombatAutoRequestSchema.safeParse({
        type: 'AUTO',
        round: 1,
        expectedRevision: 0,
      }).success,
    ).toBe(true);
    for (const input of [
      { enabled: true, expectedRevision: 0 },
      { type: 'AUTO', round: 0, expectedRevision: 0 },
      { type: 'AUTO', round: 1, expectedRevision: -1 },
    ])
      expect(CombatAutoRequestSchema.safeParse(input).success).toBe(false);
  });
  it('只控制本人和在场灵兽，确定性且不修改 RNG、快照或战报', () => {
    const battle = fixture();
    const before = battle.snapshot();
    const log = structuredClone(battle.log());
    const result = choose(battle);
    expect(result.map((e) => e.unitId)).toEqual(['player', 'pet']);
    expect(result[0].command).toEqual({
      type: 'skill',
      skillId: 'strike',
      targets: ['enemy'],
    });
    expect(choose(battle)).toEqual(result);
    expect(battle.snapshot()).toEqual(before);
    expect(battle.log()).toEqual(log);
  });
  it('低血治疗、倒地复活优先，不对满血目标治疗', () => {
    const battle = fixture();
    battle.unit('ally').attrs.hp = 200;
    expect(choose(battle)[0].command).toEqual({
      type: 'skill',
      skillId: 'heal',
      targets: ['ally'],
    });
    battle.unit('ally').attrs.hp = 0;
    battle.unit('ally').flags.downed = true;
    expect(choose(battle)[0].command).toEqual({
      type: 'skill',
      skillId: 'revive',
      targets: ['ally'],
    });
  });
  it('无蓝降级普攻，只有捕捉也不会自动捕捉，保留已提交手动指令', () => {
    const battle = fixture();
    battle.unit('player').attrs.mp = 0;
    expect(choose(battle)[0].command).toEqual({
      type: 'attack',
      target: 'enemy',
    });
    expect(choose(fixture(['capture']))[0].command).toEqual({
      type: 'attack',
      target: 'enemy',
    });
    battle.submit('player', { type: 'defend' });
    expect(choose(battle)[0].command).toEqual({ type: 'defend' });
  });
  it('不重复施加已有状态，无合法敌人时防御', () => {
    const battle = fixture(['ward']);
    expect(choose(battle)[0].command.type).toBe('skill');
    battle.applyStatus('player', 'guard', 3);
    expect(choose(battle)[0].command.type).toBe('attack');
    battle.unit('enemy').flags.escaped = true;
    expect(choose(battle)[0].command).toEqual({ type: 'defend' });
  });
  it('小幅属性增益不会挤掉有效输出，估值不改变观察快照', () => {
    const battle = fixture(['ward', 'strike']);
    const observation = observeAutoBattle(battle.snapshot(), 'player', []);
    const before = structuredClone(observation);
    const candidates = rankAutoActions(
      observation,
      'player',
      skills,
      [
        {
          id: 'guard',
          name: '护体',
          kind: 'guard',
          category: 'buff',
          attrMods: { physicalAtk: 1 },
        },
      ],
      battle.queryCommands('player'),
    );
    expect(candidates[0].command).toMatchObject({
      type: 'skill',
      skillId: 'strike',
    });
    expect(
      candidates.find(
        (c) => c.command.type === 'skill' && c.command.skillId === 'ward',
      )!.benefits.control,
    ).toBeCloseTo(0.12);
    expect(observation).toEqual(before);
  });
  it('普通增益排在有效攻击和必要治疗之后', () => {
    const attack: SkillDef = {
      id: 'small-attack',
      name: '攻击',
      tags: ['physical'],
      targeting: { side: 'enemy' },
      effects: [{ type: 'fixedHit', power: 50 }],
    };
    const buff: SkillDef = {
      id: 'buff',
      name: '增益',
      tags: ['support'],
      targeting: { side: 'self' },
      effects: [
        { type: 'applyStatus', statusId: 'aura', duration: 5, self: true },
      ],
    };
    const definitions = [
      {
        id: 'aura',
        name: '增益',
        kind: 'aura',
        category: 'buff' as const,
        physicalDefenseIgnore: 0.1,
      },
    ];
    const battle = fixture(
      [attack.id, buff.id, 'heal'],
      [attack, buff, skills[0]],
    );
    const rank = () =>
      rankAutoActions(
        observeAutoBattle(battle.snapshot(), 'player', definitions),
        'player',
        [attack, buff, skills[0]],
        definitions,
        battle.queryCommands('player'),
      );
    expect(rank()[0].command).toMatchObject({
      type: 'skill',
      skillId: attack.id,
    });
    battle.unit('ally').attrs.hp = 800;
    expect(rank()[0].command).toMatchObject({ type: 'skill', skillId: 'heal' });
  });
  it('下回合休息与自身行动封锁状态只计算一次代价', () => {
    const attack: SkillDef = {
      id: 'resting-attack',
      name: '蓄力攻击',
      tags: ['physical'],
      targeting: { side: 'enemy' },
      effects: [
        { type: 'physicalHit', coeff: 2 },
        { type: 'skipNextAction' },
        { type: 'applyStatus', statusId: 'rest', duration: 1, self: true },
      ],
    };
    const definitions = [
      {
        id: 'rest',
        name: '休息',
        kind: 'rest',
        category: 'control' as const,
        blocksAction: true,
      },
    ];
    const battle = fixture([attack.id], [attack]);
    const candidate = rankAutoActions(
      observeAutoBattle(battle.snapshot(), 'player', definitions),
      'player',
      [attack],
      definitions,
      battle.queryCommands('player'),
    ).find((entry) => entry.command.type === 'skill')!;
    expect(candidate.benefits.survival).toBe(-15);
    expect(candidate.benefits.control).toBe(0);
  });
  it('无蓝时不普攻隐身目标，有感知后可以攻击', () => {
    const battle = fixture([]);
    battle.applyStatus('enemy', 'stealth', 3);
    expect(choose(battle)[0].command).toEqual({ type: 'defend' });
    battle.applyStatus('player', 'reveal', 3);
    expect(choose(battle)[0].command).toEqual({
      type: 'attack',
      target: 'enemy',
    });
  });
  it('准备阶段参与伤害及自损估值，但不改变观察和真实战局', () => {
    const prepared: SkillDef = {
      id: 'prepared',
      name: '先自损后攻击',
      tags: ['spell'],
      targeting: { side: 'enemy' },
      preparation: {
        targetCount: 1,
        effects: [
          { type: 'modifyFact', key: 'ready', value: 1 },
          { type: 'loseHp', power: 100, targeting: { side: 'self' } },
        ],
      },
      effects: [
        {
          type: 'spellHit',
          power: 400,
          when: { expression: 'fact.ready == 1' },
        },
      ],
    };
    const b = fixture([prepared.id], [prepared]);
    const observation = observeAutoBattle(b.snapshot(), 'player', []);
    const before = structuredClone(observation),
      state = b.snapshot();
    const candidates = rankAutoActions(
      observation,
      'player',
      [prepared],
      [],
      b.queryCommands('player'),
    );
    const cast = candidates.find(
      (c) => c.command.type === 'skill' && c.command.skillId === prepared.id,
    )!;
    expect(cast.benefits.offense).toBeGreaterThan(0);
    expect(cast.benefits.survival).toBeLessThan(0);
    expect(observation).toEqual(before);
    expect(b.snapshot()).toEqual(state);
  });
});

describe('通用效用策略与观察边界', () => {
  it('资源蓄积只计算未溢出的收益，满资源不会重复蓄积', () => {
    const charge: SkillDef = {
      id: 'charge',
      name: '蓄势',
      tags: ['support'],
      targeting: { side: 'self' },
      effects: [{ type: 'modifyResource', resourceId: 'energy', amount: 100 }],
    };
    const battle = fixture(['charge'], [charge]);
    battle.unit('player').resources = [
      { id: 'energy', name: '能量', current: 0, max: 100 },
    ];
    const choose = () =>
      automaticCommands(battle.snapshot(), 'player', [charge], (id) =>
        battle.queryCommands(id),
      )[0].command;
    expect(choose()).toMatchObject({ type: 'skill', skillId: 'charge' });
    battle.unit('player').resources[0].current = 100;
    expect(choose().type).toBe('attack');
  });
  for (const type of ['attack', 'defend', 'ruleset', 'automatic'] as const) {
    it(`NPC 的旧 ${type} 配置统一接入效用策略，玩家手动防御保留`, () => {
      const strong: SkillDef = {
        id: 'strong',
        name: '强击',
        tags: ['spell'],
        targeting: { side: 'enemy' },
        effects: [{ type: 'fixedHit', power: 600 }],
      };
      const attrs = {
        hp: 1000,
        maxHp: 1000,
        mp: 100,
        maxMp: 100,
        speed: 50,
        physicalAtk: 50,
        physicalDef: 50,
      };
      const host = new CombatV6PveHostSession({
        playerId: 'player',
        npcStrategies: { enemy: { type } },
        sourceProjectionVersions: COMBAT_V6_PHASE_6D_VERSIONS,
        battleInput: {
          seed: 1,
          ruleset: daoyouRulesetV6,
          versions: {
            ...COMBAT_V6_PHASE_6D_VERSIONS,
            autoPolicyVersion: AUTO_POLICY_VERSION,
          },
          skills: [strong],
          units: [
            { id: 'player', name: '玩家', kind: 'player', side: 0, attrs },
            {
              id: 'enemy',
              name: '敌人',
              kind: 'npc',
              side: 1,
              attrs,
              skills: ['strong'],
            },
          ],
        },
      });
      host.submit('player', { type: 'defend' });
      host.resolveRound();
      expect(
        host.state.units.find((unit) => unit.id === 'enemy')?.lastCommand,
      ).toMatchObject({ type: 'skill', skillId: 'strong' });
      expect(
        host.state.units.find((unit) => unit.id === 'player')?.lastCommand,
      ).toEqual({ type: 'defend' });
    });
  }

  it('群体随机分支不会按每个目标重复展开整组效果', () => {
    const base: SkillDef = {
      id: 'area',
      name: '群攻',
      tags: ['spell'],
      targeting: { side: 'enemy', mode: 'all', count: 2 },
      effects: [
        {
          type: 'fixedHit',
          power: 100,
          targeting: { side: 'enemy', mode: 'all' },
        },
      ],
    };
    const random: SkillDef = {
      ...base,
      id: 'random-area',
      effects: [
        {
          type: 'randomBranch',
          branchId: 'always',
          chance: 1,
          successEffects: base.effects,
          failureEffects: [],
        },
      ],
    };
    const battle = fixture(['area', 'random-area'], [base, random]);
    const snapshot = battle.snapshot();
    snapshot.units.find((unit) => unit.id === 'ally')!.side = 1;
    const observation = observeAutoBattle(snapshot, 'player', []);
    const options = battle.queryCommands('player');
    for (const option of options.skills) {
      option.selectableTargetIds = ['enemy', 'ally'];
      option.targetCount = 2;
    }
    const candidates = rankAutoActions(
      observation,
      'player',
      [base, random],
      [],
      options,
    );
    const skillScore = (id: string) =>
      candidates.find(
        (c) => c.command.type === 'skill' && c.command.skillId === id,
      )!.score;
    expect(skillScore('random-area')).toBe(skillScore('area'));
  });
  it('改变敌方隐藏属性、技能、指令和 RNG，不影响观察和评分', () => {
    const battle = fixture();
    const before = battle.snapshot();
    const changed = structuredClone(before);
    const enemy = changed.units.find((unit) => unit.id === 'enemy')!;
    enemy.attrs.hp *= 100;
    enemy.attrs.maxHp *= 100;
    enemy.attrs.mp *= 10;
    enemy.attrs.maxMp *= 10;
    enemy.attrs.physicalDef = 999999;
    enemy.attrs.magicDef = 999999;
    enemy.skills = ['secret'];
    enemy.skillOverrides = { secret: skills[0] };
    enemy.command = { type: 'skill', skillId: 'secret', targets: ['player'] };
    enemy.lastCommand = { type: 'attack', target: 'player' };
    enemy.flags.defending = true;
    changed.rngState++;
    const observation = observeAutoBattle(before, 'player', []);
    const after = observeAutoBattle(changed, 'player', []);
    expect(after).toEqual(observation);
    expect(
      rankAutoActions(
        after,
        'player',
        skills,
        [],
        battle.queryCommands('player'),
      ),
    ).toEqual(
      rankAutoActions(
        observation,
        'player',
        skills,
        [],
        battle.queryCommands('player'),
      ),
    );
    enemy.attrs.hp /= 2;
    expect(observeAutoBattle(changed, 'player', [])).not.toEqual(observation);
  });

  it('角色规则可覆盖通用评分，但只选择合法候选', () => {
    const battle = fixture(['heal', 'strike']);
    battle.unit('ally').attrs.hp = 800;
    const strategy = {
      version: 1 as const,
      rules: [
        {
          conditions: [{ type: 'allyHpBelow' as const, percent: 90 }],
          action: { type: 'skill' as const, skillId: 'heal' },
          target: 'lowestHpAlly' as const,
        },
      ],
    };
    const choose = () =>
      automaticCommands(
        battle.snapshot(),
        'player',
        skills,
        (id) => battle.queryCommands(id),
        { strategies: { player: strategy } },
      )[0].command;
    expect(choose()).toMatchObject({
      type: 'skill',
      skillId: 'heal',
      targets: ['ally'],
    });
    battle.unit('player').attrs.mp = 0;
    expect(choose().type).toBe('attack');
  });

  it('随机分支按概率估算，不把不可能发生的收益算进去', () => {
    const random: SkillDef = {
      id: 'random',
      name: '随机术',
      tags: ['spell'],
      targeting: { side: 'enemy' },
      effects: [
        {
          type: 'randomBranch',
          branchId: 'coin',
          chance: 0,
          successEffects: [{ type: 'fixedHit', power: 100000 }],
          failureEffects: [],
        },
      ],
    };
    const battle = fixture(['random'], [random]);
    const result = automaticCommands(
      battle.snapshot(),
      'player',
      [random],
      (id) => battle.queryCommands(id),
    );
    expect(result[0].command.type).toBe('attack');
  });

  it('普攻优于高耗低收益技能，不能只因技能可用就施放', () => {
    const weak: SkillDef = {
      ...skills[2],
      id: 'weak',
      costMp: 90,
      effects: [{ type: 'fixedHit', power: 1 }],
    };
    const battle = fixture(['weak'], [weak]);
    expect(
      automaticCommands(battle.snapshot(), 'player', [weak], (id) =>
        battle.queryCommands(id),
      )[0].command.type,
    ).toBe('attack');
  });

  it('人物与灵兽减少重复控制，不把尚未命中当作实际状态', () => {
    const seal: SkillDef = {
      id: 'seal',
      name: '封印',
      tags: ['spell'],
      targeting: { side: 'enemy' },
      effects: [{ type: 'applyStatus', statusId: 'sealed', duration: 3 }],
    };
    const definitions = [
      {
        id: 'sealed',
        name: '封印',
        kind: 'seal',
        category: 'control' as const,
        blocksAction: true,
      },
    ];
    const battle = fixture(['seal'], [seal]);
    battle.unit('pet').skills = ['seal'];
    const observation = observeAutoBattle(
      battle.snapshot(),
      'player',
      definitions,
    );
    const first = rankAutoActions(
      observation,
      'player',
      [seal],
      definitions,
      battle.queryCommands('player'),
    )[0];
    expect(first.command).toMatchObject({ type: 'skill', skillId: 'seal' });
    const independent = rankAutoActions(
      observation,
      'pet',
      [seal],
      definitions,
      battle.queryCommands('pet'),
    )[0];
    const coordinated = rankAutoActions(
      observation,
      'pet',
      [seal],
      definitions,
      battle.queryCommands('pet'),
      first.intents,
    ).find((candidate) => candidate.command.type === 'skill')!;
    expect(coordinated.score).toBeLessThan(independent.score);
    expect(coordinated.score).toBeGreaterThan(0);
    expect(battle.unit('enemy').statuses).toEqual([]);
  });

  it('公开禁复活状态阻止无效救援；已有同类控制不重复施加', () => {
    const battle = fixture();
    const snapshot = battle.snapshot();
    const ally = snapshot.units.find((unit) => unit.id === 'ally')!;
    ally.attrs.hp = 0;
    ally.flags.downed = true;
    ally.statuses = [
      {
        id: 'blocked',
        kind: 'blocked',
        remainingRounds: 3,
        sourceId: 'enemy',
        appliedRound: 1,
        speedMod: 0,
        attrMods: {},
        damageTakenPhysical: 1,
        damageTakenSpell: 1,
        healTaken: 1,
        healDealt: 1,
        stacks: 1,
      },
    ];
    const definitions = [
      { id: 'blocked', name: '禁复活', kind: 'blocked', blocksRevive: true },
    ];
    const candidates = rankAutoActions(
      observeAutoBattle(snapshot, 'player', definitions),
      'player',
      skills,
      definitions,
      battle.queryCommands('player'),
    );
    expect(candidates[0].command).not.toMatchObject({
      type: 'skill',
      skillId: 'revive',
    });
  });
});

for (const definition of Object.values(COMBAT_V6_SECT_DEFINITIONS_V4)) {
  for (const path of definition.paths) {
    it(`${definition.id}/${path.id} 默认战术可连续托管且指令可复现`, () => {
      const player = (id: string): CombatV6TrainingPlayerInput => ({
        cultivator: {
          id,
          name: id,
          realm: '渡劫',
          realm_stage: '圆满',
          attributes: {
            vitality: 50,
            strength: 50,
            spirit: 50,
            endurance: 50,
            speed: 50,
            willpower: 50,
          },
        },
        sect: {
          version: 1,
          sectId: definition.id,
          methods: Object.fromEntries(
            definition.methods.map((m) => [m.id, 60]),
          ),
          activePathId: path.id,
          meridianDepth: 0,
          meridianLoadouts: definition.paths.map((p) => ({
            pathId: p.id,
            nodeIds: [],
            revision: 0,
          })) as CombatV6TrainingPlayerInput['sect']['meridianLoadouts'],
        },
        equipment: {},
        manuals: { version: 1, revision: 0, learned: [], build: { slots: [] } },
        autoStrategy: DEFAULT_AUTO_STRATEGIES[path.id],
      });
      const input = compileRankingBattle([player('a'), player('b')], 47);
      expect(input.autoStrategies).toEqual({
        a: DEFAULT_AUTO_STRATEGIES[path.id],
        b: DEFAULT_AUTO_STRATEGIES[path.id],
      });
      const battle = createBattle({ ...input, ruleset: daoyouRulesetV6 });
      for (let round = 0; round < 8 && !battle.finished; round++) {
        for (const id of ['a', 'b']) {
          const choose = () =>
            automaticCommands(
              battle.snapshot(),
              id,
              input.skills ?? [],
              (unitId) => battle.queryCommands(unitId),
              {
                statusDefs: input.statusDefs,
                strategies: input.autoStrategies,
              },
            );
          const commands = choose();
          expect(choose()).toEqual(commands);
          for (const { unitId, command } of commands) {
            if (command.type === 'skill') {
              const option = battle
                .queryCommands(unitId)
                .skills.find((s) => s.skillId === command.skillId)!;
              expect(option.reasons).toEqual([]);
              expect(
                command.targets.every((target) =>
                  option.selectableTargetIds.includes(target),
                ),
              ).toBe(true);
            }
            battle.submit(unitId, command);
          }
        }
        battle.lockAndResolve();
      }
    });
  }
}
