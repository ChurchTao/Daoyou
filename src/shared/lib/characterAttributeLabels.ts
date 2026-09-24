import type { Attributes } from '@shared/types/cultivator';

/** 人物基础六维；speed 表示身法，战斗面板中的 speed 另称速度。 */
export const CHARACTER_ATTRIBUTE_LABELS = {
  vitality: '体魄',
  strength: '力道',
  spirit: '灵力',
  endurance: '根骨',
  speed: '身法',
  willpower: '神识',
} as const satisfies Record<keyof Attributes, string>;
