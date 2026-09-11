import { InkButton } from '@app/components/ui/InkButton';
import { itemDefinition } from '@shared/inventory';
import { InventoryItems } from '../items/InventoryItems';
import type { ForgeItem, ForgingSession } from './useForgingSession';

export type ForgeFilter = 'all' | 'blueprint' | 'material';
export function ForgingInventory({
  session,
  filter,
  onFilter,
  selected,
  onChoose,
}: {
  session: ForgingSession;
  filter: ForgeFilter;
  onFilter: (filter: ForgeFilter) => void;
  selected?: string;
  onChoose: (item: ForgeItem) => void;
}) {
  return (
    <div className="space-y-3 text-sm">
      <header className="flex justify-between">
        <h3 className="font-medium">储物袋</h3>
        <span className="text-ink-secondary text-xs">
          已备 {session.total} / {session.cost?.quantity ?? 0}
        </span>
      </header>
      <div className="flex gap-4" aria-label="物品类别">
        {(
          [
            ['all', '全部'],
            ['blueprint', '图纸'],
            ['material', '灵材'],
          ] as const
        ).map(([value, label]) => (
          <button
            key={value}
            type="button"
            aria-pressed={filter === value}
            onClick={() => onFilter(value)}
            className="text-ink-secondary hover:text-crimson aria-pressed:text-crimson aria-pressed:border-crimson/60 min-h-10 cursor-pointer border-b border-transparent px-1"
          >
            {label}
          </button>
        ))}
      </div>
      {!session.view && !session.error ? (
        <p role="status">正在读取储物袋……</p>
      ) : null}
      <InventoryItems
        items={session.inventory?.items ?? []}
        slotProps={(item) => {
          const matching =
            !item ||
            filter === 'all' ||
            itemDefinition(item.definitionId).kind === filter;
          const used =
            item && !session.result
              ? (session.quantities.get(item.id) ?? 0) +
                Number(session.blueprint?.id === item.id)
              : 0;
          const problem = item ? session.itemProblem(item) : null;
          return {
            selected: !!item && selected === item.id,
            disabled: !matching || session.locked || !!problem,
            className: !matching ? 'opacity-25' : undefined,
            badge: used ? `已投${used}` : item && !problem ? '可选' : undefined,
            onQuickAction: item ? () => onChoose(item) : undefined,
            children: item
              ? (close) => (
                  <>
                    {problem ? (
                      <p className="text-ink-secondary">{problem}</p>
                    ) : null}
                    <InkButton
                      disabled={session.locked || !matching || !!problem}
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
    </div>
  );
}
