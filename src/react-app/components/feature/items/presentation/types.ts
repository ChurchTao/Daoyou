import type { InventoryView } from '@shared/contracts/inventory';
import type { ItemDefinition } from '@shared/items/types';
import type { CultivatorCondition } from '@shared/types/condition';
import type { RealmType } from '@shared/types/constants';
import type { ReactNode } from 'react';

export type DisplayItem = Pick<
  InventoryView['items'][number],
  'name' | 'definitionId' | 'instanceData' | 'quantity'
> & { equipped?: boolean };
export type PreviewTone =
  'normal' | 'accent' | 'positive' | 'warning' | 'muted';
export type PreviewLine = {
  label?: string;
  value: string | number;
  numeric?: boolean;
  delta?: number;
  tone?: PreviewTone;
};
/** 展开内容只能包含普通行，不允许继续嵌套详情。 */
export type PreviewLineEntry = { kind: 'line' } & PreviewLine;
export type PreviewEntry =
  | PreviewLineEntry
  | {
      kind: 'disclosure';
      title: string;
      tone?: PreviewTone;
      rows: PreviewLine[];
    };
export type PreviewSection = {
  title: string;
  tone?: PreviewTone;
} & (
  | { collapsible: true; entries: PreviewLineEntry[] }
  | { collapsible?: false; entries: PreviewEntry[] }
);
export type HeaderEntry =
  | { kind: 'field'; label: string; value: string | number }
  | { kind: 'quantity'; label: string; value: number }
  | { kind: 'status'; value: string };
export type PreviewOptions = {
  previous?: DisplayItem;
  comparisonItem?: DisplayItem;
  quantityLabel?: string;
  realm?: RealmType;
  condition?: CultivatorCondition;
};
export type ItemSummary = {
  icon: ReactNode;
  color: string;
  type: string;
  tier: string;
};
export type PreviewContent = {
  header: HeaderEntry[];
  sections: PreviewSection[];
  description?: string;
  comparison?: { title: string; sections: PreviewSection[] };
};
export type ItemPreviewModel = PreviewContent & {
  title: string;
  icon: ReactNode;
  titleColor: string;
};
/** resolve 只读取事实和轻量信息；详细效果延迟到 preview 调用。 */
export type ItemAdapter = (
  item: DisplayItem,
  definition: ItemDefinition,
) => {
  summary: ItemSummary;
  preview: (options: PreviewOptions) => PreviewContent;
};
