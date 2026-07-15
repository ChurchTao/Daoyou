import { BattleEngineV5 } from '@shared/engine/battle-v5/BattleEngineV5';
import { EventBus } from '@shared/engine/battle-v5/core/EventBus';
import { AttributeType, AbilityType, ModifierType } from '@shared/engine/battle-v5/core/types';
import { AbilityFactory } from '@shared/engine/battle-v5/factories/AbilityFactory';
import { Unit } from '@shared/engine/battle-v5/units/Unit';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { projectSectCombat } from '../..';
import type { CultivatorSectState } from '../../../core';

type PathId = 'swift-sword' | 'heavy-sword';

const NODE_SET: Record<PathId, string[]> = {
  'swift-sword': [
    'swift-opening',
    'swift-split-light',
    'swift-borrowed-force',
    'swift-mountain-breaking',
    'swift-linked-city',
    'swift-endless-flow',
  ],
  'heavy-sword': [
    'heavy-hidden-weight',
    'heavy-triple-ridge',
    'heavy-crossing-pass',
    'heavy-ending-life',
    'heavy-aftershock',
    'heavy-immovable-mountain',
  ],
};

function sectState(pathId: PathId): CultivatorSectState {
  return {
    membershipId: pathId,
    sectId: 'lingxiao',
    status: 'active',
    contribution: 0,
    configVersion: 4,
    activePathId: pathId,
    methods: {
      'lingxiao-canon': 60,
      'sword-guidance': 60,
      'void-step': 60,
      'edge-cleansing': 60,
      'origin-returning': 60,
      'sword-nurturing': 60,
    },
    paths: [{
      pathId,
      unlockedLayerIds: ['1', '2', '3', '4', '5', 'ultimate'],
      tacticId: pathId === 'swift-sword' ? 'aggressive' : 'heavy-full',
      activeMeridianSlot: 1,
      meridianLoadouts: [
        { slot: 1, nodeIds: NODE_SET[pathId], version: 1 },
        { slot: 2, nodeIds: [], version: 1 },
        { slot: 3, nodeIds: [], version: 1 },
      ],
    }],
    abilityLoadout: pathId === 'swift-sword'
      ? ['guiding-sword', 'linked-edge', 'shadow-step', 'sect-ultimate']
      : ['guiding-sword', 'linked-edge', 'turning-body', 'sect-ultimate'],
  };
}

function combatant(id: string, pathId: PathId): Unit {
  const projection = projectSectCombat({ sect: sectState(pathId), realm: '化神' })!;
  const unit = new Unit(id, id, {
    [AttributeType.VITALITY]: 100,
    [AttributeType.SPIRIT]: pathId === 'swift-sword' ? 60 : 100,
    [AttributeType.WISDOM]: pathId === 'swift-sword' ? 140 : 100,
    [AttributeType.SPEED]: 100,
    [AttributeType.WILLPOWER]: 100,
  });
  unit.attributes.addModifier({
    id: `${id}.benchmark-hp`,
    attrType: AttributeType.MAX_HP,
    type: ModifierType.OVERRIDE,
    value: 4_000,
    source: 'benchmark',
  });
  unit.updateDerivedStats();
  unit.setHp(unit.getMaxHp());
  for (const resource of projection.resources) unit.combatResources.define(resource);
  if (projection.defaultAttack) unit.abilities.setDefaultAttack(AbilityFactory.create(projection.defaultAttack));
  for (const config of projection.abilities) {
    const ability = AbilityFactory.create(config);
    if (ability.type === AbilityType.PASSIVE_SKILL || sectState(pathId).abilityLoadout.some((abilityId) => config.slug.endsWith(`.${abilityId}`))) {
      unit.abilities.addAbility(ability);
    }
  }
  if (projection.selectionStrategy) unit.abilities.setSelectionStrategy(projection.selectionStrategy);
  return unit;
}

function seededRandom(seed: number): () => number {
  let state = seed >>> 0;
  return () => {
    state = (state * 1664525 + 1013904223) >>> 0;
    return state / 0x1_0000_0000;
  };
}

describe('凌霄V4固定种子平衡基准', () => {
  afterEach(() => {
    vi.restoreAllMocks();
    EventBus.instance.reset();
  });

  it('化神圆满代表配置保持合理胜率和回合长度', () => {
    vi.spyOn(Math, 'random').mockImplementation(seededRandom(0x4c58_5634));
    let swiftWins = 0;
    let turns = 0;
    const samples = 100;
    for (let index = 0; index < samples; index += 1) {
      EventBus.instance.reset();
      const swift = combatant(`swift-${index}`, 'swift-sword');
      const heavy = combatant(`heavy-${index}`, 'heavy-sword');
      const engine = index % 2 === 0
        ? new BattleEngineV5(swift, heavy)
        : new BattleEngineV5(heavy, swift);
      const result = engine.execute();
      if (result.winner.startsWith('swift-')) swiftWins += 1;
      turns += result.turns;
      engine.destroy();
    }
    const winRate = swiftWins / samples;
    const averageTurns = turns / samples;
    expect(winRate, `winRate=${winRate}, averageTurns=${averageTurns}`).toBeGreaterThanOrEqual(0.45);
    expect(winRate).toBeLessThanOrEqual(0.55);
    expect(averageTurns).toBeGreaterThanOrEqual(8);
    expect(averageTurns).toBeLessThanOrEqual(12);
  });
});
