import { InkModal } from '@app/components/layout';
import { InkButton } from '@app/components/ui/InkButton';
import { InkInput } from '@app/components/ui/InkInput';
import { InkSelect } from '@app/components/ui/InkSelect';
import {
  getGameConceptLabel,
  getMaterialTypeLabel,
} from '@shared/lib/gameConceptDisplay';
import type { ItemLibraryEntry } from '@shared/lib/itemLibrary';
import {
  MATERIAL_TYPE_VALUES,
  QUALITY_VALUES,
  type MaterialType,
  type Quality,
} from '@shared/types/constants';
import { useEffect, useMemo, useState } from 'react';

type ItemLibraryEntryType = ItemLibraryEntry['type'];

interface ItemLibraryPickerResponse {
  items?: ItemLibraryEntry[];
  page?: number;
  pageSize?: number;
  total?: number;
  totalPages?: number;
  error?: string;
}

interface ItemLibraryPickerProps {
  value: string;
  onChange: (itemId: string, item?: ItemLibraryEntry) => void;
  disabled?: boolean;
  label?: string;
  defaultType?: ItemLibraryEntryType | '';
  includeMaterials?: boolean;
  triggerLabel?: string;
  confirmLabel?: string;
  emptyLabel?: string;
  showFieldLabel?: boolean;
  triggerOnly?: boolean;
}

function getItemLibraryItemLabel(item: ItemLibraryEntry) {
  return `${item.name}（${getGameConceptLabel(item.type)} / ${item.itemId}）`;
}

function getItemMeta(item: ItemLibraryEntry) {
  const parts = [getGameConceptLabel(item.type)];
  if (item.category) parts.push(item.category);
  if (item.quality) parts.push(item.quality);
  if (item.element) parts.push(item.element);
  return parts.join(' / ');
}

export function ItemLibraryPicker({
  value,
  onChange,
  disabled = false,
  label = '道具',
  defaultType = '',
  includeMaterials = false,
  triggerLabel = '选择',
  confirmLabel = '确定添加',
  emptyLabel = '未选择',
  showFieldLabel = true,
  triggerOnly = false,
}: ItemLibraryPickerProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [query, setQuery] = useState('');
  const [debouncedQuery, setDebouncedQuery] = useState('');
  const [type, setType] = useState<ItemLibraryEntryType | ''>(defaultType);
  const [materialType, setMaterialType] = useState<MaterialType | ''>('');
  const [quality, setQuality] = useState<Quality | ''>('');
  const [page, setPage] = useState(1);
  const [items, setItems] = useState<ItemLibraryEntry[]>([]);
  const [selected, setSelected] = useState<ItemLibraryEntry | null>(null);
  const [draftSelection, setDraftSelection] = useState<ItemLibraryEntry | null>(
    null,
  );
  const [totalPages, setTotalPages] = useState(1);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const hasSearchQuery = debouncedQuery.trim().length > 0;
  const shouldLoad =
    isOpen &&
    (type === 'material'
      ? includeMaterials ||
        hasSearchQuery ||
        Boolean(materialType) ||
        Boolean(quality)
      : Boolean(type) || hasSearchQuery);

  useEffect(() => {
    const timer = window.setTimeout(() => setDebouncedQuery(query), 250);
    return () => window.clearTimeout(timer);
  }, [query]);

  useEffect(() => {
    if (!isOpen || !shouldLoad) {
      return;
    }

    let cancelled = false;
    const params = new URLSearchParams({
      status: 'published',
      page: String(page),
      pageSize: '12',
    });
    if (type) params.set('type', type);
    if (type === 'material' && materialType) {
      params.set('materialType', materialType);
    }
    if (quality) params.set('quality', quality);
    if (debouncedQuery.trim()) params.set('q', debouncedQuery.trim());

    const loadItems = async () => {
      setLoading(true);
      setError(null);
      try {
        const response = await fetch(
          `/api/admin/item-library?${params.toString()}`,
          {
            cache: 'no-store',
          },
        );
        const data = (await response.json()) as ItemLibraryPickerResponse;
        if (!response.ok) throw new Error(data.error ?? '加载道具库失败');
        if (!cancelled) {
          setItems(data.items ?? []);
          setTotal(data.total ?? 0);
          setTotalPages(data.totalPages ?? 1);
        }
      } catch (err) {
        if (!cancelled) {
          setError(err instanceof Error ? err.message : '加载道具库失败');
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    };

    void loadItems();

    return () => {
      cancelled = true;
    };
  }, [debouncedQuery, isOpen, materialType, page, quality, shouldLoad, type]);

  useEffect(() => {
    if (!value) {
      return;
    }

    let cancelled = false;
    const params = new URLSearchParams({
      itemIds: value,
      pageSize: '1',
    });
    void fetch(`/api/admin/item-library?${params.toString()}`, {
      cache: 'no-store',
    })
      .then(async (response) => {
        const data = (await response.json()) as ItemLibraryPickerResponse;
        if (!response.ok) throw new Error(data.error ?? '加载已选道具失败');
        if (!cancelled) setSelected(data.items?.[0] ?? null);
      })
      .catch(() => {
        if (!cancelled) setSelected(null);
      });
    return () => {
      cancelled = true;
    };
  }, [value]);

  const currentSelected = value ? selected : null;
  const currentLabel = currentSelected
    ? getItemLibraryItemLabel(currentSelected)
    : emptyLabel;
  const canConfirm = Boolean(draftSelection);
  const showMaterialHint =
    isOpen &&
    type === 'material' &&
    !includeMaterials &&
    !debouncedQuery.trim() &&
    !materialType &&
    !quality;
  const showTypeHint = isOpen && !type && !debouncedQuery.trim();

  const visibleItems = useMemo(() => {
    if (!shouldLoad) return [];
    if (!draftSelection) return items;
    if (items.some((item) => item.itemId === draftSelection.itemId)) {
      return items;
    }
    return [draftSelection, ...items];
  }, [draftSelection, items, shouldLoad]);

  const openPicker = () => {
    setDraftSelection(currentSelected);
    setIsOpen(true);
  };

  const handleQueryChange = (next: string) => {
    setQuery(next);
    setPage(1);
  };

  const resetFilters = () => {
    setQuery('');
    setDebouncedQuery('');
    setType(defaultType);
    setMaterialType('');
    setQuality('');
    setPage(1);
  };

  const handleTypeChange = (next: string) => {
    const nextType = next as ItemLibraryEntryType | '';
    setType(nextType);
    setPage(1);
    if (nextType !== 'material') {
      setMaterialType('');
    }
  };

  const handleQualityChange = (next: string) => {
    setQuality(next as Quality | '');
    setPage(1);
  };

  const handleMaterialTypeChange = (next: string) => {
    setMaterialType(next as MaterialType | '');
    setPage(1);
  };

  const modal = (
    <InkModal
      isOpen={isOpen}
      onClose={() => setIsOpen(false)}
      title="选择道具库道具"
      className="max-w-4xl"
      footer={
        <div className="flex flex-wrap items-center justify-between gap-3">
          <p className="text-ink-secondary min-w-0 truncate text-sm">
            {draftSelection
              ? `已选：${getItemLibraryItemLabel(draftSelection)}`
              : '尚未选择道具'}
          </p>
          <div className="flex gap-2">
            <InkButton
              type="button"
              variant="secondary"
              onClick={() => setIsOpen(false)}
            >
              取消
            </InkButton>
            <InkButton
              type="button"
              variant="primary"
              disabled={!canConfirm}
              onClick={() => {
                if (!draftSelection) return;
                onChange(draftSelection.itemId, draftSelection);
                setSelected(draftSelection);
                setIsOpen(false);
              }}
            >
              {confirmLabel}
            </InkButton>
          </div>
        </div>
      }
    >
      <div className="space-y-4">
        <div className="grid gap-3 md:grid-cols-[minmax(0,1.4fr)_minmax(0,1fr)_minmax(0,1fr)_minmax(0,1fr)_auto]">
          <InkInput
            label="名称 / ID"
            value={query}
            onChange={handleQueryChange}
            placeholder="输入关键词"
          />
          <InkSelect label="类型" value={type} onChange={handleTypeChange}>
            <option value="">全部类型</option>
            <option value="consumable">消耗品</option>
            <option value="artifact">法宝</option>
            <option value="material">材料</option>
          </InkSelect>
          <InkSelect
            label="品质"
            value={quality}
            onChange={handleQualityChange}
          >
            <option value="">全部品质</option>
            {QUALITY_VALUES.map((itemQuality) => (
              <option key={itemQuality} value={itemQuality}>
                {itemQuality}
              </option>
            ))}
          </InkSelect>
          <InkSelect
            label="材料类型"
            value={materialType}
            onChange={handleMaterialTypeChange}
            disabled={type !== 'material'}
          >
            <option value="">全部材料</option>
            {MATERIAL_TYPE_VALUES.map((itemType) => (
              <option key={itemType} value={itemType}>
                {getMaterialTypeLabel(itemType)}
              </option>
            ))}
          </InkSelect>
          <div className="flex items-end">
            <InkButton type="button" variant="secondary" onClick={resetFilters}>
              重置
            </InkButton>
          </div>
        </div>

        {showMaterialHint ? (
          <div className="border-ink/15 bg-paper/70 text-ink-secondary border border-dashed px-4 py-3 text-sm">
            材料库可能很大。请选择材料类型、品质，或输入名称关键词后检索。
          </div>
        ) : null}

        {showTypeHint ? (
          <div className="border-ink/15 bg-paper/70 text-ink-secondary border border-dashed px-4 py-3 text-sm">
            请选择具体类型，或输入名称 / ID 关键词后检索。
          </div>
        ) : null}

        {error ? (
          <div className="border-danger/40 text-danger border border-dashed px-4 py-3 text-sm">
            {error}
          </div>
        ) : null}

        <div className="min-h-[18rem] space-y-2">
          {loading ? (
            <div className="text-ink-secondary border-ink/15 border border-dashed px-4 py-8 text-center text-sm">
              道具库加载中...
            </div>
          ) : null}
          {!loading && shouldLoad && visibleItems.length === 0 ? (
            <div className="text-ink-secondary border-ink/15 border border-dashed px-4 py-8 text-center text-sm">
              当前条件下没有可选道具。
            </div>
          ) : null}
          {!loading
            ? visibleItems.map((item) => {
                const active = draftSelection?.itemId === item.itemId;
                return (
                  <button
                    key={item.id}
                    type="button"
                    onClick={() => setDraftSelection(item)}
                    className={`block w-full border border-dashed p-3 text-left transition ${
                      active
                        ? 'border-crimson/70 bg-crimson/10'
                        : 'border-ink/15 bg-paper/80 hover:border-crimson/50'
                    }`}
                  >
                    <span className="text-ink block truncate font-semibold">
                      {item.name}
                    </span>
                    <span className="text-ink-secondary mt-1 block truncate text-xs">
                      {item.itemId} · {getItemMeta(item)}
                    </span>
                  </button>
                );
              })
            : null}
        </div>

        <div className="flex flex-wrap items-center justify-between gap-3">
          <span className="text-ink-secondary text-xs">
            共 {total} 项，第 {page} / {totalPages} 页
          </span>
          <div className="flex gap-2">
            <InkButton
              type="button"
              variant="secondary"
              disabled={page <= 1}
              onClick={() => setPage((current) => Math.max(1, current - 1))}
            >
              上一页
            </InkButton>
            <InkButton
              type="button"
              variant="secondary"
              disabled={page >= totalPages}
              onClick={() => setPage((current) => current + 1)}
            >
              下一页
            </InkButton>
          </div>
        </div>
      </div>
    </InkModal>
  );

  if (triggerOnly) {
    return (
      <>
        <InkButton
          type="button"
          variant="secondary"
          disabled={disabled}
          onClick={openPicker}
        >
          {triggerLabel}
        </InkButton>
        {modal}
      </>
    );
  }

  return (
    <div className="space-y-2">
      <div className="flex flex-col gap-1">
        {showFieldLabel ? (
          <span className="text-ink font-semibold tracking-[0.08em]">
            {label}
          </span>
        ) : null}
        <div className="border-ink/15 bg-bgpaper/70 flex items-center justify-between gap-3 rounded-sm border border-dashed px-3 py-2">
          <span className="text-ink-secondary min-w-0 truncate text-sm">
            {currentLabel}
          </span>
          <InkButton
            type="button"
            variant="secondary"
            disabled={disabled}
            onClick={openPicker}
          >
            {triggerLabel}
          </InkButton>
        </div>
      </div>

      {modal}
    </div>
  );
}
