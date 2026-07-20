import {
  getRealmStageNaturalAttributeValue,
  getRealmStageRank,
  getRealmStageUnallocatedAttributeBudget,
} from '@shared/config/realmProgression';
import { BattleEngineV5 } from '@shared/engine/battle-v5/BattleEngineV5';
import { EventBus } from '@shared/engine/battle-v5/core/EventBus';
import { AbilityType, AttributeType } from '@shared/engine/battle-v5/core/types';
import { AbilityFactory } from '@shared/engine/battle-v5/factories/AbilityFactory';
import { Unit } from '@shared/engine/battle-v5/units/Unit';
import type { RealmStage, RealmType } from '@shared/types/constants';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { projectSectCombat } from '../..';
import type { CultivatorSectState } from '../../../core';

const realms = [
  { label: '筑基初期', realm: '筑基', stage: '初期', layers: 1, level: 25 },
  { label: '金丹圆满', realm: '金丹', stage: '圆满', layers: 3, level: 60 },
  { label: '化神圆满', realm: '化神', stage: '圆满', layers: 6, level: 100 },
] as const satisfies ReadonlyArray<{ label: string; realm: RealmType; stage: RealmStage; layers: number; level: number }>;

const wuxiangNodes = {
  'mirror-karma': ['mirror-guest-in-mirror', 'mirror-loud-flower', 'mirror-skandhas-mark', 'mirror-formless-two', 'mirror-return-source', 'mirror-not-platform'],
  'demon-crossing': ['demon-three-shores', 'demon-flower-inward', 'demon-skandhas-fuel', 'demon-first-thought', 'demon-leave-boat', 'demon-one-furnace'],
} as const;

function pathState(pathId: 'mirror-karma' | 'demon-crossing', layers: number, level: number): CultivatorSectState {
  return {
    membershipId: pathId, sectId: 'wuxiang', status: 'active', contribution: 0,
    configVersion: 1, activePathId: pathId,
    methods: {
      'wuxiang-canon': level, 'blood-lotus': level, 'white-bone': level,
      'wrathful-ming': level, 'six-senses': level, 'reed-crossing-method': level,
    },
    paths: [{
      pathId, unlockedLayerIds: ['1', '2', '3', '4', '5', 'ultimate'].slice(0, layers),
      tacticId: pathId === 'mirror-karma' ? 'guard' : 'trial-fire', activeMeridianSlot: 1,
      meridianLoadouts: [
        { slot: 1, nodeIds: [...wuxiangNodes[pathId].slice(0, layers)], version: 1 },
        { slot: 2, nodeIds: [], version: 1 }, { slot: 3, nodeIds: [], version: 1 },
      ],
    }],
    abilityLoadout: ['turn-form', 'blood-tide', 'three-knocks', 'observe-calamity'],
  };
}

function lingxiaoState(layers: number, level: number): CultivatorSectState {
  const nodes = ['swift-opening', 'swift-split-light', 'swift-borrowed-force', 'swift-life-chasing', 'swift-gapless', 'swift-endless-flow'];
  return {
    membershipId: 'lingxiao', sectId: 'lingxiao', status: 'active', contribution: 0,
    configVersion: 4, activePathId: 'swift-sword',
    methods: {
      'lingxiao-canon': level, 'sword-guidance': level, 'void-step': level,
      'edge-cleansing': level, 'origin-returning': level, 'sword-nurturing': level,
    },
    paths: [{
      pathId: 'swift-sword', unlockedLayerIds: ['1', '2', '3', '4', '5', 'ultimate'].slice(0, layers),
      tacticId: 'aggressive', activeMeridianSlot: 1,
      meridianLoadouts: [
        { slot: 1, nodeIds: nodes.slice(0, layers), version: 1 },
        { slot: 2, nodeIds: [], version: 1 }, { slot: 3, nodeIds: [], version: 1 },
      ],
    }],
    abilityLoadout: ['guiding-sword', 'linked-edge', 'shadow-step', 'sect-ultimate'],
  };
}

const attributes = [
  AttributeType.VITALITY, AttributeType.SPIRIT, AttributeType.WISDOM,
  AttributeType.SPEED, AttributeType.WILLPOWER,
] as const;

function combatant(
  id: string,
  sect: CultivatorSectState,
  realm: RealmType,
  stage: RealmStage,
  vitalityOverride?: number,
): Unit {
  const natural = getRealmStageNaturalAttributeValue(realm, stage);
  const budget = getRealmStageUnallocatedAttributeBudget(realm, stage);
  const vitalityShare = vitalityOverride ?? (sect.activePathId === 'mirror-karma'
    ? realm === '筑基' ? 0.71 : realm === '金丹' ? 0.595 : 0.485
    : sect.activePathId === 'demon-crossing'
      ? realm === '筑基' ? 0.725 : realm === '金丹' ? 0.605 : 0.655
      : 0.3);
  const remainder = 1 - vitalityShare;
  const distribution = sect.sectId === 'wuxiang'
    ? [vitalityShare, remainder * 0.1, remainder * 0.2, remainder * 0.35, remainder * 0.35]
    : [0.3, 0.1, 0.15, 0.3, 0.15];
  let assigned = 0;
  const values = Object.fromEntries(attributes.map((attribute, index) => {
    const extra = index === attributes.length - 1
      ? budget - assigned
      : Math.floor(budget * distribution[index]);
    assigned += extra;
    return [attribute, natural + extra];
  }));
  const unit = new Unit(id, id, values);
  unit.setRealmMeta({ realm, realmStage: stage, realmRank: getRealmStageRank(realm, stage) });
  const projection = projectSectCombat({ sect, realm })!;
  for (const resource of projection.resources) unit.combatResources.define(resource);
  if (projection.defaultAttack) unit.abilities.setDefaultAttack(AbilityFactory.create(projection.defaultAttack));
  for (const config of projection.abilities) {
    const ability = AbilityFactory.create(config);
    if (
      ability.type === AbilityType.PASSIVE_SKILL ||
      sect.abilityLoadout.some((abilityId) => abilityId && config.slug.endsWith(`.${abilityId}`))
    ) unit.abilities.addAbility(ability);
  }
  if (projection.selectionStrategy) unit.abilities.setSelectionStrategy(projection.selectionStrategy);
  for (const method of projection.methodModifiers) {
    method.modifiers.forEach((modifier, index) => unit.attributes.addModifier({
      id: `method:${method.methodId}:${index}`, ...modifier, source: method.methodId,
    }));
  }
  unit.updateDerivedStats();
  unit.setHp(unit.getMaxHp());
  unit.setMp(unit.getMaxMp());
  return unit;
}

function seeded(seed: number): () => number {
  let value = seed >>> 0;
  return () => {
    value = (value * 1664525 + 1013904223) >>> 0;
    return value / 0x1_0000_0000;
  };
}

function simulate(
  pathId: 'mirror-karma' | 'demon-crossing',
  realm: typeof realms[number],
  samples = 20,
  vitalityOverride?: number,
) {
  vi.spyOn(Math, 'random').mockImplementation(seeded(0x5758_0000 + realm.layers * 100 + (pathId === 'mirror-karma' ? 1 : 2)));
  let wins = 0;
  let draws = 0;
  let turns = 0;
  for (let index = 0; index < samples; index += 1) {
    EventBus.instance.reset();
    const wuxiang = combatant(`wuxiang-${index}`, pathState(pathId, realm.layers, realm.level), realm.realm, realm.stage, vitalityOverride);
    const lingxiao = combatant(`lingxiao-${index}`, lingxiaoState(realm.layers, realm.level), realm.realm, realm.stage);
    const engine = index % 2 === 0 ? new BattleEngineV5(wuxiang, lingxiao) : new BattleEngineV5(lingxiao, wuxiang);
    const result = engine.execute();
    if (result.winner.startsWith('wuxiang-')) wins += 1;
    if (!result.winner) draws += 1;
    turns += result.turns;
    engine.destroy();
  }
  vi.restoreAllMocks();
  return { winRate: wins / samples, drawRate: draws / samples, averageTurns: turns / samples };
}

describe('无相禅宗固定种子平衡冒烟', () => {
  afterEach(() => { vi.restoreAllMocks(); EventBus.instance.reset(); });

  it.each(realms)('$label与凌霄同预算对战不会形成稳定拖平', (realm) => {
    const results = (['demon-crossing', 'mirror-karma'] as const).map((pathId) => ({
      pathId,
      result: simulate(pathId, realm),
    }));
    const failures = results.filter(({ result }) =>
        result.drawRate > 0.05 ||
        result.averageTurns <= 0 ||
        result.averageTurns >= 40 ||
        result.winRate <= 0 ||
        result.winRate >= 1,
      );
    expect(failures, JSON.stringify(results)).toEqual([]);
  }, 30_000);
});
