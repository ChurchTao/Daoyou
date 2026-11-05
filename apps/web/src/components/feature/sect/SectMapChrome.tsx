import { updateGameSettings, type GameSettings } from '@app/lib/game-setting';
import type { ReactNode } from 'react';

export interface SectMapBackAction {
  label: string;
  onBack(): void;
}

const toolbarButton =
  'text-ink hover:bg-ink/10 focus-visible:outline-crimson inline-flex min-h-11 min-w-11 shrink-0 items-center justify-center rounded-sm px-2.5 text-sm whitespace-nowrap focus-visible:outline-2 focus-visible:outline-offset-[-2px]';
const toolbarGroup =
  'bg-paper/95 border-ink/15 pointer-events-auto flex min-w-0 items-center rounded-sm border p-0.5 shadow-sm backdrop-blur-sm';

export function SectMapToolbar({
  title,
  backAction,
  mapMode,
  onOpenDirectory,
}: {
  title: string;
  backAction: SectMapBackAction;
  mapMode?: GameSettings['mapMode'];
  onOpenDirectory?(trigger: HTMLButtonElement): void;
}) {
  return (
    <header className="pointer-events-none absolute inset-x-0 top-0 z-30 flex items-start justify-between gap-2 pt-[calc(var(--app-safe-top)+0.5rem)] pr-[max(env(safe-area-inset-right),0.75rem)] pl-[max(env(safe-area-inset-left),0.75rem)]">
      <nav aria-label="地图导航" className={toolbarGroup}>
        <button
          type="button"
          aria-label={backAction.label}
          title={backAction.label}
          onClick={backAction.onBack}
          className={toolbarButton}
        >
          <span aria-hidden="true" className="text-lg">
            ←
          </span>
          <span className="ml-1.5 hidden md:inline">{backAction.label}</span>
        </button>
      </nav>
      <div className={toolbarGroup}>
        <h1
          className="min-w-0 truncate px-2 text-sm font-semibold md:px-3"
          title={title}
        >
          {title}
        </h1>
        {onOpenDirectory ? (
          <button
            type="button"
            aria-haspopup="dialog"
            onClick={(event) => onOpenDirectory(event.currentTarget)}
            className={toolbarButton}
          >
            设施名录
          </button>
        ) : null}
        {mapMode ? (
          <button
            type="button"
            className={toolbarButton}
            aria-label={
              mapMode === 'atlas' ? '切换至文字地图' : '切换至画卷地图'
            }
            onClick={() =>
              updateGameSettings({
                mapMode: mapMode === 'atlas' ? 'text' : 'atlas',
              })
            }
          >
            {mapMode === 'atlas' ? '文字' : '画卷'}
          </button>
        ) : null}
      </div>
    </header>
  );
}

export function SectMapText({ children }: { children: ReactNode }) {
  return (
    <div className="bg-paper absolute inset-0 overflow-y-auto overscroll-contain pt-[calc(var(--app-safe-top)+4.25rem)] pr-[max(env(safe-area-inset-right),1rem)] pb-[max(env(safe-area-inset-bottom),1rem)] pl-[max(env(safe-area-inset-left),1rem)]">
      <div className="mx-auto max-w-3xl">{children}</div>
    </div>
  );
}
