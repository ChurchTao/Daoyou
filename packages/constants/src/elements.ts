// 统一的常量与派生类型定义

// 元素
export const ELEMENT_VALUES = [
  '金',
  '木',
  '水',
  '火',
  '土',
  '风',
  '雷',
  '冰',
] as const;

export type ElementType = (typeof ELEMENT_VALUES)[number];
