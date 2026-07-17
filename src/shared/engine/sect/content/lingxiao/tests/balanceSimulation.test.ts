import {
  getRealmStageNaturalAttributeValue,
  getRealmStageRank,
  getRealmStageUnallocatedAttributeBudget,
} from '@shared/config/realmProgression';
import { BattleEngineV5 } from '@shared/engine/battle-v5/BattleEngineV5';
import { EventBus } from '@shared/engine/battle-v5/core/EventBus';
import {
  AbilityType,
  AttributeType,
} from '@shared/engine/battle-v5/core/types';
import { AbilityFactory } from '@shared/engine/battle-v5/factories/AbilityFactory';
import type { DamageEntryData } from '@shared/engine/battle-v5/systems/log/types';
import { Unit } from '@shared/engine/battle-v5/units/Unit';
import type { RealmStage, RealmType } from '@shared/types/constants';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { projectSectCombat } from '../..';
import type { CultivatorSectState } from '../../../core';

type PathId = 'swift-sword' | 'heavy-sword';
type SwiftTactic = 'aggressive' | 'steady' | 'counter';
type HeavyTactic = 'heavy-break' | 'heavy-full' | 'heavy-guard';

const REALMS = [
  {
    realm: '筑基',
    stage: '初期',
    layerCount: 1,
    methodLevel: 25,
    realmIndex: 0,
    label: '筑基初期',
  },
  {
    realm: '金丹',
    stage: '圆满',
    layerCount: 3,
    methodLevel: 60,
    realmIndex: 1,
    label: '金丹圆满',
  },
  {
    realm: '化神',
    stage: '圆满',
    layerCount: 6,
    methodLevel: 100,
    realmIndex: 2,
    label: '化神圆满',
  },
] as const satisfies ReadonlyArray<{
  realm: RealmType;
  stage: RealmStage;
  layerCount: number;
  methodLevel: number;
  realmIndex: number;
  label: string;
}>;

const NODE_SET: Record<SwiftTactic | HeavyTactic, string[]> = {
  aggressive: [
    'swift-opening',
    'swift-split-light',
    'swift-borrowed-force',
    'swift-life-chasing',
    'swift-gapless',
    'swift-endless-flow',
  ],
  steady: [
    'swift-probing-edge',
    'swift-retained-force',
    'swift-guarded-edge',
    'swift-mountain-breaking',
    'swift-linked-city',
    'swift-shadow-line',
  ],
  counter: [
    'swift-hidden-edge',
    'swift-retained-force',
    'swift-returning-swallow',
    'swift-sheathing',
    'swift-still-tide',
    'swift-unending-wind',
  ],
  'heavy-break': [
    'heavy-hidden-weight',
    'heavy-shattering-armor',
    'heavy-borrowed-weight',
    'heavy-rending-mountain',
    'heavy-linked-mountains',
    'heavy-mountain-river-echo',
  ],
  'heavy-full': [
    'heavy-opening',
    'heavy-triple-ridge',
    'heavy-crossing-pass',
    'heavy-ending-life',
    'heavy-aftershock',
    'heavy-heaven-cleaving',
  ],
  'heavy-guard': [
    'heavy-testing-frame',
    'heavy-retained-frame',
    'heavy-unmoved',
    'heavy-returning-peak',
    'heavy-steady-mountain',
    'heavy-immovable-mountain',
  ],
};

const LOADOUT: Record<SwiftTactic | HeavyTactic, string[]> = {
  aggressive: ['guiding-sword', 'linked-edge', 'shadow-step', 'sect-ultimate'],
  steady: ['guiding-sword', 'linked-edge', 'nurturing-sword', 'sect-ultimate'],
  counter: ['linked-edge', 'turning-body', 'shadow-step', 'sect-ultimate'],
  'heavy-break': [
    'guiding-sword',
    'turning-body',
    'linked-edge',
    'sect-ultimate',
  ],
  'heavy-full': [
    'guiding-sword',
    'linked-edge',
    'turning-body',
    'sect-ultimate',
  ],
  'heavy-guard': [
    'shadow-step',
    'sword-aegis',
    'turning-body',
    'sect-ultimate',
  ],
};

function sectState(
  pathId: PathId,
  tacticId: SwiftTactic | HeavyTactic,
  layerCount: number,
  methodLevel: number,
): CultivatorSectState {
  const layers = ['1', '2', '3', '4', '5', 'ultimate'].slice(0, layerCount);
  const loadout =
    methodLevel < 5 ? ['guiding-sword', null, null, null] : LOADOUT[tacticId];
  return {
    membershipId: `${pathId}:${tacticId}`,
    sectId: 'lingxiao',
    status: 'active',
    contribution: 0,
    configVersion: 4,
    activePathId: pathId,
    methods: {
      'lingxiao-canon': methodLevel,
      'sword-guidance': methodLevel,
      'void-step': methodLevel,
      'edge-cleansing': methodLevel,
      'origin-returning': methodLevel,
      'sword-nurturing': methodLevel,
    },
    paths: [
      {
        pathId,
        unlockedLayerIds: layers,
        tacticId,
        activeMeridianSlot: 1,
        meridianLoadouts: [
          {
            slot: 1,
            nodeIds: NODE_SET[tacticId].slice(0, layerCount),
            version: 1,
          },
          { slot: 2, nodeIds: [], version: 1 },
          { slot: 3, nodeIds: [], version: 1 },
        ],
      },
    ],
    abilityLoadout: [
      loadout[0] ?? null,
      loadout[1] ?? null,
      loadout[2] ?? null,
      loadout[3] ?? null,
    ],
  };
}

const ATTRIBUTES = [
  AttributeType.VITALITY,
  AttributeType.SPIRIT,
  AttributeType.WISDOM,
  AttributeType.SPEED,
  AttributeType.WILLPOWER,
] as const;

const DISTRIBUTION: Record<PathId, readonly number[]> = {
  'swift-sword': [0.3, 0.1, 0.15, 0.3, 0.15],
  'heavy-sword': [0.3, 0.1, 0.15, 0.3, 0.15],
};

function combatant(args: {
  id: string;
  pathId: PathId;
  tacticId: SwiftTactic | HeavyTactic;
  realm: RealmType;
  stage: RealmStage;
  layerCount: number;
  methodLevel: number;
}): Unit {
  const state = sectState(
    args.pathId,
    args.tacticId,
    args.layerCount,
    args.methodLevel,
  );
  const projection = projectSectCombat({ sect: state, realm: args.realm })!;
  const natural = getRealmStageNaturalAttributeValue(args.realm, args.stage);
  const unallocated = getRealmStageUnallocatedAttributeBudget(
    args.realm,
    args.stage,
  );
  let assigned = 0;
  const attributes = Object.fromEntries(
    ATTRIBUTES.map((attribute, index) => {
      const extra =
        index === ATTRIBUTES.length - 1
          ? unallocated - assigned
          : Math.floor(unallocated * DISTRIBUTION[args.pathId][index]);
      assigned += extra;
      return [attribute, natural + extra];
    }),
  );
  const unit = new Unit(args.id, args.id, attributes);
  unit.setRealmMeta({
    realm: args.realm,
    realmStage: args.stage,
    realmRank: getRealmStageRank(args.realm, args.stage),
  });
  for (const resource of projection.resources)
    unit.combatResources.define(resource);
  if (projection.defaultAttack) {
    unit.abilities.setDefaultAttack(
      AbilityFactory.create(projection.defaultAttack),
    );
  }
  for (const config of projection.abilities) {
    const ability = AbilityFactory.create(config);
    if (
      ability.type === AbilityType.PASSIVE_SKILL ||
      state.abilityLoadout.some(
        (abilityId) => abilityId && config.slug.endsWith(`.${abilityId}`),
      )
    ) {
      unit.abilities.addAbility(ability);
    }
  }
  if (projection.selectionStrategy) {
    unit.abilities.setSelectionStrategy(projection.selectionStrategy);
  }
  for (const method of projection.methodModifiers) {
    for (const [index, modifier] of method.modifiers.entries()) {
      unit.attributes.addModifier({
        id: `method:${method.methodId}:${index}`,
        ...modifier,
        source: method.methodId,
      });
    }
  }
  unit.updateDerivedStats();
  unit.setHp(unit.getMaxHp());
  unit.setMp(unit.getMaxMp());
  return unit;
}

function seededRandom(seed: number): () => number {
  let state = seed >>> 0;
  return () => {
    state = (state * 1664525 + 1013904223) >>> 0;
    return state / 0x1_0000_0000;
  };
}

interface MatchResult {
  swiftWinRate: number;
  averageTurns: number;
  drawRate: number;
  swiftIdentityShare: number;
  heavyIdentityShare: number;
}

function simulate(args: {
  realm: RealmType;
  stage: RealmStage;
  layerCount: number;
  methodLevel: number;
  swiftTactic: SwiftTactic;
  heavyTactic: HeavyTactic;
  seed: number;
  samples?: number;
}): MatchResult {
  const samples = args.samples ?? 100;
  vi.spyOn(Math, 'random').mockImplementation(seededRandom(args.seed));
  let swiftWins = 0;
  let draws = 0;
  let turns = 0;
  let swiftDamage = 0;
  let swiftIdentityDamage = 0;
  let heavyDamage = 0;
  let heavyIdentityDamage = 0;

  for (let index = 0; index < samples; index += 1) {
    EventBus.instance.reset();
    const swift = combatant({
      id: `swift-${index}`,
      pathId: 'swift-sword',
      tacticId: args.swiftTactic,
      realm: args.realm,
      stage: args.stage,
      layerCount: args.layerCount,
      methodLevel: args.methodLevel,
    });
    const heavy = combatant({
      id: `heavy-${index}`,
      pathId: 'heavy-sword',
      tacticId: args.heavyTactic,
      realm: args.realm,
      stage: args.stage,
      layerCount: args.layerCount,
      methodLevel: args.methodLevel,
    });
    const engine =
      index % 2 === 0
        ? new BattleEngineV5(swift, heavy)
        : new BattleEngineV5(heavy, swift);
    const result = engine.execute();
    if (result.winner.startsWith('swift-')) swiftWins += 1;
    if (!result.winner) draws += 1;
    turns += result.turns;

    for (const span of result.logSpans ?? []) {
      for (const entry of span.entries) {
        if (entry.type !== 'damage') continue;
        const damage = entry.data as DamageEntryData;
        const sourceName = damage.sourceUnitName ?? span.actor?.name ?? '';
        if (sourceName.startsWith('swift-')) {
          swiftDamage += damage.value;
          if (
            damage.damageSource === 'follow_up' ||
            damage.damageSource === 'counter' ||
            damage.sourceAbilityId?.endsWith('.linked-edge')
          ) {
            swiftIdentityDamage += damage.value;
          }
        } else if (sourceName.startsWith('heavy-')) {
          heavyDamage += damage.value;
          if (
            damage.damageSource === 'counter' ||
            damage.sourceAbilityId?.endsWith('.thunder-strike')
          ) {
            heavyIdentityDamage += damage.value;
          }
        }
      }
    }
    engine.destroy();
  }

  vi.restoreAllMocks();
  return {
    swiftWinRate: swiftWins / samples,
    averageTurns: turns / samples,
    drawRate: draws / samples,
    swiftIdentityShare: swiftDamage > 0 ? swiftIdentityDamage / swiftDamage : 0,
    heavyIdentityShare: heavyDamage > 0 ? heavyIdentityDamage / heavyDamage : 0,
  };
}

describe('凌霄V4.2三境界固定种子平衡矩阵', () => {
  afterEach(() => {
    vi.restoreAllMocks();
    EventBus.instance.reset();
  });

  it.runIf(process.env.LINGXIAO_BALANCE_GATE === '1').each(REALMS)(
    '$label 的三组代表对局与3×3战术矩阵满足验收范围',
    ({ realm, stage, layerCount, methodLevel, realmIndex }) => {
      const swiftTactics: SwiftTactic[] = ['aggressive', 'steady', 'counter'];
      const heavyTactics: HeavyTactic[] = [
        'heavy-break',
        'heavy-full',
        'heavy-guard',
      ];
      const representative = new Set([
        'aggressive:heavy-break',
        'steady:heavy-full',
        'counter:heavy-guard',
      ]);
      const failures: string[] = [];
      const reports: string[] = [];
      for (const [swiftIndex, swiftTactic] of swiftTactics.entries()) {
        for (const [heavyIndex, heavyTactic] of heavyTactics.entries()) {
          const result = simulate({
            realm,
            stage,
            layerCount,
            methodLevel,
            swiftTactic,
            heavyTactic,
            seed: 0x4c58_4100 + realmIndex * 100 + swiftIndex * 10 + heavyIndex,
          });
          const label = `${realm}${stage} ${swiftTactic} vs ${heavyTactic}: ${JSON.stringify(result)}`;
          reports.push(label);
          const isRepresentative = representative.has(
            `${swiftTactic}:${heavyTactic}`,
          );
          const minWinRate = isRepresentative ? 0.45 : 0.35;
          const maxWinRate = isRepresentative ? 0.55 : 0.65;
          if (
            result.swiftWinRate < minWinRate ||
            result.swiftWinRate > maxWinRate ||
            result.drawRate > 0.05 ||
            (isRepresentative &&
              (result.averageTurns < 8 || result.averageTurns > 12))
          ) {
            failures.push(label);
          }
        }
      }
      expect(failures, reports.join('\n')).toEqual([]);
    },
    60_000,
  );

  it('化神代表对局的伤害构成保持快重差异', () => {
    const result = simulate({
      realm: '化神',
      stage: '圆满',
      layerCount: 6,
      methodLevel: 100,
      swiftTactic: 'aggressive',
      heavyTactic: 'heavy-break',
      seed: 0x4c58_4999,
    });
    expect(result.swiftIdentityShare).toBeGreaterThan(0.5);
    expect(result.heavyIdentityShare).toBeGreaterThan(0.5);
  }, 30_000);

  it.each([1, 180])('%i级心法边界可完成代表对局冒烟', (methodLevel) => {
    const result = simulate({
      realm: methodLevel === 1 ? '筑基' : '渡劫',
      stage: methodLevel === 1 ? '初期' : '圆满',
      layerCount: methodLevel === 1 ? 1 : 6,
      methodLevel,
      swiftTactic: 'counter',
      heavyTactic: 'heavy-guard',
      seed: 0x4c58_4200 + methodLevel,
      samples: 5,
    });
    expect(result.drawRate).toBeLessThan(1);
    expect(result.swiftWinRate).toBeGreaterThanOrEqual(0);
    expect(result.swiftWinRate).toBeLessThanOrEqual(1);
    expect(result.averageTurns).toBeGreaterThan(0);
  });
});
