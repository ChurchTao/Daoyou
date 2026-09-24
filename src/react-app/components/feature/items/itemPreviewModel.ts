import { resolveItemPresentation } from './presentation/registry';
import type {
  DisplayItem,
  ItemPreviewModel,
  PreviewOptions,
} from './presentation/types';
export type { PreviewOptions } from './presentation/types';

export function itemPreviewModel(
  item: DisplayItem,
  options: PreviewOptions = {},
): ItemPreviewModel {
  const resolved = resolveItemPresentation(item);
  return {
    title: item.name,
    icon: resolved.summary.icon,
    titleColor: resolved.summary.color,
    ...resolved.preview(options),
  };
}
