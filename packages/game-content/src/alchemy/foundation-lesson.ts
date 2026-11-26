import type { MaterialFacts } from '@daoyou/game-domain/inventory';

export const FOUNDATION_LESSON_MATERIALS = {
  'story.herb.ningxi-root': {
    name: '白节根',
    type: 'herb',
    rank: '凡品',
    element: '土',
    description: '根皮黄褐，节上泛白。切成薄片后有一股辛气。',
  },
  'story.herb.shouyuan-leaf': {
    name: '灰背蓼',
    type: 'herb',
    rank: '凡品',
    element: '土',
    description: '叶背覆着一层浅灰细绒，揉开才闻得到草香。',
  },
} as const satisfies Readonly<Record<string, MaterialFacts>>;

export const FOUNDATION_LESSON_DOSE = 2;
export const FOUNDATION_LESSON_INTENT = '炼一炉能冲关蓄势的丹';
