import { InkModal } from '@app/components/layout/InkModal';
import { InkButton } from '@app/components/ui/InkButton';
import { InkDiscreteRange } from '@app/components/ui/InkDiscreteRange';
import type { InventorySort } from '@daoyou/game-domain/inventory';
import {
  INVENTORY_MATERIAL_TYPES,
  MATERIAL_TYPE_NAMES,
} from '@daoyou/game-domain/inventory';
import { ELEMENT_VALUES, type ElementType } from '@daoyou/constants/elements';
import { QUALITY_VALUES } from '@daoyou/constants/qualities';
import { useState } from 'react';
import {
  defaultInventoryFilter,
  inventoryFilterActive,
  inventoryKinds,
  type InventoryFilter,
  type InventoryKind,
  type MaterialType,
} from './inventoryFilterModel';

export function InventoryFilters({
  value,
  onChange,
  kindDisabled = false,
  sort,
  onSortChange,
}: {
  value: InventoryFilter;
  onChange: (value: InventoryFilter) => void;
  kindDisabled?: boolean;
  sort?: InventorySort;
  onSortChange?: (sort: InventorySort | undefined) => void;
}) {
  const [open, setOpen] = useState(false);
  const [draft, setDraft] = useState<InventoryFilter>(value);
  const [draftSort, setDraftSort] = useState(sort);
  const min = draft.minRank ? QUALITY_VALUES.indexOf(draft.minRank) : 0;
  const max = draft.maxRank
    ? QUALITY_VALUES.indexOf(draft.maxRank)
    : QUALITY_VALUES.length - 1;
  function apply() {
    onChange(
      draft.kind === 'material'
        ? draft
        : { kind: kindDisabled ? value.kind : draft.kind },
    );
    onSortChange?.(draftSort);
    setOpen(false);
  }
  return (
    <>
      <InkButton
        onClick={() => {
          setDraft(value);
          setDraftSort(sort);
          setOpen(true);
        }}
      >
        筛选{inventoryFilterActive(value) || sort ? ' · 已启用' : ''}
      </InkButton>
      <InkModal
        isOpen={open}
        title="筛选物品"
        onClose={() => setOpen(false)}
        footer={
          <div className="flex justify-between gap-3">
            <InkButton
              onClick={() => {
                setDraft(
                  kindDisabled ? { kind: value.kind } : defaultInventoryFilter,
                );
                setDraftSort(undefined);
              }}
            >
              重置
            </InkButton>
            <div className="flex gap-3">
              <InkButton onClick={() => setOpen(false)}>取消</InkButton>
              <InkButton variant="primary" onClick={apply}>
                应用筛选
              </InkButton>
            </div>
          </div>
        }
      >
        <form
          className="space-y-5 text-sm"
          onSubmit={(event) => {
            event.preventDefault();
            apply();
          }}
        >
          <label className="block space-y-2">
            <span>物品类型</span>
            <select
              aria-label="物品类型"
              value={draft.kind}
              disabled={kindDisabled}
              onChange={(event) =>
                setDraft({ kind: event.target.value as InventoryKind })
              }
              className="border-ink/20 w-full border bg-transparent p-2"
            >
              {inventoryKinds.map(([kind, label]) => (
                <option key={kind} value={kind}>
                  {label}
                </option>
              ))}
            </select>
          </label>
          {onSortChange ? (
            <label className="block space-y-2">
              <span>排序方式</span>
              <select
                aria-label="排序方式"
                value={draftSort ?? ''}
                onChange={(event) =>
                  setDraftSort(
                    (event.target.value || undefined) as
                      InventorySort | undefined,
                  )
                }
                className="border-ink/20 w-full border bg-transparent p-2"
              >
                <option value="">默认顺序</option>
                <option value="updatedAt">获得时间 · 最新优先</option>
                <option value="quantity">堆叠数量 · 最多优先</option>
                <option value="kind">物品类型</option>
              </select>
            </label>
          ) : null}
          {draft.kind === 'material' ? (
            <>
              <fieldset className="space-y-2">
                <legend>品质范围</legend>
                <InkDiscreteRange
                  label="品质"
                  options={QUALITY_VALUES}
                  min={min}
                  max={max}
                  onChange={(nextMin, nextMax) =>
                    setDraft((current) => ({
                      ...current,
                      minRank: nextMin ? QUALITY_VALUES[nextMin] : undefined,
                      maxRank:
                        nextMax === QUALITY_VALUES.length - 1
                          ? undefined
                          : QUALITY_VALUES[nextMax],
                    }))
                  }
                />
              </fieldset>
              <label className="block space-y-2">
                <span>材料类型</span>
                <select
                  aria-label="材料类型"
                  value={draft.materialType ?? ''}
                  onChange={(event) =>
                    setDraft((current) => ({
                      ...current,
                      materialType: (event.target.value || undefined) as
                        MaterialType | undefined,
                    }))
                  }
                  className="border-ink/20 w-full border bg-transparent p-2"
                >
                  <option value="">全部材料</option>
                  {INVENTORY_MATERIAL_TYPES.map((type) => (
                    <option key={type} value={type}>
                      {MATERIAL_TYPE_NAMES[type]}
                    </option>
                  ))}
                </select>
              </label>
              <label className="block space-y-2">
                <span>五行属性</span>
                <select
                  aria-label="五行属性"
                  value={draft.element ?? ''}
                  onChange={(event) =>
                    setDraft((current) => ({
                      ...current,
                      element: (event.target.value || undefined) as
                        ElementType | undefined,
                    }))
                  }
                  className="border-ink/20 w-full border bg-transparent p-2"
                >
                  <option value="">全部属性</option>
                  {ELEMENT_VALUES.map((element) => (
                    <option key={element} value={element}>
                      {element}
                    </option>
                  ))}
                </select>
              </label>
            </>
          ) : null}
        </form>
      </InkModal>
    </>
  );
}
