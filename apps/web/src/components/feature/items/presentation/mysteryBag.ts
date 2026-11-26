import { tierColorMap } from '@app/components/ui/inkBadgeTiers';
import { findMysteryBag } from '@daoyou/game-content/items/mystery-bags';
import { describeMysteryBagRewards } from '@daoyou/game-rules/items/mystery-bags';
import { quantity } from './helpers';
import type { ItemAdapter } from './types';

export const mysteryBagAdapter: ItemAdapter = (item, definition) => {
  const bag = findMysteryBag(definition.id)!;
  return {
    summary: {
      icon: '👝',
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
