import type { ReactNode } from 'react';
import { ItemPreviewView } from './ItemPreviewView';
import { itemPreviewModel } from './itemPreviewModel';
import type { DisplayItem, PreviewOptions } from './presentation/types';
type PreviewChrome = {
  close?: () => void;
  actions?: ReactNode;
  context?: string;
};

/** 保留现有入口，业务操作和浮层定位仍由调用方拥有。 */
export function ItemPreview({
  item,
  options,
  quantityLabel = '持有',
  comparisonItem,
  ...chrome
}: {
  item: DisplayItem;
  options?: PreviewOptions;
  quantityLabel?: string;
  comparisonItem?: DisplayItem;
} & PreviewChrome) {
  const model = itemPreviewModel(item, {
    ...options,
    quantityLabel,
    comparisonItem,
  });
  return (
    <div data-item-preview={item.definitionId}>
      <ItemPreviewView model={model} {...chrome} />
    </div>
  );
}
