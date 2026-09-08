import { BAG_CAPACITY, itemDefinition } from '@shared/inventory';
import { MATERIAL_TYPE_NAMES } from '@shared/items/definitions/materials';
import { materialFactsOf } from '@shared/items/material';
import { cn } from '@shared/lib/cn';
import type { ForgeItem, ForgingSession } from './useForgingSession';

export type ForgeFilter = 'all' | 'blueprint' | 'material';
function forgeItemDescription(item: ForgeItem) {
  const definition = itemDefinition(item.definitionId);
  if (definition.kind !== 'material') return item.name;
  const facts = materialFactsOf(item.definitionId, item.instanceData);
  const benefit =
    facts.type === 'ore'
      ? '偏重白字'
      : facts.type === 'tcdb'
        ? '偏重器蕴'
        : '偏重附灵';
  return `${facts.rank} · ${MATERIAL_TYPE_NAMES[facts.type]} · ${benefit}${facts.description ? `。${facts.description}` : ''}`;
}
export function ForgeItemSigil({ item }: { item: ForgeItem }) {
  const kind = itemDefinition(item.definitionId).kind;
  return kind === 'material' ? '◆' : kind === 'equipment' ? '◇' : '卷';
}
export function ForgingInventory({
  session,
  filter,
  onFilter,
  selected,
  message,
  onChoose,
}: {
  session: ForgingSession;
  filter: ForgeFilter;
  onFilter: (filter: ForgeFilter) => void;
  selected?: string;
  message: string;
  onChoose: (item: ForgeItem) => void;
}) {
  const slots = new Map(
    session.view?.inventory.items.map((item) => [item.slotIndex, item]),
  );
  const inspected = selected ? session.byId.get(selected) : undefined;
  return (
    <div className="space-y-3 text-sm">
      <header className="flex flex-wrap items-center justify-between gap-2">
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
            className="text-ink-secondary hover:text-crimson aria-pressed:text-crimson aria-pressed:border-crimson/60 min-h-10 cursor-pointer border-b border-transparent px-1 transition-colors motion-reduce:transition-none"
          >
            {label}
          </button>
        ))}
      </div>
      {!session.view ? <p role="status">正在读取储物袋……</p> : null}
      <div className="grid grid-cols-5 gap-1" aria-label="40格储物袋">
        {Array.from({ length: BAG_CAPACITY }, (_, index) => {
          const item = slots.get(index);
          const matching =
            !item ||
            filter === 'all' ||
            itemDefinition(item.definitionId).kind === filter;
          const used =
            item && !session.result
              ? (session.quantities.get(item.id) ?? 0) +
                Number(session.blueprint?.id === item.id)
              : 0;
          const unavailable = item ? session.itemProblem(item) : null;
          return (
            <button
              key={index}
              type="button"
              disabled={!item || !matching || session.locked}
              aria-label={
                item
                  ? `${item.name}，持有${item.quantity}，已投入${used}${unavailable ? `，${unavailable}` : ''}`
                  : `空格 ${index + 1}`
              }
              onClick={() => item && onChoose(item)}
              className={cn(
                'border-ink/15 bg-ink/3 hover:border-crimson/40 relative flex aspect-square min-h-11 min-w-0 cursor-pointer flex-col items-center justify-center border px-1 py-3 transition-colors disabled:cursor-default motion-reduce:transition-none',
                !matching && 'opacity-25',
                unavailable && 'text-ink-secondary',
                selected === item?.id &&
                  item &&
                  'outline-crimson/50 outline outline-offset-1',
              )}
            >
              {item ? (
                <>
                  <span
                    aria-hidden="true"
                    className="text-ink-secondary text-lg leading-none"
                  >
                    <ForgeItemSigil item={item} />
                  </span>
                  <span className="line-clamp-1 w-full text-center text-[10px] leading-4">
                    {item.name}
                  </span>
                  <span className="absolute right-1 bottom-0 text-[10px]">
                    {item.quantity}
                  </span>
                  {used ? (
                    <span className="text-crimson bg-paper absolute top-0 left-0.5 text-[10px]">
                      已投{used}
                    </span>
                  ) : null}
                </>
              ) : (
                <span aria-hidden="true" className="text-ink/15">
                  ·
                </span>
              )}
            </button>
          );
        })}
      </div>
      <section
        className="border-ink/10 min-h-20 space-y-1 border-t pt-3"
        aria-live="polite"
      >
        {inspected ? (
          <>
            <p>{inspected.name}</p>
            <p className="text-ink-secondary text-xs leading-6">
              {forgeItemDescription(inspected)}
            </p>
          </>
        ) : (
          <p className="text-ink-secondary text-xs">
            点击图纸定型，点击灵材逐份投入。
          </p>
        )}
        {message ? <p className="text-crimson text-xs">{message}</p> : null}
      </section>
    </div>
  );
}
