import { describe, expect, it } from 'vitest';
import { createLingxiaoSelectionStrategy, LingxiaoHeavySelectionStrategy, LingxiaoSwiftSelectionStrategy } from './selectionStrategy';

describe('流派策略插件', () => {
  it('按流派创建互相独立的策略', () => {
    expect(createLingxiaoSelectionStrategy('swift-sword', 'aggressive')).toBeInstanceOf(LingxiaoSwiftSelectionStrategy);
    expect(createLingxiaoSelectionStrategy('heavy-sword', 'heavy-break')).toBeInstanceOf(LingxiaoHeavySelectionStrategy);
    expect(createLingxiaoSelectionStrategy(undefined, undefined)).toBeUndefined();
  });
});
