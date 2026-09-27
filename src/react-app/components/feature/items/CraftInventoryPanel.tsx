import type { InventoryView } from '@shared/contracts/inventory';
import type { ReactNode } from 'react';
import { InkButton } from '../../ui/InkButton';
import { InventoryFilters } from './InventoryFilters';
import type { InventoryFilter } from './inventoryFilterModel';

export function CraftInventoryPanel({
  source,
  onSource,
  view,
  loading,
  error,
  filter,
  onFilter,
  kindDisabled = false,
  onPage,
  onReload,
  children,
}: {
  source: 'bag' | 'storage';
  onSource: (source: 'bag' | 'storage') => void;
  view?: InventoryView;
  loading: boolean;
  error?: string;
  filter: InventoryFilter;
  onFilter: (filter: InventoryFilter) => void;
  kindDisabled?: boolean;
  onPage: (page: number) => void;
  onReload: () => void;
  children: ReactNode;
}) {
  return (
    <div className="space-y-3 text-sm">
      <div className="flex flex-wrap items-center justify-between gap-x-4 gap-y-2">
        <div className="flex gap-4" aria-label="物品位置">
          {(
            [
              ['bag', '储物袋'],
              ['storage', '储藏室'],
            ] as const
          ).map(([value, label]) => (
            <button
              key={value}
              type="button"
              aria-pressed={source === value}
              onClick={() => onSource(value)}
              className="text-ink-secondary hover:text-crimson aria-pressed:text-crimson aria-pressed:border-crimson/60 min-h-10 cursor-pointer border-b border-transparent px-1"
            >
              {label}
            </button>
          ))}
        </div>
        <div className="text-ink-secondary flex items-center gap-3 text-xs">
          <span className="font-mono whitespace-nowrap">
            {source === 'bag'
              ? `${view?.used ?? '—'} / 40`
              : `${view?.total ?? '—'} 格`}
          </span>
          <InkButton disabled={loading} onClick={onReload}>
            刷新
          </InkButton>
        </div>
      </div>
      <InventoryFilters
        value={filter}
        onChange={onFilter}
        kindDisabled={kindDisabled}
      />
      {error ? (
        <p role="alert">{error}</p>
      ) : !view ? (
        <p role="status">正在读取{source === 'bag' ? '储物袋' : '储藏室'}……</p>
      ) : null}
      {children}
      {source === 'storage' && view && view.total > 40 ? (
        <div className="flex items-center justify-between">
          <InkButton
            disabled={loading || view.page === 0}
            onClick={() => onPage(view.page - 1)}
          >
            上一页
          </InkButton>
          <span className="font-mono">
            {view.page + 1} / {Math.ceil(view.total / 40)}
          </span>
          <InkButton
            disabled={loading || (view.page + 1) * 40 >= view.total}
            onClick={() => onPage(view.page + 1)}
          >
            下一页
          </InkButton>
        </div>
      ) : null}
    </div>
  );
}
