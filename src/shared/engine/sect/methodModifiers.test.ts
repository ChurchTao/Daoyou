import { AttributeType, ModifierType } from '@shared/engine/battle-v5/core/types';
import { describe, expect, it } from 'vitest';
import { projectSectMethodModifiers } from './methodModifiers';
import type { CultivatorSectState } from './types';

function state(): CultivatorSectState {
  return {
    membershipId: 'member-1',
    sectId: 'lingxiao',
    status: 'active',
    contribution: 0,
    tacticId: 'steady',
    activeMeridianSlot: 1,
    configVersion: 1,
    methods: {
      'lingxiao-canon': 100,
      'sword-guidance': 100,
      'void-step': 100,
      'edge-cleansing': 100,
      'origin-returning': 100,
      'swift-sword-canon': 100,
    },
    meridianLoadouts: [{ slot: 1, nodeIds: [], version: 1 }],
    abilityLoadout: [null, null, null, null],
  };
}

describe('宗门心法属性投影', () => {
  it('按等级生成稳定来源，并排除主心法与疾风倍率', () => {
    const projections = projectSectMethodModifiers(state());

    expect(projections.map((item) => item.methodId)).toEqual([
      'sword-guidance',
      'void-step',
      'edge-cleansing',
      'origin-returning',
    ]);
    expect(projections.map((item) => item.modifiers[0])).toEqual([
      { attrType: AttributeType.ATK, type: ModifierType.ADD, value: 0.05 },
      { attrType: AttributeType.SPEED, type: ModifierType.ADD, value: 0.04 },
      { attrType: AttributeType.ACCURACY, type: ModifierType.FIXED, value: 0.02 },
      { attrType: AttributeType.MAX_MP, type: ModifierType.ADD, value: 0.05 },
    ]);
  });

  it('未入宗与零级心法不产生 modifier', () => {
    const prospect = state();
    prospect.status = 'prospect';
    expect(projectSectMethodModifiers(prospect)).toEqual([]);

    const zero = state();
    zero.methods = { 'lingxiao-canon': 100, 'swift-sword-canon': 100 };
    expect(projectSectMethodModifiers(zero)).toEqual([]);
  });
});
