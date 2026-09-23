import { GameIcon } from '@app/components/ui/GameIcon';
import { cn } from '@shared/lib/cn';
import type { ReactNode } from 'react';
import type {
  HeaderEntry,
  ItemPreviewModel,
  PreviewEntry,
  PreviewLine,
  PreviewSection,
  PreviewTone,
} from './presentation/types';

const tones: Record<PreviewTone, string> = {
  normal: 'text-ink',
  accent: 'text-tier-xuan',
  positive: 'text-teal',
  warning: 'text-crimson',
  muted: 'text-ink-secondary',
};
function PreviewLineView({
  row,
  tone = 'normal',
}: {
  row: PreviewLine;
  tone?: PreviewTone;
}) {
  return (
    <div
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
    </div>
  );
}
function PreviewEntries({
  entries,
  tone,
}: {
  entries: PreviewEntry[];
  tone?: PreviewTone;
}) {
  return (
    <div className="space-y-1">
      {entries.map((entry, index) =>
        entry.kind === 'disclosure' ? (
          <details key={index}>
            <summary
              className={cn(
                'cursor-pointer',
                tones[entry.tone ?? tone ?? 'normal'],
              )}
            >
              {entry.title}
            </summary>
            <div className="mt-1 space-y-1 pl-3">
              {entry.rows.map((row, rowIndex) => (
                <PreviewLineView key={rowIndex} row={row} />
              ))}
            </div>
          </details>
        ) : (
          <PreviewLineView key={index} row={entry} tone={tone} />
        ),
      )}
    </div>
  );
}
function ItemPreviewSections({ sections }: { sections: PreviewSection[] }) {
  const visible = sections.filter((section) => section.entries.length);
  if (!visible.length) return null;
  return (
    <div className="space-y-4">
      {visible.map((section, index) =>
        section.collapsible ? (
          <details key={`${section.title}-${index}`} className="space-y-1.5">
            <summary className="cursor-pointer font-medium text-amber-800">
              {section.title}
            </summary>
            <div className="pl-3">
              <PreviewEntries entries={section.entries} tone={section.tone} />
            </div>
          </details>
        ) : (
          <section key={`${section.title}-${index}`} className="space-y-1.5">
            <h3 className="font-medium text-amber-800">{section.title}</h3>
            <div className="pl-3">
              <PreviewEntries entries={section.entries} tone={section.tone} />
            </div>
          </section>
        ),
      )}
    </div>
  );
}
function PreviewHeaderEntry({ entry }: { entry: HeaderEntry }) {
  if (entry.kind === 'field')
    return (
      <p className="text-amber-800">
        <span className="text-ink-secondary">{entry.label}：</span>
        {entry.value}
      </p>
    );
  return (
    <p className="text-ink-secondary">
      {entry.kind === 'quantity' ? (
        <>
          {entry.label} <span className="font-mono">{entry.value}</span>
        </>
      ) : (
        entry.value
      )}
    </p>
  );
}
type PreviewChrome = {
  close?: () => void;
  actions?: ReactNode;
  context?: string;
};
/** 纯渲染层：不读取物品定义，不决定类型特有的字段和比较规则。 */
export function ItemPreviewView({
  model,
  close,
  actions,
  context,
}: { model: ItemPreviewModel } & PreviewChrome) {
  return (
    <div className="text-ink space-y-4 text-sm leading-6 [overflow-wrap:anywhere]">
      <header className="border-ink/15 flex items-start gap-3 border-b pb-3">
        <div
          className="border-ink/20 bg-paper flex size-14 shrink-0 items-center justify-center rounded-sm border text-4xl"
          aria-hidden="true"
        >
          <GameIcon value={model.icon} purpose="artwork" />
        </div>
        <div className="min-w-0 flex-1 space-y-1">
          <h2
            className={cn(
              model.titleColor,
              'text-base leading-6 font-semibold',
            )}
          >
            {model.title}
          </h2>
          <div className="space-y-0.5">
            {model.header.map((entry, index) => (
              <PreviewHeaderEntry key={index} entry={entry} />
            ))}
          </div>
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
      {model.comparison ? (
        <details className="border-ink/15 border-t pt-3">
          <summary className="text-tier-xuan cursor-pointer">
            {model.comparison.title}
          </summary>
          <div className="mt-3">
            <ItemPreviewSections sections={model.comparison.sections} />
          </div>
        </details>
      ) : null}
      {model.description ? (
        <section
          aria-label="道具描述"
          className={cn(
            'text-ink-secondary',
            (model.sections.some((section) => section.entries.length) ||
              context ||
              model.comparison) &&
              'border-ink/15 border-t pt-3',
          )}
        >
          <p className="whitespace-pre-line">{model.description}</p>
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
