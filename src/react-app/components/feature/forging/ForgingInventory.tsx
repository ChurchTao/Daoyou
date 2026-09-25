import {
  matchesInventoryFilters,
  type InventoryKind,
} from '@app/components/feature/items/inventoryFilterModel';
import { InventoryFilters } from '@app/components/feature/items/InventoryFilters';
import { InventoryHeader } from '@app/components/feature/items/InventoryHeader';
import { InkButton } from '@app/components/ui/InkButton';
import { InventoryItems } from '../items/InventoryItems';
import type { ForgeItem, ForgingSession } from './useForgingSession';

export type ForgeFilter = InventoryKind;
export function ForgingInventory({
  session,
  filter,
  onFilter,
  selected,
  onChoose,
  fixedFilter = false,
}: {
  session: ForgingSession;
  filter: ForgeFilter;
  onFilter: (filter: ForgeFilter) => void;
  selected?: string;
  onChoose: (item: ForgeItem) => void;
  fixedFilter?: boolean;
}) {
  const search = session.storage.search;
  return (
    <div className="space-y-3 text-sm">
      <InventoryHeader
        title={session.source === 'bag' ? '储物袋' : '储藏室'}
        capacity={
          session.source === 'bag' ? (
            <>{session.inventory?.used ?? '—'} / 40</>
          ) : (
            <>{session.inventory?.total ?? '—'} 格</>
          )
        }
      />
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
            aria-pressed={session.source === value}
            onClick={() => session.setSource(value)}
            className="text-ink-secondary hover:text-crimson aria-pressed:text-crimson aria-pressed:border-crimson/60 min-h-10 cursor-pointer border-b border-transparent px-1"
          >
            {label}
          </button>
        ))}
      </div>
      {!fixedFilter ? (
        <InventoryFilters
          search={search}
          kind={filter}
          onSearch={session.storage.setSearch}
          onKind={(value) => {
            onFilter(value);
            session.storage.setPage(0);
          }}
        />
      ) : (
        <InventoryFilters
          search={search}
          kind="blueprint"
          kindDisabled
          onSearch={session.storage.setSearch}
          onKind={() => {}}
        />
      )}
      <p className="text-ink-secondary text-xs">
        已备{' '}
        <span className="font-mono">
          {session.total} / {session.cost?.quantity ?? 0}
        </span>
      </p>
      {!session.inventory && !session.error ? (
        <p role="status">
          正在读取{session.source === 'bag' ? '储物袋' : '储藏室'}……
        </p>
      ) : null}
      {session.source === 'storage' && session.storage.error ? (
        <p role="alert">{session.storage.error}</p>
      ) : null}
      <InventoryItems
        items={
          session.source === 'storage' ||
          (!fixedFilter && filter === 'all' && !search)
            ? (session.inventory?.items ?? [])
            : (session.inventory?.items ?? []).filter((item) =>
                matchesInventoryFilters(
                  item,
                  search,
                  fixedFilter ? 'blueprint' : filter,
                ),
              )
        }
        location={session.source}
        quickTouchHint
        compact={
          session.source === 'bag' &&
          (filter !== 'all' || !!search || fixedFilter)
        }
        slotProps={(item) => {
          const used =
            item && !session.result
              ? (session.quantities.get(item.id) ?? 0) +
                Number(session.blueprint?.id === item.id)
              : 0;
          const problem = item ? session.itemProblem(item) : null;
          return {
            guideAnchor:
              fixedFilter &&
              session.source === 'bag' &&
              item?.definitionId === 'blueprint.weapon.10'
                ? 'forge.blueprint'
                : undefined,
            selected: !!item && selected === item.id,
            disabled: session.locked || !!problem,
            quickOnTouch: true,
            badge: used ? `已投${used}` : item && !problem ? '可选' : undefined,
            onQuickAction: item ? () => onChoose(item) : undefined,
            children: item
              ? (close) => (
                  <>
                    {problem ? (
                      <p className="text-ink-secondary">{problem}</p>
                    ) : null}
                    <InkButton
                      disabled={session.locked || !!problem}
                      onClick={() => {
                        onChoose(item);
                        close();
                      }}
                    >
                      放入器炉
                    </InkButton>
                  </>
                )
              : undefined,
          };
        }}
      />
      {session.source === 'storage' &&
      session.inventory &&
      session.inventory.total > 40 ? (
        <div className="flex items-center justify-between">
          <InkButton
            disabled={session.locked || session.inventory.page === 0}
            onClick={() => session.storage.setPage(session.inventory!.page - 1)}
          >
            上一页
          </InkButton>
          <span className="font-mono">
            {session.inventory.page + 1} /{' '}
            {Math.ceil(session.inventory.total / 40)}
          </span>
          <InkButton
            disabled={
              session.locked ||
              (session.inventory.page + 1) * 40 >= session.inventory.total
            }
            onClick={() => session.storage.setPage(session.inventory!.page + 1)}
          >
            下一页
          </InkButton>
        </div>
      ) : null}
    </div>
  );
}
