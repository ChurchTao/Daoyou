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
      {rows.map((row, index) =>
        row.collapsible && row.children?.length ? (
          <details key={index}>
            <summary className={cn('cursor-pointer', tones[row.tone ?? tone])}>
              {row.value}
            </summary>
            <div className="mt-1 pl-3">
              <PreviewRows rows={row.children} />
            </div>
          </details>
        ) : (
          <div
            key={index}
            className={cn(
              row.label
                ? 'grid grid-cols-[minmax(0,5.5em)_minmax(0,1fr)] gap-x-2'
                : '',
              tones[row.tone ?? tone],
            )}
          >
            {row.label ? <span>{row.label}</span> : null}
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
            {row.children?.length ? (
              <div className="text-ink col-span-full mt-1 pl-3">
                <PreviewRows rows={row.children} />
              </div>
            ) : null}
          </div>
        ),
      )}
    </div>
  );
}
export function ItemPreviewSections({
  sections,
}: {
  sections: PreviewSection[];
}) {
  const visibleSections = sections.filter((section) => section.rows.length);
  if (!visibleSections.length) return null;
  return (
    <div className="space-y-4">
      {visibleSections.map((section, index) =>
        section.collapsible ? (
          <details key={`${section.title}-${index}`} className="space-y-1.5">
            <summary className="cursor-pointer font-medium text-amber-800">
              {section.title}
            </summary>
            <div className="pl-3">
              <PreviewRows rows={section.rows} tone={section.tone} />
            </div>
          </details>
        ) : (
          <section key={`${section.title}-${index}`} className="space-y-1.5">
            <h3 className="font-medium text-amber-800">{section.title}</h3>
            <div className="pl-3">
              <PreviewRows rows={section.rows} tone={section.tone} />
            </div>
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
          className="border-ink/20 bg-paper flex size-14 shrink-0 items-center justify-center rounded-sm border text-4xl"
          aria-hidden="true"
        >
          {model.icon}
        </div>
        <div className="min-w-0 flex-1 space-y-1">
          <h2 className={cn(model.color, 'text-base leading-6 font-semibold')}>
            {item.name}
          </h2>
          <div className="space-y-0.5">
            {model.identity.map((row, index) => (
              <p key={index} className="text-amber-800">
                <span className="text-ink-secondary">{row.label}：</span>
                {row.value}
              </p>
            ))}
          </div>
          {item.definitionId !== 'equipment.v6' ? (
            <p className="text-ink-secondary">
              {quantityLabel} <span className="font-mono">{item.quantity}</span>
            </p>
          ) : item.equipped ? (
            <p className="text-ink-secondary">已穿戴</p>
          ) : null}
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
        <section
          aria-label="道具描述"
          className={cn(
            'text-ink-secondary',
            (model.sections.length > 0 || context || comparisonItem) &&
              'border-ink/15 border-t pt-3',
          )}
        >
          <p className="whitespace-pre-line">{model.flavor}</p>
        </section>
      ) : null}
      {actions ? (
        <footer className="border-ink/15 space-y-3 border-t pt-3">
          {actions}
        </footer>
      ) : null}
    </div>
  );
}
