import { tierColorMap } from '@app/components/ui/inkBadgeTiers';
import { findMysteryBag } from '@daoyou/game-content/items/mystery-bags';
import type { MysteryBagId } from '@daoyou/game-domain/inventory';
import { describeMysteryBagRewards } from '@daoyou/game-rules/items/mystery-bags';
import { quantity } from './helpers';
import type { ItemAdapter } from './types';

const mysteryBagIcons = {
  'mystery-bag.common': 'icon:item-mystery-bag-common',
  'mystery-bag.fine': 'icon:item-mystery-bag-fine',
  'mystery-bag.luxurious': 'icon:item-mystery-bag-luxurious',
} satisfies Record<MysteryBagId, string>;

export const mysteryBagAdapter: ItemAdapter = (item, definition) => {
  const bag = findMysteryBag(definition.id)!;
  return {
    summary: {
      icon: mysteryBagIcons[bag.id],
      color: tierColorMap[bag.color],
      tier: bag.grade,
      type: '神秘储物袋',
    },
    preview: (options) => ({
      header: [quantity(item, options)],
      sections: [
        {
          title: '开袋奖池',
          entries: describeMysteryBagRewards(bag.id).map(
            ({ label, chance }) => ({
              kind: 'line',
              label,
              value: chance,
              numeric: true,
              layout: 'spread',
            }),
          ),
        },
      ],
      description:
        '打开会消耗 1 个储物袋，抽取 1 项奖励。随身格位不足时，放不下的物品送入洞府储藏室。',
    }),
  };
};
