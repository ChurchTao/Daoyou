import { inventoryKinds, type InventoryKind } from './inventoryFilterModel';

export function InventoryFilters({
  search,
  kind,
  onSearch,
  onKind,
  kindDisabled = false,
}: {
  search: string;
  kind: InventoryKind;
  onSearch: (value: string) => void;
  onKind: (value: InventoryKind) => void;
  kindDisabled?: boolean;
}) {
  return (
    <div className="flex min-w-0 flex-1 flex-wrap gap-2">
      <input
        aria-label="搜索物品"
        placeholder="搜索物品"
        value={search}
        className="border-ink/20 min-w-0 flex-1 border-b bg-transparent p-2 text-sm"
        onChange={(event) => onSearch(event.target.value)}
      />
      <select
        aria-label="物品分类"
        value={kind}
        disabled={kindDisabled}
        className="bg-transparent text-sm"
        onChange={(event) => onKind(event.target.value as InventoryKind)}
      >
        {inventoryKinds.map(([value, label]) => (
          <option key={value} value={value}>
            {label}
          </option>
        ))}
      </select>
    </div>
  );
}
