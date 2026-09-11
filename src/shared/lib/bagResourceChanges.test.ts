import { describe, expect, it } from 'vitest';
import type {
  ResourceChangeDescriptor,
  ResourceScope,
} from '../contracts/resources';
import { withBagInvalidations } from './bagResourceChanges';

const scope: ResourceScope = { kind: 'cultivator', id: 'one' };
const change = (
  resourceTopic: ResourceChangeDescriptor['resourceTopic'],
  id = 'one',
) => ({
  scope: { ...scope, id },
  resourceTopic,
  operation: 'invalidate' as const,
  eventType: 'test.changed',
});

describe('完整储物袋失效传播', () => {
  it('材料、消耗品和装备状态变化每角色只刷新一次，且不改变原事件', () => {
    const input = [
      change('inventory.materials'),
      change('inventory.consumables'),
      change('player.profile'),
      change('inventory.artifacts', 'two'),
    ];
    const before = structuredClone(input);
    const result = withBagInvalidations(input);
    expect(input).toEqual(before);
    expect(
      result
        .filter((entry) => entry.resourceTopic === 'inventory.bag')
        .map((entry) => entry.scope.id),
    ).toEqual(['one', 'two']);
    expect(result.slice(0, input.length)).toEqual(input);
  });
  it('已有储物袋事件不重复发出，货币和进度不触发背包刷新', () => {
    const input = [
      change('inventory.bag'),
      change('inventory.materials'),
      change('player.currency', 'two'),
      change('player.progress', 'two'),
    ];
    expect(withBagInvalidations(input)).toEqual(input);
  });
});
