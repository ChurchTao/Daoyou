import { describe, expect, it } from 'vitest';
import { LINGXIAO_SECT } from './lingxiao';
import { projectSectMethodModifiers } from './methodModifiers';
import type { CultivatorSectState } from './types';

const state: CultivatorSectState = {
  membershipId: 'm1', sectId: 'lingxiao', status: 'active', contribution: 0, configVersion: 2,
  methods: { 'sword-guidance': 100, 'sword-nurturing': 100 }, paths: [], abilityLoadout: [null, null, null, null],
};

describe('宗门心法属性投影', () => {
  it('由宗门定义统一投影战斗与展示属性', () => {
    const projection = projectSectMethodModifiers(state, LINGXIAO_SECT);
    expect(projection.map((entry) => entry.methodId)).toEqual(['sword-guidance', 'sword-nurturing']);
    expect(projection[0].modifiers[0].value).toBeCloseTo(0.05);
    expect(projection[1].modifiers[0].value).toBeCloseTo(0.05);
  });
});
