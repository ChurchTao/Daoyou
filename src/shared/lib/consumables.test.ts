import type { Consumable } from '@shared/types/cultivator';
import { describe, expect, it } from 'vitest';
import { buildConsumableStackKey, isTradableConsumable } from './consumables';

function buildPill(version?: 3 | 4): Consumable {
  return {
    name: '同名丹',
    type: '丹药',
    quality: '玄品',
    quantity: 1,
    spec: {
      kind: 'pill',
      family: 'cultivation',
      operations: [
        {
          type: 'add_status',
          status: 'cultivation_boost',
          payload: { boostPercent: 1.2, retreatExpMultiplier: 2.2 },
        },
      ],
      consumeRules: {
        scene: 'out_of_battle_only',
        quotaCategory: 'cultivation',
      },
      alchemyMeta: {
        source: 'improvised',
        sourceMaterials: [],
        stability: 80,
        toxicityRating: 10,
        tags: [],
        version,
      },
    },
  };
}

describe('buildConsumableStackKey', () => {
  it('keeps historical and free-form pill signatures unchanged', () => {
    expect(buildConsumableStackKey(buildPill())).toBe(
      buildConsumableStackKey(buildPill(3)),
    );
  });

  it('never merges v4 alchemy pills into historical pill stacks', () => {
    expect(buildConsumableStackKey(buildPill(4))).not.toBe(
      buildConsumableStackKey(buildPill(3)),
    );
  });

  it('still merges identical v4 pills with each other', () => {
    expect(buildConsumableStackKey(buildPill(4))).toBe(
      buildConsumableStackKey(buildPill(4)),
    );
  });
});

describe('isTradableConsumable', () => {
  it('允许丹药与灵果交易，但排除符箓', () => {
    const fruit: Consumable = {
      name: '青露灵果',
      type: '灵果',
      quality: '玄品',
      quantity: 1,
      spec: {
        kind: 'spirit_fruit',
        family: 'healing',
        operations: [
          {
            type: 'restore_resource',
            resource: 'hp',
            mode: 'percent',
            value: 0.08,
          },
        ],
        consumeRules: {
          scene: 'out_of_battle_only',
          quotaCategory: 'none',
        },
        source: { kind: 'spirit_field', version: 1 },
      },
    };
    const talisman: Consumable = {
      name: '贵宾符',
      type: '符箓',
      quality: '玄品',
      quantity: 1,
      spec: {
        kind: 'talisman',
        scenario: 'auction-private-listing',
        sessionMode: 'consume_on_action',
      },
    };

    expect(isTradableConsumable(buildPill())).toBe(true);
    expect(isTradableConsumable(fruit)).toBe(true);
    expect(isTradableConsumable(talisman)).toBe(false);
  });
});
