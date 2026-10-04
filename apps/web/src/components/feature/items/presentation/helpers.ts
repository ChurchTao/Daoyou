import type {
  DisplayItem,
  HeaderEntry,
  PreviewLineEntry,
  PreviewOptions,
} from './types';

export const lines = (text: string): PreviewLineEntry[] =>
  text
    .split('\n')
    .filter(Boolean)
    .map((value) => ({ kind: 'line', value }));
export const field = (label: string, value: string | number): HeaderEntry => ({
  kind: 'field',
  label,
  value,
});
export const quantity = (
  item: DisplayItem,
  options: PreviewOptions,
): HeaderEntry => ({
  kind: 'quantity',
  label: options.quantityLabel ?? '持有',
  value: item.quantity,
});
