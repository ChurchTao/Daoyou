import { cn } from '@shared/lib/cn';
import type { ReactNode } from 'react';
import type { DisplayItem } from './itemPresentation';
import {
  itemPreviewModel,
  type PreviewOptions,
  type PreviewRow,
  type PreviewSection,
  type PreviewTone,
} from './itemPreviewModel';

const tones: Record<PreviewTone, string> = {
  normal: 'text-ink',
  accent: 'text-tier-xuan',
  positive: 'text-teal',
  warning: 'text-crimson',
  muted: 'text-ink-secondary',
};
function PreviewRows({
  rows,
  tone = 'normal',
}: {
  rows: PreviewRow[];
  tone?: PreviewTone;
}) {
  return (
    <div className="space-y-1">
      {rows.map((row, index) => (
        <div
          key={index}
          className={cn(
            row.label
              ? 'grid grid-cols-[minmax(0,5.5em)_minmax(0,1fr)] gap-x-3'
              : '',
            tones[row.tone ?? tone],
          )}
        >
          {row.label ? (
            <span className="text-ink-secondary">{row.label}</span>
          ) : null}
          <span
            className={cn(
              'min-w-0 whitespace-pre-line',
              row.numeric && 'font-mono',
            )}
          >
            {row.value}
            {row.delta !== undefined && row.delta !== 0 ? (
              <span
                className={cn(
                  'ml-2 font-mono',
                  row.delta > 0 ? tones.positive : tones.warning,
                )}
                aria-label={`较已穿戴${row.delta > 0 ? '增加' : '减少'}${Math.abs(row.delta)}`}
              >
                {row.delta > 0 ? '↑' : '↓'} {Math.abs(row.delta)}
              </span>
            ) : null}
          </span>
        </div>
      ))}
    </div>
  );
}
export function ItemPreviewSections({
  sections,
}: {
  sections: PreviewSection[];
}) {
  return (
    <div className="space-y-4">
      {sections
        .filter((s) => s.rows.length)
        .map((section, index) =>
          section.collapsible ? (
            <details key={`${section.title}-${index}`} className="space-y-1.5">
              <summary className="text-ink-secondary cursor-pointer">
                {section.title}
              </summary>
              <PreviewRows rows={section.rows} tone={section.tone} />
            </details>
          ) : (
            <section key={`${section.title}-${index}`} className="space-y-1.5">
              <h3 className="text-amber-800">{section.title}</h3>
              <PreviewRows rows={section.rows} tone={section.tone} />
            </section>
          ),
        )}
    </div>
  );
}

/** 所有现行道具共享内容层级；浮层定位、模态壳和业务操作由调用方负责。 */
export function ItemPreview({
  item,
  options,
  quantityLabel = '持有',
  close,
  actions,
  context,
  comparisonItem,
}: {
  item: DisplayItem;
  options?: PreviewOptions;
  quantityLabel?: string;
  close?: () => void;
  actions?: ReactNode;
  context?: string;
  comparisonItem?: DisplayItem;
}) {
  const model = itemPreviewModel(item, options);
  return (
    <div
      className="text-ink space-y-4 text-sm leading-6 [overflow-wrap:anywhere]"
      data-item-preview={item.definitionId}
    >
      <header className="border-ink/15 flex items-start gap-3 border-b pb-3">
        <div
          className="border-ink/15 flex size-12 shrink-0 items-center justify-center border text-3xl"
          aria-hidden="true"
        >
          {model.icon}
        </div>
        <div className="min-w-0 flex-1 space-y-1">
          <p className={model.color}>{item.name}</p>
          <p className="text-ink-secondary">
            {quantityLabel} <span className="font-mono">{item.quantity}</span>
            {item.equipped ? ' · 已穿戴' : ''}
          </p>
        </div>
        {close ? (
          <button
            type="button"
            aria-label="关闭物品预览"
            onClick={close}
            className="text-ink-secondary hover:text-ink -mt-1 -mr-1 flex size-8 shrink-0 cursor-pointer items-center justify-center"
          >
            ×
          </button>
        ) : null}
      </header>
      {model.metadata.length ? (
        <div className="flex flex-wrap gap-x-5 gap-y-1">
          {model.metadata.map((row, index) => (
            <p key={index} className="flex gap-2">
              <span className="text-ink-secondary">{row.label}</span>
              <span
                className={cn(
                  tones[row.tone ?? 'normal'],
                  row.numeric && 'font-mono',
                )}
              >
                {row.value}
              </span>
            </p>
          ))}
        </div>
      ) : null}
      {context ? <p className="text-ink-secondary">{context}</p> : null}
      <ItemPreviewSections sections={model.sections} />
      {comparisonItem && item.definitionId === 'equipment.v6' ? (
        <details className="border-ink/15 border-t pt-3">
          <summary className="text-tier-xuan cursor-pointer">
            与已穿戴的{comparisonItem.name}比较
          </summary>
          <div className="mt-3">
            <ItemPreviewSections
              sections={
                itemPreviewModel(item, { previous: comparisonItem }).sections
              }
            />
          </div>
        </details>
      ) : null}
      {model.flavor ? (
        <p className="text-ink-secondary border-ink/10 border-t pt-3 whitespace-pre-line">
          {model.flavor}
        </p>
      ) : null}
      {actions ? (
        <footer className="border-ink/15 space-y-3 border-t pt-3">
          {actions}
        </footer>
      ) : null}
    </div>
  );
}
