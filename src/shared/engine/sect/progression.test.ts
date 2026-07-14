import { describe, expect, it } from 'vitest';
import { REALM_STAGE_VALUES, REALM_VALUES } from '@shared/types/constants';
import {
  getSectMethodLevelCap,
  getMinimumRealmStageForMethodLevel,
  getSectMethodTrainingCost,
  validateMeridianNodeIds,
} from './progression';

describe('凌霄剑宗心法与经脉进度', () => {
  it('九境四阶段每阶段提升5级且渡劫圆满为180级', () => {
    const caps = REALM_VALUES.flatMap((realm) =>
      REALM_STAGE_VALUES.map((stage) => getSectMethodLevelCap(realm, stage)),
    );
    expect(caps).toEqual(Array.from({ length: 36 }, (_, index) => (index + 1) * 5));
    expect(caps.at(-1)).toBe(180);
    expect(getMinimumRealmStageForMethodLevel(70)).toEqual({ realm: '元婴', stage: '中期' });
  });

  it('逐级累计贡献与灵石成本', () => {
    expect(getSectMethodTrainingCost(0, 1)).toEqual({ contribution: 1, spiritStones: 50 });
    expect(getSectMethodTrainingCost(29, 31)).toEqual({ contribution: 3, spiritStones: 200 });
    expect(getSectMethodTrainingCost(19, 21)).toEqual({ contribution: 2, spiritStones: 150 });
  });

  it('同层互斥并校验终式心法门槛', () => {
    expect(() => validateMeridianNodeIds({
      nodeIds: ['swift-opening', 'swift-hidden-edge'],
      realm: '化神', stage: '圆满', methods: { 'lingxiao-canon': 100, 'swift-sword-canon': 100 },
    })).toThrow('只能选择一个节点');
    expect(() => validateMeridianNodeIds({
      nodeIds: ['swift-endless-flow'], realm: '化神', stage: '圆满', methods: { 'lingxiao-canon': 99, 'swift-sword-canon': 100 },
    })).toThrow('心法要求');
    expect(validateMeridianNodeIds({
      nodeIds: ['swift-opening', 'swift-split-light', 'swift-endless-flow'],
      realm: '化神', stage: '圆满', methods: { 'lingxiao-canon': 100, 'swift-sword-canon': 100 },
    })).toHaveLength(3);
  });
});
