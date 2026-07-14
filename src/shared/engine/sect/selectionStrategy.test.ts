import { describe, expect, it } from 'vitest';
import { LINGXIAO_HEAVY_PATH_MODULE } from './lingxiaoHeavyPath';
import { LINGXIAO_SWIFT_PATH_MODULE } from './lingxiaoSwiftPath';
import {
  LingxiaoHeavySelectionStrategy,
  LingxiaoSwiftSelectionStrategy,
} from './selectionStrategy';

describe('流派策略插件', () => {
  it('按流派创建互相独立的策略', () => {
    expect(
      LINGXIAO_SWIFT_PATH_MODULE.createSelectionStrategy('aggressive'),
    ).toBeInstanceOf(LingxiaoSwiftSelectionStrategy);
    expect(
      LINGXIAO_HEAVY_PATH_MODULE.createSelectionStrategy('heavy-break'),
    ).toBeInstanceOf(LingxiaoHeavySelectionStrategy);
  });

  it('两个流派的六个战术都由各自模块接受并创建策略', () => {
    for (const tactic of LINGXIAO_SWIFT_PATH_MODULE.definition.tactics) {
      expect(
        LINGXIAO_SWIFT_PATH_MODULE.createSelectionStrategy(tactic.id),
      ).toBeInstanceOf(LingxiaoSwiftSelectionStrategy);
    }
    for (const tactic of LINGXIAO_HEAVY_PATH_MODULE.definition.tactics) {
      expect(
        LINGXIAO_HEAVY_PATH_MODULE.createSelectionStrategy(tactic.id),
      ).toBeInstanceOf(LingxiaoHeavySelectionStrategy);
    }
  });
});
