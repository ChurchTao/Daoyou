import {
  AttributeType,
  ModifierType,
} from '@shared/engine/battle-v5/core/types';
import { describe, expect, it } from 'vitest';
import { projectSectMethodModifiers, type CultivatorSectState } from '..';
import { LINGXIAO_SECT } from '../../content/lingxiao';

const state: CultivatorSectState = {
  membershipId: 'm1',
  sectId: 'lingxiao',
  status: 'active',
  contribution: 0,
  configVersion: 4,
  methods: { 'sword-guidance': 100, 'sword-nurturing': 100 },
  paths: [],
  abilityLoadout: [null, null, null, null],
};

describe('宗门心法属性投影', () => {
  it('红尘剑宗六本心法使用稳定ID映射新的名称与属性', () => {
    expect(
      [...LINGXIAO_SECT.methods]
        .sort((left, right) => left.slot - right.slot)
        .map((method) => [
          method.id,
          method.name,
          method.modifierPerLevel?.attrType ?? null,
          method.modifierPerLevel?.type ?? null,
          method.modifierPerLevel?.value ?? null,
        ]),
    ).toEqual([
      ['lingxiao-canon', '《红尘剑录》', null, null, null],
      [
        'edge-cleansing',
        '《观微剑意》',
        AttributeType.ACCURACY,
        ModifierType.FIXED,
        0.0002,
      ],
      [
        'sword-guidance',
        '《剑气长歌》',
        AttributeType.ATK,
        ModifierType.ADD,
        0.0005,
      ],
      [
        'void-step',
        '《凌虚步》',
        AttributeType.EVASION_RATE,
        ModifierType.FIXED,
        0.0002,
      ],
      [
        'origin-returning',
        '《澄心剑诀》',
        AttributeType.MAGIC_DEF,
        ModifierType.ADD,
        0.0005,
      ],
      [
        'sword-nurturing',
        '《不灭剑体》',
        AttributeType.DEF,
        ModifierType.ADD,
        0.0005,
      ],
    ]);
  });

  it('由宗门定义统一投影战斗与展示属性', () => {
    const projection = projectSectMethodModifiers(state, LINGXIAO_SECT);
    expect(projection.map((entry) => entry.methodId)).toEqual([
      'sword-guidance',
      'sword-nurturing',
    ]);
    expect(projection[0].modifiers[0].value).toBeCloseTo(0.05);
    expect(projection[1].modifiers[0].value).toBeCloseTo(0.05);
  });
});
