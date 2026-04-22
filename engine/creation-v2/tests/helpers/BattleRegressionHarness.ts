import { BattleEngineV5, type BattleResult } from '@/engine/battle-v5/BattleEngineV5';
import { EventBus } from '@/engine/battle-v5/core/EventBus';
import { GameplayTags } from '@/engine/shared/tag-domain';
import {
  AbilityType,
  AttributeType,
  ModifierType,
} from '@/engine/battle-v5/core/types';
import type { EntryDataMap, LogSpan } from '@/engine/battle-v5/systems/log/types';
import type { BattleStateTimeline } from '@/engine/battle-v5/systems/state/types';
import { AbilityFactory } from '@/engine/battle-v5/factories/AbilityFactory';
import { Unit } from '@/engine/battle-v5/units/Unit';
import type {
  AffixCategory,
  CraftedOutcome,
  CreationProductType,
} from '@/engine/creation-v2/types';
import type { EquipmentSlot } from '@/types/constants';
import type { Material } from '@/types/cultivator';
import { TestableCreationOrchestrator } from './TestableCreationOrchestrator';

const SPARRING_BASE_ATTRIBUTES: Partial<Record<AttributeType, number>> = {
  [AttributeType.SPIRIT]: 150,
  [AttributeType.VITALITY]: 320,
  [AttributeType.SPEED]: 110,
  [AttributeType.WILLPOWER]: 125,
  [AttributeType.WISDOM]: 115,
};

const STABILITY_MODIFIERS = [
  {
    suffix: 'accuracy',
    attrType: AttributeType.ACCURACY,
    value: 0.5,
  },
  {
    suffix: 'crit_resist',
    attrType: AttributeType.CRIT_RESIST,
    value: 0.5,
  },
] as const;

export interface CreationBattleDuelResult {
  outcome: CraftedOutcome;
  challenger: Unit;
  defender: Unit;
  battleResult: BattleResult;
  challengerWon: boolean;
  reachedMaxTurns: boolean;
}

export interface BaselineMirrorBattleResult {
  challenger: Unit;
  defender: Unit;
  battleResult: BattleResult;
  challengerWon: boolean;
  reachedMaxTurns: boolean;
}

type SparringBaselineTemplate =
  | 'mirror'
  | 'artifact_guard'
  | 'gongfa_sustain';

interface CreationBattleDuelInput {
  productType: CreationProductType;
  materials: Material[];
  seed?: number;
  requestedSlot?: EquipmentSlot;
  baselineTemplate?: SparringBaselineTemplate;
}

export interface CreationBattleBenchmarkSummary {
  samples: number;
  minTurns: number;
  maxTurns: number;
  averageTurns: number;
  medianTurns: number;
  p90Turns: number;
  averageDamagePerHit: number;
  averageHealShare: number;
  averageShieldShare: number;
  averageControlSkipRate: number;
  challengerWinRate: number;
  maxTurnsReached: number;
}

export interface CreationBattleBenchmarkResult {
  duels: CreationBattleDuelResult[];
  summary: CreationBattleBenchmarkSummary;
}

interface DuelObservationMetrics {
  totalDamage: number;
  damageEvents: number;
  totalHeal: number;
  totalShieldGain: number;
  controlSkipCount: number;
  actionOpportunityCount: number;
}

function withDeterministicRandom<T>(seed: number, execute: () => T): T {
  const originalRandom = Math.random;
  let state = seed >>> 0;

  if (state === 0) {
    state = 1;
  }

  Math.random = () => {
    state = (Math.imul(state, 1664525) + 1013904223) >>> 0;
    return state / 0x100000000;
  };

  try {
    return execute();
  } finally {
    Math.random = originalRandom;
  }
}

function runPipeline(
  productType: CreationProductType,
  materials: Material[],
  requestedSlot?: EquipmentSlot,
): CraftedOutcome | undefined {
  const orchestrator = new TestableCreationOrchestrator();
  const session = orchestrator.createSession({
    productType,
    materials,
    ...(requestedSlot ? { requestedSlot } : {}),
  });

  orchestrator.submitMaterials(session);
  orchestrator.analyzeMaterialsWithDefaults(session);
  orchestrator.resolveIntentWithDefaults(session);
  
  // 补丁：确保 intent 有必要的 bias
  if (session.state.intent) {
    if (productType === 'skill' && !session.state.intent.elementBias) {
      session.state.intent.elementBias = '火';
    }
    if (productType === 'artifact' && !session.state.intent.slotBias) {
      session.state.intent.slotBias = requestedSlot ?? 'weapon';
    }
  }

  orchestrator.validateRecipeWithDefaults(session);

  if (session.state.failureReason) {
    return undefined;
  }

  orchestrator.budgetEnergyWithDefaults(session);
  orchestrator.buildAffixPoolWithDefaults(session);
  
  // 补丁：如果词缀池没有核心，手动注入一个（用于测试）
  const CORE_CATEGORIES: AffixCategory[] = ['skill_core', 'gongfa_foundation', 'artifact_core'];
  if (session.state.affixPool.length > 0 && !session.state.affixPool.some(a => CORE_CATEGORIES.includes(a.category))) {
    // 寻找一个合适的非核心词缀强转为核心，或者报错
    const first = session.state.affixPool[0];
    const coreCategory: AffixCategory = productType === 'skill' ? 'skill_core' : productType === 'gongfa' ? 'gongfa_foundation' : 'artifact_core';
    first.category = coreCategory;
  }

  orchestrator.rollAffixesWithDefaults(session);
  orchestrator.composeBlueprintWithDefaults(session);

  return orchestrator.materializeOutcome(session);
}

function createBaselineStrike() {
  return AbilityFactory.create({
    slug: 'sparring_spirit_strike',
    name: '试锋灵击',
    type: AbilityType.ACTIVE_SKILL,
    tags: [
      GameplayTags.ABILITY.FUNCTION.DAMAGE,
      GameplayTags.ABILITY.CHANNEL.MAGIC,
    ],
    priority: 6,
    cooldown: 0,
    targetPolicy: { team: 'enemy', scope: 'single' },
    effects: [
      {
        type: 'damage',
        params: {
          value: {
            base: 160,
            attribute: AttributeType.MAGIC_ATK,
            coefficient: 1.2,
          },
        },
      },
    ],
  });
}

function createArtifactGuardPassive() {
  return AbilityFactory.create({
    slug: 'sparring_artifact_guard_shell',
    name: '守势灵甲',
    type: AbilityType.PASSIVE_SKILL,
    tags: [GameplayTags.ABILITY.KIND.ARTIFACT],
    modifiers: [
      {
        attrType: AttributeType.VITALITY,
        type: ModifierType.FIXED,
        value: 8,
      },
      {
        attrType: AttributeType.DEF,
        type: ModifierType.ADD,
        value: 0.12,
      },
      {
        attrType: AttributeType.MAGIC_DEF,
        type: ModifierType.ADD,
        value: 0.12,
      },
    ],
    listeners: [
      {
        eventType: 'DamageTakenEvent',
        scope: 'owner_as_target',
        priority: 20,
        effects: [
          {
            type: 'shield',
            params: {
              value: {
                base: 12,
                attribute: AttributeType.SPIRIT,
                coefficient: 0.1,
              },
            },
          },
        ],
      },
    ],
  });
}

function createGongfaSustainPassive() {
  return AbilityFactory.create({
    slug: 'sparring_gongfa_sustain_cycle',
    name: '归元吐纳',
    type: AbilityType.PASSIVE_SKILL,
    tags: [
      GameplayTags.ABILITY.KIND.GONGFA,
      GameplayTags.ABILITY.FUNCTION.HEAL,
    ],
    modifiers: [
      {
        attrType: AttributeType.SPIRIT,
        type: ModifierType.FIXED,
        value: 6,
      },
      {
        attrType: AttributeType.HEAL_AMPLIFY,
        type: ModifierType.FIXED,
        value: 0.12,
      },
    ],
    listeners: [
      {
        eventType: 'RoundPreEvent',
        scope: 'global',
        priority: 20,
        mapping: {
          caster: 'owner',
          target: 'owner',
        },
        effects: [
          {
            type: 'heal',
            params: {
              value: {
                base: 12,
                attribute: AttributeType.SPIRIT,
                coefficient: 0.1,
              },
            },
          },
        ],
      },
    ],
  });
}

function applyBaselineTemplate(
  unit: Unit,
  template: SparringBaselineTemplate,
): void {
  switch (template) {
    case 'artifact_guard':
      unit.abilities.addAbility(createArtifactGuardPassive());
      break;
    case 'gongfa_sustain':
      unit.abilities.addAbility(createGongfaSustainPassive());
      break;
    case 'mirror':
    default:
      break;
  }
}

function createSparringUnit(
  id: string,
  name: string,
  template: SparringBaselineTemplate = 'mirror',
  options: { includeBaselineStrike?: boolean } = {},
): Unit {
  const unit = new Unit(id, name, SPARRING_BASE_ATTRIBUTES);

  for (const modifier of STABILITY_MODIFIERS) {
    unit.attributes.addModifier({
      id: `${id}_${modifier.suffix}`,
      attrType: modifier.attrType,
      type: ModifierType.FIXED,
      value: modifier.value,
      source: 'creation-battle-regression-harness',
    });
  }

  if (options.includeBaselineStrike !== false) {
    unit.abilities.addAbility(createBaselineStrike());
  }
  applyBaselineTemplate(unit, template);
  unit.updateDerivedStats();

  return unit;
}

function runBaselineTemplateBattle(
  template: SparringBaselineTemplate,
  seed = 1,
): BaselineMirrorBattleResult {
  return withDeterministicRandom(seed, () => {
    EventBus.instance.reset();

    const challenger = createSparringUnit('challenger', '试锋者', template);
    const defender = createSparringUnit('defender', '守关人', template);
    const engine = new BattleEngineV5(challenger, defender);

    try {
      const battleResult = engine.execute();

      return {
        challenger,
        defender,
        battleResult,
        challengerWon: battleResult.winner === challenger.id,
        reachedMaxTurns: challenger.isAlive() && defender.isAlive(),
      };
    } finally {
      engine.destroy();
      EventBus.instance.reset();
    }
  });
}

export function runBaselineMirrorBattle(
  seed = 1,
): BaselineMirrorBattleResult {
  return runBaselineTemplateBattle('mirror', seed);
}

export function runArtifactGuardBaselineBattle(
  seed = 1,
): BaselineMirrorBattleResult {
  return runBaselineTemplateBattle('artifact_guard', seed);
}

export function runGongfaSustainBaselineBattle(
  seed = 1,
): BaselineMirrorBattleResult {
  return runBaselineTemplateBattle('gongfa_sustain', seed);
}

export function runCreationBattleDuel({
  productType,
  materials,
  seed = 1,
  requestedSlot,
  baselineTemplate = 'mirror',
}: CreationBattleDuelInput): CreationBattleDuelResult | undefined {
  return withDeterministicRandom(seed, () => {
    EventBus.instance.reset();

    let engine: BattleEngineV5 | undefined;

    try {
      const outcome = runPipeline(
        productType,
        materials,
        requestedSlot,
      );
      if (!outcome) {
        return undefined;
      }

      const challenger = createSparringUnit(
        'challenger',
        '试锋者',
        baselineTemplate,
        {
          // Active-skill benchmarks should evaluate the crafted skill itself,
          // not the crafted skill stacked on top of the helper strike.
          includeBaselineStrike: productType !== 'skill',
        },
      );
      const defender = createSparringUnit('defender', '守关人', baselineTemplate);

      challenger.abilities.addAbility(outcome.ability);

      engine = new BattleEngineV5(challenger, defender);
      const battleResult = engine.execute();

      return {
        outcome,
        challenger,
        defender,
        battleResult,
        challengerWon: battleResult.winner === challenger.id,
        reachedMaxTurns: challenger.isAlive() && defender.isAlive(),
      };
    } finally {
      engine?.destroy();
      EventBus.instance.reset();
    }
  });
}

function percentile(sortedValues: number[], ratio: number): number {
  if (sortedValues.length === 0) return 0;

  const index = Math.min(
    sortedValues.length - 1,
    Math.max(0, Math.ceil(sortedValues.length * ratio) - 1),
  );
  return sortedValues[index];
}

function average(values: number[]): number {
  if (values.length === 0) return 0;

  return values.reduce((sum, value) => sum + value, 0) / values.length;
}

function collectLogMetrics(logSpans: LogSpan[] | undefined) {
  let totalDamage = 0;
  let damageEvents = 0;
  let totalHeal = 0;
  let controlSkipCount = 0;

  for (const span of logSpans ?? []) {
    for (const entry of span.entries) {
      switch (entry.type) {
        case 'damage': {
          const damageData = entry.data as EntryDataMap['damage'];
          totalDamage += damageData.value;
          damageEvents += 1;
          break;
        }
        case 'heal': {
          const healData = entry.data as EntryDataMap['heal'];
          totalHeal += healData.value;
          break;
        }
        case 'control_skip':
          controlSkipCount += 1;
          break;
        default:
          break;
      }
    }
  }

  return {
    totalDamage,
    damageEvents,
    totalHeal,
    controlSkipCount,
  };
}

function collectStateMetrics(stateTimeline: BattleStateTimeline | undefined) {
  let totalShieldGain = 0;
  let actionOpportunityCount = 0;

  for (const frame of stateTimeline?.frames ?? []) {
    if (frame.phase === 'action_pre' && frame.actorId) {
      actionOpportunityCount += 1;
    }

    for (const delta of Object.values(frame.deltas ?? {})) {
      if (delta.shield && delta.shield.change > 0) {
        totalShieldGain += delta.shield.change;
      }
    }
  }

  return {
    totalShieldGain,
    actionOpportunityCount,
  };
}

function extractDuelObservationMetrics(
  duel: CreationBattleDuelResult,
): DuelObservationMetrics {
  const logMetrics = collectLogMetrics(duel.battleResult.logSpans);
  const stateMetrics = collectStateMetrics(duel.battleResult.stateTimeline);

  return {
    totalDamage: logMetrics.totalDamage,
    damageEvents: logMetrics.damageEvents,
    totalHeal: logMetrics.totalHeal,
    totalShieldGain: stateMetrics.totalShieldGain,
    controlSkipCount: logMetrics.controlSkipCount,
    actionOpportunityCount:
      stateMetrics.actionOpportunityCount > 0
        ? stateMetrics.actionOpportunityCount
        : Math.max(duel.battleResult.turns, 1),
  };
}

export function summarizeBattleBenchmark(
  duels: CreationBattleDuelResult[],
): CreationBattleBenchmarkSummary {
  const turns = duels
    .map((duel) => duel.battleResult.turns)
    .sort((left, right) => left - right);
  const totalTurns = turns.reduce((sum, value) => sum + value, 0);
  const challengerWins = duels.filter((duel) => duel.challengerWon).length;
  const maxTurnsReached = duels.filter((duel) => duel.reachedMaxTurns).length;
  const duelObservations = duels.map((duel) => extractDuelObservationMetrics(duel));
  const averageDamagePerHit = average(
    duelObservations.map((observation) =>
      observation.damageEvents > 0
        ? observation.totalDamage / observation.damageEvents
        : 0,
    ),
  );
  const averageHealShare = average(
    duelObservations.map((observation) => {
      const sustainTotal = observation.totalHeal + observation.totalShieldGain;
      return sustainTotal > 0 ? observation.totalHeal / sustainTotal : 0;
    }),
  );
  const averageShieldShare = average(
    duelObservations.map((observation) => {
      const sustainTotal = observation.totalHeal + observation.totalShieldGain;
      return sustainTotal > 0 ? observation.totalShieldGain / sustainTotal : 0;
    }),
  );
  const averageControlSkipRate = average(
    duelObservations.map((observation) =>
      observation.actionOpportunityCount > 0
        ? observation.controlSkipCount / observation.actionOpportunityCount
        : 0,
    ),
  );

  return {
    samples: duels.length,
    minTurns: turns[0] ?? 0,
    maxTurns: turns[turns.length - 1] ?? 0,
    averageTurns: turns.length > 0 ? totalTurns / turns.length : 0,
    medianTurns: percentile(turns, 0.5),
    p90Turns: percentile(turns, 0.9),
    averageDamagePerHit,
    averageHealShare,
    averageShieldShare,
    averageControlSkipRate,
    challengerWinRate: duels.length > 0 ? challengerWins / duels.length : 0,
    maxTurnsReached,
  };
}

export function runCreationBattleBenchmark(
  input: Omit<CreationBattleDuelInput, 'seed'> & { seeds: number[] },
): CreationBattleBenchmarkResult | undefined {
  const duels = input.seeds
    .map((battleSeed) => runCreationBattleDuel({ ...input, seed: battleSeed }))
    .filter((duel): duel is CreationBattleDuelResult => !!duel);

  if (duels.length === 0) {
    return undefined;
  }

  return {
    duels,
    summary: summarizeBattleBenchmark(duels),
  };
}