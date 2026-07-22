import { BattleEngineV5 } from '@shared/engine/battle-v5/BattleEngineV5';
import {
  SeededBattleRandomSource,
  withBattleRandomSource,
} from '@shared/engine/battle-v5/core/BattleRandom';
import { EventBus } from '@shared/engine/battle-v5/core/EventBus';
import type {
  BuffAppliedEvent,
  BuffImmuneEvent,
  CombatResourceChangeEvent,
  DamageTakenEvent,
  DispelEvent,
  HealEvent,
  ShieldEvent,
  SkillCastEvent,
} from '@shared/engine/battle-v5/core/events';
import {
  AbilityType,
  AttributeType,
  BuffType,
  DamageSource,
  DamageType,
  ModifierType,
} from '@shared/engine/battle-v5/core/types';
import { StackRule } from '@shared/engine/battle-v5/buffs/Buff';
import { GameplayTags } from '@shared/engine/shared/tag-domain';
import { AbilityFactory } from '@shared/engine/battle-v5/factories/AbilityFactory';
import { Unit } from '@shared/engine/battle-v5/units/Unit';
import { afterEach, describe, expect, it } from 'vitest';
import { projectSectCombat } from '../..';
import {
  YOUDU_DECREE_PATH_ID,
  YOUDU_SOUL_FIRE,
  YOUDU_SOUL_LOST,
  YOUDU_SOUL_PINNING_NAIL,
  YOUDU_TIDE_PATH_ID,
} from '../ids';
import { youduState, type YouduPathId } from './testState';

interface BuildSpec {
  id: string;
  pathId: YouduPathId;
  tacticId: string;
  loadout: string[];
  nodes: string[];
}

interface SimulationMetrics {
  buildId: string;
  length: keyof typeof TARGET_HP;
  turns: number;
  actions: number;
  directDamage: number;
  soulDamage: number;
  delayedSoulDamage: number;
  finishCasts: number;
  soulFireGained: number;
  soulFireSpent: number;
  soulFireOverflow: number;
  soulFireOverflowRate: number;
  soulLostApplied: number;
  pinApplied: number;
  basicAttackRate: number;
  delayedSoulDamageRate: number;
  controlRate: number;
}

type CounterplayScenario =
  | 'healing'
  | 'control'
  | 'cleanse'
  | 'shield'
  | 'debuff-immunity'
  | 'fast-attack';

interface CounterplayMetrics {
  scenario: CounterplayScenario;
  winner: string;
  turns: number;
  healingEvents: number;
  suppressedHealing: number;
  controlApplications: number;
  dispels: number;
  shields: number;
  shieldAbsorbed: number;
  debuffImmunities: number;
  maxErosionLayer: number;
}

const TARGET_HP = {
  short: 2_800,
  medium: 7_000,
  long: 14_000,
} as const;

const TIDE_NODES = [
  'tide-first-ripple',
  'tide-never-ebbs',
  'tide-three-souls-far',
  'tide-no-return-current',
  'tide-hundred-ghosts',
  'tide-lament-deepens',
];

const DECREE_NODES = [
  'decree-iron-enters-shadow',
  'decree-bright-prison-fire',
  'decree-three-souls-leave',
  'decree-iron-law',
  'decree-one-name-one-judgment',
  'decree-seven-inch-severance',
];

const BUILDS: BuildSpec[] = [
  {
    id: 'tide-cycle',
    pathId: YOUDU_TIDE_PATH_ID,
    tacticId: 'tide-cycle',
    loadout: ['soul-severing-call', 'forgetful-river-tide', 'pin-soul', 'soul-shall-not-return'],
    nodes: TIDE_NODES,
  },
  {
    id: 'healer-drown',
    pathId: YOUDU_TIDE_PATH_ID,
    tacticId: 'healer-drown',
    loadout: ['forgetful-river-tide', 'seize-soul', 'pin-soul', 'reveal-shadow'],
    nodes: TIDE_NODES,
  },
  {
    id: 'long-night',
    pathId: YOUDU_TIDE_PATH_ID,
    tacticId: 'long-night',
    loadout: ['forgetful-river-tide', 'soul-severing-call', 'reveal-shadow', 'soul-shall-not-return'],
    nodes: TIDE_NODES,
  },
  {
    id: 'pin-the-caster',
    pathId: YOUDU_DECREE_PATH_ID,
    tacticId: 'pin-the-caster',
    loadout: ['reveal-shadow', 'soul-severing-call', 'pin-soul', 'soul-shall-not-return'],
    nodes: DECREE_NODES,
  },
  {
    id: 'judge-at-four',
    pathId: YOUDU_DECREE_PATH_ID,
    tacticId: 'judge-at-four',
    loadout: ['soul-severing-call', 'seize-soul', 'pin-soul', 'soul-shall-not-return'],
    nodes: DECREE_NODES,
  },
  {
    id: 'take-the-fifth',
    pathId: YOUDU_DECREE_PATH_ID,
    tacticId: 'take-the-fifth',
    loadout: ['soul-severing-call', 'seize-soul', 'pin-soul', 'soul-shall-not-return'],
    nodes: DECREE_NODES,
  },
];

function unit(id: string): Unit {
  return new Unit(id, id, {
    [AttributeType.VITALITY]: 120,
    [AttributeType.SPIRIT]: 120,
    [AttributeType.WISDOM]: 120,
    [AttributeType.SPEED]: 120,
    [AttributeType.WILLPOWER]: 120,
  });
}

function installProjection(player: Unit, spec: BuildSpec): void {
  const sect = youduState(spec.pathId, spec.nodes, spec.loadout);
  const path = sect.paths.find((entry) => entry.pathId === spec.pathId);
  if (path) path.tacticId = spec.tacticId;
  const projection = projectSectCombat({ sect, realm: '化神' })!;
  for (const resource of projection.resources) player.combatResources.define(resource);
  if (projection.defaultAttack) {
    player.abilities.setDefaultAttack(AbilityFactory.create(projection.defaultAttack));
  }
  for (const ability of projection.abilities) {
    player.abilities.addAbility(AbilityFactory.create(ability));
  }
  if (projection.selectionStrategy) {
    player.abilities.setSelectionStrategy(projection.selectionStrategy);
  }
}

function installCounterplay(opponent: Unit, scenario: CounterplayScenario): void {
  const addActive = (config: Parameters<typeof AbilityFactory.create>[0]) => {
    opponent.abilities.addAbility(AbilityFactory.create(config));
  };

  if (scenario === 'healing') {
    addActive({
      slug: 'simulation.healing',
      name: '回春术',
      type: AbilityType.ACTIVE_SKILL,
      tags: [GameplayTags.ABILITY.KIND.SKILL, GameplayTags.ABILITY.FUNCTION.HEAL],
      cooldown: 2,
      priority: 80,
      targetPolicy: { team: 'self', scope: 'single' },
      selectionProfile: { intents: ['heal_hp'] },
      effects: [{
        type: 'heal',
        params: { value: { targetMaxHpRatio: 0.28 }, recipient: 'caster' },
      }],
    });
  }

  if (scenario === 'control') {
    addActive({
      slug: 'simulation.control',
      name: '封灵印',
      type: AbilityType.ACTIVE_SKILL,
      tags: [
        GameplayTags.ABILITY.KIND.SKILL,
        GameplayTags.ABILITY.FUNCTION.CONTROL,
      ],
      cooldown: 2,
      priority: 80,
      targetPolicy: { team: 'enemy', scope: 'single' },
      selectionProfile: { intents: ['control'] },
      effects: [{
        type: 'apply_buff',
        params: {
          buffConfig: {
            id: 'simulation.control.no-skill',
            name: '封灵',
            type: BuffType.CONTROL,
            duration: 1,
            stackRule: StackRule.REFRESH_DURATION,
            tags: [GameplayTags.BUFF.TYPE.DEBUFF, GameplayTags.BUFF.TYPE.CONTROL],
            statusTags: [GameplayTags.STATUS.CONTROL.NO_SKILL],
          },
        },
      }],
    });
  }

  if (scenario === 'cleanse') {
    addActive({
      slug: 'simulation.cleanse',
      name: '澄心诀',
      type: AbilityType.ACTIVE_SKILL,
      tags: [GameplayTags.ABILITY.KIND.SKILL, GameplayTags.ABILITY.FUNCTION.BUFF],
      cooldown: 2,
      priority: 90,
      targetPolicy: { team: 'self', scope: 'single' },
      selectionProfile: { intents: ['buff'] },
      effects: [{
        type: 'dispel',
        params: { status: 'negative', recipient: 'caster', maxCount: 1 },
      }],
    });
  }

  if (scenario === 'shield') {
    addActive({
      slug: 'simulation.shield',
      name: '玄甲护身',
      type: AbilityType.ACTIVE_SKILL,
      tags: [GameplayTags.ABILITY.KIND.SKILL, GameplayTags.ABILITY.FUNCTION.BUFF],
      cooldown: 3,
      priority: 70,
      targetPolicy: { team: 'self', scope: 'single' },
      selectionProfile: { intents: ['defensive'] },
      effects: [{
        type: 'shield',
        params: { value: { base: 900 }, target: 'caster' },
      }],
    });
  }

  if (scenario === 'debuff-immunity') {
    opponent.abilities.addAbility(AbilityFactory.create({
      slug: 'simulation.debuff-immunity',
      name: '万法不侵',
      type: AbilityType.PASSIVE_SKILL,
      tags: [GameplayTags.ABILITY.KIND.PASSIVE],
      listeners: [{
        id: 'simulation.debuff-immunity.listener',
        eventType: GameplayTags.EVENT.BUFF_ADD,
        scope: GameplayTags.SCOPE.OWNER_AS_TARGET,
        priority: 40,
        effects: [{
          type: 'buff_immunity',
          params: { tags: [GameplayTags.BUFF.TYPE.DEBUFF] },
        }],
      }],
    }));
  }

  if (scenario === 'fast-attack') {
    opponent.attributes.addModifier({
      id: 'simulation-fast-speed',
      attrType: AttributeType.SPEED,
      type: ModifierType.OVERRIDE,
      value: 300,
      source: 'simulation',
    });
    opponent.updateDerivedStats();
    addActive({
      slug: 'simulation.fast-attack',
      name: '破阵连袭',
      type: AbilityType.ACTIVE_SKILL,
      tags: [
        GameplayTags.ABILITY.KIND.SKILL,
        GameplayTags.ABILITY.FUNCTION.DAMAGE,
        GameplayTags.ABILITY.CHANNEL.PHYSICAL,
      ],
      priority: 100,
      targetPolicy: { team: 'enemy', scope: 'single' },
      selectionProfile: { intents: ['damage'] },
      effects: [{
        type: 'damage',
        params: {
          value: { attribute: AttributeType.ATK, coefficient: 4 },
          damageType: DamageType.PHYSICAL,
        },
      }],
    });
  }
}

function simulateCounterplay(
  spec: BuildSpec,
  scenario: CounterplayScenario,
): CounterplayMetrics {
  EventBus.instance.reset();
  const player = unit(`youdu-${scenario}`);
  const opponent = unit(`counterplay-${scenario}`);
  opponent.attributes.addModifier({
    id: `simulation-counterplay-hp-${scenario}`,
    attrType: AttributeType.MAX_HP,
    type: ModifierType.OVERRIDE,
    value: TARGET_HP.medium,
    source: 'simulation',
  });
  opponent.updateDerivedStats();
  opponent.setHp(opponent.getMaxHp());
  installProjection(player, spec);
  installCounterplay(opponent, scenario);

  const metrics: CounterplayMetrics = {
    scenario,
    winner: '',
    turns: 0,
    healingEvents: 0,
    suppressedHealing: 0,
    controlApplications: 0,
    dispels: 0,
    shields: 0,
    shieldAbsorbed: 0,
    debuffImmunities: 0,
    maxErosionLayer: 0,
  };
  EventBus.instance.subscribe<HealEvent>('HealEvent', (event) => {
    if (event.target !== opponent || event.healType === 'mp') return;
    metrics.healingEvents += 1;
    metrics.suppressedHealing += event.healAmount - (event.appliedAmount ?? event.healAmount);
  }, -1_000);
  EventBus.instance.subscribe<BuffAppliedEvent>('BuffAppliedEvent', (event) => {
    if (event.target === player && event.buff.id === 'simulation.control.no-skill') {
      metrics.controlApplications += 1;
    }
    if (event.target === opponent && event.buff.id === 'sect.youdu.soul-erosion') {
      metrics.maxErosionLayer = Math.max(metrics.maxErosionLayer, event.buff.getLayer());
    }
  }, -1_000);
  EventBus.instance.subscribe<DispelEvent>('DispelEvent', (event) => {
    if (event.target === opponent && event.removedBuffNames.includes('蚀魂')) {
      metrics.dispels += 1;
    }
  }, -1_000);
  EventBus.instance.subscribe<ShieldEvent>('ShieldEvent', (event) => {
    if (event.target === opponent) metrics.shields += 1;
  }, -1_000);
  EventBus.instance.subscribe<DamageTakenEvent>('DamageTakenEvent', (event) => {
    if (event.target !== opponent) return;
    metrics.shieldAbsorbed += event.shieldAbsorbed ?? 0;
    const erosion = opponent.buffs.getAllBuffs().find(
      (buff) => buff.id === 'sect.youdu.soul-erosion',
    );
    metrics.maxErosionLayer = Math.max(metrics.maxErosionLayer, erosion?.getLayer() ?? 0);
  }, -1_000);
  EventBus.instance.subscribe<BuffImmuneEvent>('BuffImmuneEvent', (event) => {
    if (event.target === opponent && event.buff.id === 'sect.youdu.soul-erosion') {
      metrics.debuffImmunities += 1;
    }
  }, -1_000);

  const engine = new BattleEngineV5(player, opponent);
  const result = withBattleRandomSource(
    new SeededBattleRandomSource(`youdu-counterplay-${scenario}`),
    () => engine.execute(),
  );
  engine.destroy();
  metrics.winner = result.winner;
  metrics.turns = result.turns;
  return metrics;
}

function simulate(
  spec: BuildSpec,
  length: keyof typeof TARGET_HP,
  seed: string,
): SimulationMetrics {
  EventBus.instance.reset();
  const player = unit('youdu-player');
  const opponent = unit('training-puppet');
  opponent.attributes.addModifier({
    id: `simulation-hp-${length}`,
    attrType: AttributeType.MAX_HP,
    type: ModifierType.OVERRIDE,
    value: TARGET_HP[length],
    source: 'simulation',
  });
  opponent.updateDerivedStats();
  opponent.setHp(opponent.getMaxHp());

  installProjection(player, spec);

  let actions = 0;
  let basicAttacks = 0;
  let directDamage = 0;
  let soulDamage = 0;
  let delayedSoulDamage = 0;
  let finishCasts = 0;
  let soulFireGained = 0;
  let soulFireSpent = 0;
  let soulFireOverflow = 0;
  let soulLostApplied = 0;
  let pinApplied = 0;

  EventBus.instance.subscribe<SkillCastEvent>('SkillCastEvent', (event) => {
    if (event.caster !== player) return;
    actions += 1;
    if (event.ability.id === 'sect.youdu.one-sigh') basicAttacks += 1;
    if (event.ability.id === 'sect.youdu.soul-shall-not-return') finishCasts += 1;
  }, -1_000);
  EventBus.instance.subscribe<DamageTakenEvent>('DamageTakenEvent', (event) => {
    if (event.caster !== player) return;
    if (event.damageSource === DamageSource.DIRECT) directDamage += event.damageTaken;
    if (event.damageType === DamageType.TRUE) soulDamage += event.damageTaken;
    if (
      event.damageType === DamageType.TRUE &&
      event.damageSource === DamageSource.DELAYED
    ) delayedSoulDamage += event.damageTaken;
  }, -1_000);
  EventBus.instance.subscribe<CombatResourceChangeEvent>(
    'CombatResourceChangeEvent',
    (event) => {
      if (event.target !== player || event.resourceId !== YOUDU_SOUL_FIRE) return;
      if (event.applied > 0) soulFireGained += event.applied;
      if (event.applied < 0) soulFireSpent += -event.applied;
      soulFireOverflow += event.overflow;
    },
    -1_000,
  );
  EventBus.instance.subscribe<BuffAppliedEvent>('BuffAppliedEvent', (event) => {
    if (event.target !== opponent) return;
    if (event.buff.id === YOUDU_SOUL_LOST) soulLostApplied += 1;
    if (event.buff.id === YOUDU_SOUL_PINNING_NAIL) pinApplied += 1;
  }, -1_000);

  const engine = new BattleEngineV5(player, opponent);
  const result = withBattleRandomSource(
    new SeededBattleRandomSource(seed),
    () => engine.execute(),
  );
  engine.destroy();

  return {
    buildId: spec.id,
    length,
    turns: result.turns,
    actions,
    directDamage,
    soulDamage,
    delayedSoulDamage,
    finishCasts,
    soulFireGained,
    soulFireSpent,
    soulFireOverflow,
    soulFireOverflowRate:
      soulFireOverflow / Math.max(1, soulFireGained + soulFireOverflow),
    soulLostApplied,
    pinApplied,
    basicAttackRate: basicAttacks / Math.max(1, actions),
    delayedSoulDamageRate: delayedSoulDamage / Math.max(1, soulDamage),
    controlRate: (soulLostApplied + pinApplied) / Math.max(1, actions),
  };
}

const TURN_BOUNDS = {
  short: [4, 15],
  medium: [8, 32],
  long: [12, 42],
} as const;

describe('幽都固定种子短中长战平衡契约', () => {
  afterEach(() => EventBus.instance.reset());

  it.each(['short', 'medium', 'long'] as const)(
    '%s战覆盖双道途六套战术并记录铺层、魂火、控制与终结指标',
    (length) => {
      const results = BUILDS.map((build) =>
        simulate(build, length, `youdu-${length}-${build.id}`),
      );

      expect(results).toHaveLength(6);
      for (const metrics of results) {
        expect(metrics.actions).toBeGreaterThan(0);
        expect(metrics.directDamage).toBeGreaterThan(0);
        expect(metrics.soulDamage).toBeGreaterThan(0);
        expect(metrics.soulFireGained).toBeGreaterThan(0);
        expect(metrics.soulFireSpent).toBeLessThanOrEqual(metrics.soulFireGained);
        expect(metrics.basicAttackRate).toBeLessThanOrEqual(0.35);
        expect(metrics.controlRate).toBeLessThanOrEqual(0.65);
        expect(metrics.soulFireOverflowRate).toBeLessThanOrEqual(0.65);
        expect(metrics.finishCasts).toBeLessThanOrEqual(
          Math.ceil(metrics.actions / 3),
        );
        expect(metrics.soulLostApplied).toBeLessThanOrEqual(
          Math.ceil(metrics.actions / 2),
        );
        expect(metrics.turns).toBeGreaterThanOrEqual(TURN_BOUNDS[length][0]);
        expect(metrics.turns).toBeLessThanOrEqual(TURN_BOUNDS[length][1]);
      }
      const tideResults = results.filter((metrics) =>
        ['tide-cycle', 'healer-drown', 'long-night'].includes(metrics.buildId),
      );
      expect(tideResults.every((metrics) => metrics.delayedSoulDamageRate >= 0.1))
        .toBe(true);
      expect(tideResults.every((metrics) => metrics.delayedSoulDamageRate <= 0.8))
        .toBe(true);
      expect(results.find((metrics) => metrics.buildId === 'tide-cycle')?.finishCasts)
        .toBeGreaterThan(0);
      expect(results.find((metrics) => metrics.buildId === 'long-night')?.finishCasts)
        .toBeGreaterThan(0);
      expect(results.find((metrics) => metrics.buildId === 'judge-at-four')?.finishCasts)
        .toBeGreaterThan(0);
      expect(results.reduce((total, metrics) => total + metrics.soulLostApplied, 0))
        .toBeGreaterThan(0);
      expect(results.reduce((total, metrics) => total + metrics.pinApplied, 0))
        .toBeGreaterThan(0);
    },
  );

  it('同一构筑与种子重复执行得到相同核心指标', () => {
    const build = BUILDS.find((entry) => entry.id === 'judge-at-four')!;
    const first = simulate(build, 'medium', 'youdu-deterministic');
    const second = simulate(build, 'medium', 'youdu-deterministic');

    expect(second).toEqual(first);
  });

  it('治疗、控制、净化、护盾、减益免疫与快攻均进入确定性反制样本', () => {
    const build = (id: string) => BUILDS.find((entry) => entry.id === id)!;
    const results = [
      simulateCounterplay(build('healer-drown'), 'healing'),
      simulateCounterplay(build('pin-the-caster'), 'control'),
      simulateCounterplay(build('tide-cycle'), 'cleanse'),
      simulateCounterplay(build('judge-at-four'), 'shield'),
      simulateCounterplay(build('tide-cycle'), 'debuff-immunity'),
      simulateCounterplay(build('long-night'), 'fast-attack'),
    ];

    expect(results).toHaveLength(6);
    expect(results.find((entry) => entry.scenario === 'healing')).toMatchObject({
      healingEvents: expect.any(Number),
    });
    expect(results.find((entry) => entry.scenario === 'healing')!.healingEvents)
      .toBeGreaterThan(0);
    expect(results.find((entry) => entry.scenario === 'healing')!.suppressedHealing)
      .toBeGreaterThan(0);
    expect(results.find((entry) => entry.scenario === 'control')!.controlApplications)
      .toBeGreaterThan(0);
    expect(results.find((entry) => entry.scenario === 'cleanse')!.dispels)
      .toBeGreaterThan(0);
    expect(results.find((entry) => entry.scenario === 'shield')!.shields)
      .toBeGreaterThan(0);
    expect(results.find((entry) => entry.scenario === 'shield')!.shieldAbsorbed)
      .toBeGreaterThan(0);
    expect(results.find((entry) => entry.scenario === 'debuff-immunity')!.debuffImmunities)
      .toBeGreaterThan(0);
    expect(results.find((entry) => entry.scenario === 'debuff-immunity')!.maxErosionLayer)
      .toBe(0);
    const fastAttack = results.find((entry) => entry.scenario === 'fast-attack')!;
    expect(fastAttack.winner).toBe('counterplay-fast-attack');
    expect(fastAttack.turns).toBeLessThanOrEqual(3);
  });
});
