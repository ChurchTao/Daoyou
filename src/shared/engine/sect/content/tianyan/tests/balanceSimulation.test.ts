import { BattleEngineV5 } from '@shared/engine/battle-v5/BattleEngineV5';
import {
  SeededBattleRandomSource,
  withBattleRandomSource,
} from '@shared/engine/battle-v5/core/BattleRandom';
import { EventBus } from '@shared/engine/battle-v5/core/EventBus';
import type {
  AbilityCostPaidEvent,
  BuffAppliedEvent,
  DamageTakenEvent,
  HealEvent,
  MechanicLogEvent,
  ShieldEvent,
  SkillCastEvent,
} from '@shared/engine/battle-v5/core/events';
import { getBattleRuntimeState } from '@shared/engine/battle-v5/core/runtimeState';
import {
  AttributeType,
  BuffType,
  DamageSource,
  ModifierType,
} from '@shared/engine/battle-v5/core/types';
import { AbilityFactory } from '@shared/engine/battle-v5/factories/AbilityFactory';
import { Unit } from '@shared/engine/battle-v5/units/Unit';
import { afterEach, describe, expect, it } from 'vitest';
import { projectSectCombat } from '../..';
import {
  TIANYAN_HETU_PATH_ID,
  TIANYAN_LUOSHU_PATH_ID,
} from '../ids';
import { tianyanState, type TianyanPathId } from './testState';

interface BuildSpec {
  id: string;
  pathId: TianyanPathId;
  tacticId: string;
  loadout: string[];
  nodes?: string[];
}

interface SimulationMetrics {
  buildId: string;
  length: keyof typeof TARGET_HP;
  turns: number;
  actions: number;
  directDamage: number;
  averageDirectDamage: number;
  reactions: number;
  reactionCoverage: number;
  firstTrinaryRound: number | null;
  trinaryWithinTenRounds: number;
  mpExhaustedRound: number | null;
  sustainRatio: number;
  controlCoverage: number;
  noReactionCovers: number;
  basicAttackRate: number;
}

const TARGET_HP = {
  short: 2_800,
  medium: 7_000,
  long: 14_000,
} as const;

const BUILDS: BuildSpec[] = [
  {
    id: 'cycle-wood-fire-water',
    pathId: TIANYAN_HETU_PATH_ID,
    tacticId: 'small-cycle',
    loadout: ['verdant-pulse', 'flowing-flame', 'dark-water-return', 'shift-palace'],
  },
  {
    id: 'cycle-fire-earth-wood',
    pathId: TIANYAN_HETU_PATH_ID,
    tacticId: 'small-cycle',
    loadout: ['flowing-flame', 'earth-bearing-seal', 'verdant-pulse', 'shift-palace'],
  },
  {
    id: 'cycle-earth-metal-fire',
    pathId: TIANYAN_HETU_PATH_ID,
    tacticId: 'small-cycle',
    loadout: ['earth-bearing-seal', 'metal-cloud-cutter', 'flowing-flame', 'shift-palace'],
  },
  {
    id: 'cycle-metal-water-earth',
    pathId: TIANYAN_HETU_PATH_ID,
    tacticId: 'small-cycle',
    loadout: ['metal-cloud-cutter', 'dark-water-return', 'earth-bearing-seal', 'shift-palace'],
  },
  {
    id: 'cycle-water-wood-metal',
    pathId: TIANYAN_HETU_PATH_ID,
    tacticId: 'small-cycle',
    loadout: ['dark-water-return', 'verdant-pulse', 'metal-cloud-cutter', 'shift-palace'],
  },
  {
    id: 'four-element-wide',
    pathId: TIANYAN_HETU_PATH_ID,
    tacticId: 'small-cycle',
    loadout: ['verdant-pulse', 'flowing-flame', 'metal-cloud-cutter', 'dark-water-return'],
  },
  {
    id: 'two-element-guard',
    pathId: TIANYAN_HETU_PATH_ID,
    tacticId: 'nourish-origin',
    loadout: ['flowing-flame', 'earth-bearing-seal', 'myriad-wood-renewal', 'boundless-earth'],
  },
  {
    id: 'derivation-caster',
    pathId: TIANYAN_LUOSHU_PATH_ID,
    tacticId: 'decisive-derivation',
    loadout: ['flowing-flame', 'dark-water-return', 'shift-palace', 'five-qi-repository'],
  },
  {
    id: 'hetu-pure-reaction',
    pathId: TIANYAN_HETU_PATH_ID,
    tacticId: 'small-cycle',
    loadout: ['verdant-pulse', 'flowing-flame', 'earth-bearing-seal', 'dark-water-return'],
    nodes: ['hetu-first-number', 'hetu-flow-refund', 'hetu-river-cleansing', 'hetu-three-talents', 'hetu-number-remains', 'hetu-one-line-opens'],
  },
  {
    id: 'hetu-double-utility',
    pathId: TIANYAN_HETU_PATH_ID,
    tacticId: 'nourish-origin',
    loadout: ['flowing-flame', 'dark-water-return', 'myriad-wood-renewal', 'boundless-earth'],
    nodes: ['hetu-blank-breath', 'hetu-flow-refund', 'hetu-verdant-endless', 'hetu-generation-gate', 'hetu-inner-outer', 'hetu-escaped-one-returns'],
  },
  {
    id: 'luoshu-control',
    pathId: TIANYAN_LUOSHU_PATH_ID,
    tacticId: 'lock-meridian',
    loadout: ['earth-bearing-seal', 'metal-cloud-cutter', 'dark-water-return', 'shift-palace'],
    nodes: ['luoshu-observe-gap', 'luoshu-fast-shift', 'luoshu-metal-water', 'luoshu-lock-position', 'luoshu-chain-control', 'luoshu-nine-changes'],
  },
  {
    id: 'luoshu-low-hp-burst',
    pathId: TIANYAN_LUOSHU_PATH_ID,
    tacticId: 'break-pattern',
    loadout: ['verdant-pulse', 'flowing-flame', 'metal-cloud-cutter', 'dark-water-return'],
    nodes: ['luoshu-first-number', 'luoshu-reverse-two', 'luoshu-flame-flow', 'luoshu-exploit-weakness', 'luoshu-shatter-seal', 'luoshu-heaven-ends'],
  },
];

function unit(id: string, values: Partial<Record<AttributeType, number>>): Unit {
  const result = new Unit(id, id, {
    [AttributeType.VITALITY]: values[AttributeType.VITALITY] ?? 120,
    [AttributeType.SPIRIT]: values[AttributeType.SPIRIT] ?? 120,
    [AttributeType.WISDOM]: values[AttributeType.WISDOM] ?? 120,
    [AttributeType.SPEED]: values[AttributeType.SPEED] ?? 120,
    [AttributeType.WILLPOWER]: values[AttributeType.WILLPOWER] ?? 120,
  });
  result.restoreMp(100_000);
  return result;
}

function simulate(
  spec: BuildSpec,
  length: keyof typeof TARGET_HP,
  seed: string,
): SimulationMetrics {
  EventBus.instance.reset();
  const sect = tianyanState(spec.pathId, spec.nodes ?? []);
  sect.abilityLoadout = spec.loadout;
  const path = sect.paths.find((entry) => entry.pathId === spec.pathId);
  if (path) path.tacticId = spec.tacticId;
  const projection = projectSectCombat({ sect, realm: '化神' })!;
  const player = unit('tianyan-player', {});
  const opponent = unit('training-puppet', {
    [AttributeType.VITALITY]: 60,
    [AttributeType.SPIRIT]: 70,
    [AttributeType.WISDOM]: 60,
    [AttributeType.SPEED]: 70,
    [AttributeType.WILLPOWER]: 70,
  });
  opponent.attributes.addModifier({
    id: `simulation-hp-${length}`,
    attrType: AttributeType.MAX_HP,
    type: ModifierType.OVERRIDE,
    value: TARGET_HP[length],
  });
  opponent.updateDerivedStats();
  opponent.setHp(opponent.getMaxHp());

  for (const resource of projection.resources) player.combatResources.define(resource);
  if (projection.defaultAttack) {
    player.abilities.setDefaultAttack(AbilityFactory.create(projection.defaultAttack));
  }
  for (const config of projection.abilities) {
    player.abilities.addAbility(AbilityFactory.create(config));
  }
  if (projection.selectionStrategy) {
    player.abilities.setSelectionStrategy(projection.selectionStrategy);
  }

  let actions = 0;
  let directDamage = 0;
  let reactions = 0;
  let trinary = 0;
  let firstTrinaryRound: number | null = null;
  let trinaryWithinTenRounds = 0;
  let mpExhaustedRound: number | null = null;
  let healing = 0;
  let shielding = 0;
  let controls = 0;
  let replacements = 0;
  let basicAttacks = 0;

  EventBus.instance.subscribe<SkillCastEvent>('SkillCastEvent', (event) => {
    if (event.caster !== player) return;
    actions += 1;
    if (event.ability.id === 'sect.tianyan.primordial-ray') basicAttacks += 1;
  }, -1_000);
  EventBus.instance.subscribe<DamageTakenEvent>('DamageTakenEvent', (event) => {
    if (event.caster === player && event.damageSource === DamageSource.DIRECT) {
      directDamage += event.damageTaken;
    }
  }, -1_000);
  EventBus.instance.subscribe<MechanicLogEvent>('MechanicLogEvent', (event) => {
    if (event.source !== player) return;
    if (
      event.mechanic === 'named_trigger' &&
      event.internalKey?.startsWith('sect.tianyan.reaction.')
    ) reactions += 1;
    if (
      event.mechanic === 'named_trigger' &&
      (event.internalKey === 'sect.tianyan.hetu-cycle' ||
        event.internalKey === 'sect.tianyan.luoshu-break')
    ) {
      trinary += 1;
      const round = getBattleRuntimeState(player).round;
      firstTrinaryRound ??= round;
      if (round <= 10) trinaryWithinTenRounds += 1;
    }
    if (event.mechanic === 'status_transition' && event.operation === 'replace') {
      replacements += 1;
    }
  }, -1_000);
  EventBus.instance.subscribe<AbilityCostPaidEvent>('AbilityCostPaidEvent', (event) => {
    if (event.caster === player && event.afterMp <= 0) {
      mpExhaustedRound ??= getBattleRuntimeState(player).round;
    }
  }, -1_000);
  EventBus.instance.subscribe<HealEvent>('HealEvent', (event) => {
    if (event.caster === player && event.healType !== 'mp') {
      healing += event.appliedAmount ?? event.healAmount;
    }
  }, -1_000);
  EventBus.instance.subscribe<ShieldEvent>('ShieldEvent', (event) => {
    if (event.caster === player) shielding += event.shieldAmount;
  }, -1_000);
  EventBus.instance.subscribe<BuffAppliedEvent>('BuffAppliedEvent', (event) => {
    if (event.source === player && event.buff.type === BuffType.CONTROL) controls += 1;
  }, -1_000);

  const engine = new BattleEngineV5(player, opponent);
  const result = withBattleRandomSource(
    new SeededBattleRandomSource(seed),
    () => engine.execute(),
  );
  engine.destroy();

  const safeActions = Math.max(1, actions);
  return {
    buildId: spec.id,
    length,
    turns: result.turns,
    actions,
    directDamage,
    averageDirectDamage: directDamage / safeActions,
    reactions,
    reactionCoverage: reactions / safeActions,
    firstTrinaryRound,
    trinaryWithinTenRounds,
    mpExhaustedRound,
    sustainRatio: (healing + shielding) / player.getMaxHp(),
    controlCoverage: controls / safeActions,
    noReactionCovers: Math.max(0, replacements - reactions),
    basicAttackRate: basicAttacks / safeActions,
  };
}

describe('天衍固定种子短中长战平衡冒烟', () => {
  afterEach(() => EventBus.instance.reset());

  it.each(['short', 'medium', 'long'] as const)(
    '%s战覆盖五种小周天与七类推荐构筑，并记录关键预算指标',
    (length) => {
      const results = BUILDS.map((build) =>
        simulate(build, length, `tianyan-${length}-${build.id}`),
      );

      expect(results).toHaveLength(12);
      for (const metrics of results) {
        expect(metrics.actions).toBeGreaterThan(0);
        expect(metrics.directDamage).toBeGreaterThan(0);
        expect(Number.isFinite(metrics.averageDirectDamage)).toBe(true);
        expect(metrics.reactionCoverage).toBeGreaterThanOrEqual(0);
        expect(metrics.reactionCoverage).toBeLessThanOrEqual(1);
        expect(metrics.controlCoverage).toBeGreaterThanOrEqual(0);
        expect(metrics.controlCoverage).toBeLessThanOrEqual(1);
        expect(metrics.basicAttackRate).toBeGreaterThanOrEqual(0);
        expect(metrics.basicAttackRate).toBeLessThanOrEqual(1);
        expect(metrics.trinaryWithinTenRounds).toBeLessThanOrEqual(5);
        expect(metrics.noReactionCovers).toBeLessThanOrEqual(metrics.actions);
        expect(Number.isFinite(metrics.sustainRatio)).toBe(true);
      }
    },
  );

  it('同一构筑与种子重复执行得到相同核心指标', () => {
    const build = BUILDS.find((entry) => entry.id === 'luoshu-control')!;
    const first = simulate(build, 'medium', 'tianyan-deterministic');
    const second = simulate(build, 'medium', 'tianyan-deterministic');

    expect(second).toEqual(first);
  });
});
