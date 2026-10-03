import { resolveItemPresentation } from './presentation/registry';
import type { DisplayItem } from './presentation/types';
export type { DisplayItem } from './presentation/types';

/** 物品格、聊天摘要和货架只读取轻量信息。 */
export function itemPresentation(item: DisplayItem) {
  return resolveItemPresentation(item).summary;
}
