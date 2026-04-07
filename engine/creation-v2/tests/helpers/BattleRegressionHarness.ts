import { BattleEngineV5, type BattleResult } from '@/engine/battle-v5/BattleEngineV5';
import { EventBus } from '@/engine/battle-v5/core/EventBus';
import {
  AbilityType,
  AttributeType,
  ModifierType,
} from '@/engine/battle-v5/core/types';
import { AbilityFactory } from '@/engine/battle-v5/factories/AbilityFactory';
import { Unit } from '@/engine/battle-v5/units/Unit';
import type {
  CraftedOutcome,
  CreationProductType,
} from '@/engine/creation-v2/types';
import type { Material } from '@/types/cultivator';
import { TestableCreationOrchestrator } from './TestableCreationOrchestrator';

const SPARRING_BASE_ATTRIBUTES: Partial<Record<AttributeType, number>> = {
  [AttributeType.SPIRIT]: 150,
  [AttributeType.VITALITY]: 145,
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
): CraftedOutcome | undefined {
  const orchestrator = new TestableCreationOrchestrator();
  const session = orchestrator.createSession({ productType, materials });

  orchestrator.submitMaterials(session);
  orchestrator.analyzeMaterialsWithDefaults(session);
  orchestrator.resolveIntentWithDefaults(session);
  orchestrator.validateRecipeWithDefaults(session);

  if (session.state.failureReason) {
    return undefined;
  }

  orchestrator.budgetEnergyWithDefaults(session);
  orchestrator.buildAffixPoolWithDefaults(session);
  orchestrator.rollAffixesWithDefaults(session);
  orchestrator.composeBlueprintWithDefaults(session);

  return orchestrator.materializeOutcome(session);
}

function createBaselineStrike() {
  return AbilityFactory.create({
    slug: 'sparring_spirit_strike',
    name: '试锋灵击',
    type: AbilityType.ACTIVE_SKILL,
    priority: 6,
    cooldown: 0,
    targetPolicy: { team: 'enemy', scope: 'single' },
    effects: [
      {
        type: 'damage',
        params: {
          value: {
            base: 70,
            attribute: AttributeType.MAGIC_ATK,
            coefficient: 0.9,
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

  unit.abilities.addAbility(createBaselineStrike());
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
}: CreationBattleDuelInput): CreationBattleDuelResult | undefined {
  return withDeterministicRandom(seed, () => {
    EventBus.instance.reset();

    let engine: BattleEngineV5 | undefined;

    try {
      const outcome = runPipeline(productType, materials);
      if (!outcome) {
        return undefined;
      }

      const challenger = createSparringUnit('challenger', '试锋者');
      const defender = createSparringUnit('defender', '守关人');

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