import { divinationRewardFacts } from '../lib/divination';
import { addItems, BAG_CAPACITY, type ItemGrant } from './index';
import { inventoryStackIdentity } from './stack-key';

const reward: ItemGrant = {
  definitionId: 'consumable.v1',
  quantity: 1,
  instanceData: divinationRewardFacts([2, 2, 4]),
};
const key = inventoryStackIdentity(reward.definitionId, reward.instanceData);

describe('发奖保留未参与堆叠的格位', () => {
  it('无需读取无关旧物品事实，也不会占用其格位', () => {
    const plan = addItems(
      [],
      reward,
      'bag',
      true,
      () => 'reward',
      key,
      [0, 1, 3],
    );
    expect(plan).toHaveLength(1);
    expect(plan[0]).toMatchObject({
      definitionId: 'consumable.v1',
      location: 'bag',
      slotIndex: 2,
      quantity: 1,
    });
  });
  it('所有格位已占用时存入储藏室', () => {
    const slots = Array.from({ length: BAG_CAPACITY }, (_, index) => index);
    expect(
      addItems([], reward, 'bag', true, () => 'reward', key, slots)[0],
    ).toMatchObject({ location: 'storage', slotIndex: null });
    expect(() =>
      addItems([], reward, 'bag', false, () => 'reward', key, slots),
    ).toThrow('背包格子不足');
  });
  it('仍优先叠加已有同种奖励', () => {
    const initial = addItems([], reward, 'bag', true, () => 'reward', key);
    const next = addItems(
      initial,
      reward,
      'bag',
      true,
      () => 'another',
      key,
      [1, 2],
    );
    expect(next).toHaveLength(1);
    expect(next[0]).toMatchObject({ id: 'reward', slotIndex: 0, quantity: 2 });
    expect(initial[0].quantity).toBe(1);
  });
});
