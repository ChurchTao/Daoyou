import {
  combatV6Request,
  mutationBody,
} from '@app/components/feature/combat-v6/request';
import { ConsumableUseActions } from '@app/components/feature/items/ConsumableUseActions';
import { consumeInventoryItem } from '@app/components/feature/items/consumeInventoryItem';
import {
  defaultInventoryFilter,
  inventoryFilterActive,
  matchesInventoryFilters,
  type InventoryFilter,
} from '@app/components/feature/items/inventoryFilterModel';
import { InventoryFilters } from '@app/components/feature/items/InventoryFilters';
import { BagInventoryItems } from '@app/components/feature/items/InventoryItems';
import { GameSceneFrame } from '@app/components/game-shell/GameSceneFrame';
import { useInkUI } from '@app/components/providers/InkUIProvider';
import { InkButton } from '@app/components/ui/InkButton';
import { apiFetch } from '@app/lib/api/fetch';
import { useInventoryBag } from '@app/lib/resources/bag';
import { consumeResourceMutation } from '@app/lib/resources/mutations';
import { useCultivatorIdentity } from '@app/lib/resources/player';
import type {
  InventoryAction,
  InventoryView,
} from '@daoyou/contracts/inventory';
import type {
  DaoEquipmentInstanceV1,
  DaoEquipmentSlot,
} from '@daoyou/game-domain/equipment';
import { EQUIPMENT_SLOT_NAMES } from '@daoyou/game-domain/equipment';
import {
  BAG_CAPACITY,
  type InventorySort,
} from '@daoyou/game-domain/inventory';
import { getRealmStageLevel as combatCharacterLevel } from '@daoyou/game-domain/progression';
import {
  itemDefinition,
  sortInventoryItems,
} from '@daoyou/game-rules/inventory';
import { useEffect, useRef, useState } from 'react';
import { useLocation, useSearchParams } from 'react-router';
import { EquipmentComparisonPreview } from './EquipmentComparisonPreview';
import { EquipmentAction, EquipmentRack } from './EquipmentRack';

const endpoint = '/api/combat-v6/inventory';
type Item = InventoryView['items'][number];
type BagAction =
  | Exclude<InventoryAction, { action: 'learn' }>
  | { action: 'use'; id: string; revision: number; quantity?: number };

function inventoryActionMessage(action: BagAction) {
  if (action.action === 'discard_many')
    return `已丢弃 ${action.items.length} 件物品。`;
  if (action.action === 'discard') return '物品已丢弃。';
  if (action.action === 'transfer_many')
    return `已将 ${action.items.length} 件物品${action.location === 'bag' ? '取入储物袋' : '存入洞府储藏室'}。`;
  if (action.action === 'equip')
    return action.equipped ? '已穿戴道装。' : '已卸下道装。';
  if (action.action === 'transfer')
    return action.location === 'bag'
      ? '物品已取入储物袋。'
      : '物品已存入洞府储藏室。';
  if (action.action === 'sort') return '已整理随身物品。';
  if (action.action === 'use') return '物品已使用。';
  return '物品已更新。';
}
export default function InventoryV6() {
  const identity = useCultivatorIdentity();
  const character = identity.data?.cultivator;
  const level = character
    ? combatCharacterLevel(character.realm, character.realm_stage)
    : undefined;
  const [params, setParams] = useSearchParams();
  const route = useLocation();
  const location =
    params.get('location') === 'bag'
      ? 'bag'
      : params.get('location') === 'storage' ||
          route.pathname === '/game/cave/storage/new'
        ? 'storage'
        : 'bag';
  const [page, setPage] = useState(0);
  const [filter, setFilter] = useState<InventoryFilter>(defaultInventoryFilter);
  const [sort, setSort] = useState<InventorySort>();
  const [selecting, setSelecting] = useState(false);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(() => new Set());
  const [storage, setData] = useState<InventoryView>();
  const bagQuery = useInventoryBag();
  const bag = bagQuery.data;
  const data = location === 'bag' ? bag : storage;
  const [readFailed, setReadFailed] = useState(false);
  const [slotFilter, setSlotFilter] = useState<DaoEquipmentSlot>();
  const { pushToast, openDialog } = useInkUI();
  const [pending, setPending] = useState(false);
  const [refresh, setRefresh] = useState(0);
  const busy = useRef(false);
  const reader = useRef<AbortController | null>(null);
  const mounted = useRef(true);
  useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
      reader.current?.abort();
    };
  }, []);
  useEffect(() => {
    if (location === 'bag') return;
    const controller = new AbortController();
    reader.current = controller;
    const query = new URLSearchParams({
      location,
      page: String(page),
      kind: filter.kind,
    });
    if (sort) query.set('sort', sort);
    if (filter.kind === 'material') {
      if (filter.minRank) query.set('minRank', filter.minRank);
      if (filter.maxRank) query.set('maxRank', filter.maxRank);
      if (filter.materialType) query.set('materialType', filter.materialType);
      if (filter.element) query.set('element', filter.element);
    }
    void combatV6Request<InventoryView>(`${endpoint}?${query}`, {
      signal: controller.signal,
    })
      .then((view) => {
        if (!controller.signal.aborted) {
          setReadFailed(false);
          setData(view);
          setPage(view.page);
        }
      })
      .catch((e) => {
        if (!controller.signal.aborted) {
          setReadFailed(true);
          pushToast({
            message: e.message,
            tone: 'danger',
            actionLabel: '重新读取',
            onAction: () => setRefresh((v) => v + 1),
          });
        }
      });
    return () => controller.abort();
  }, [location, page, filter, sort, refresh, pushToast]);
  async function act(action: BagAction) {
    if (busy.current) return;
    busy.current = true;
    setPending(true);
    reader.current?.abort();
    try {
      if (action.action === 'use') {
        await consumeInventoryItem(action, action.quantity);
      } else
        await consumeResourceMutation(
          await apiFetch(endpoint, mutationBody(action)),
        );
      if (!mounted.current) return;
      pushToast({
        message: inventoryActionMessage(action),
        tone: 'success',
      });
      setSelectedIds(new Set());
    } catch (e) {
      bagQuery.invalidate();
      if (mounted.current)
        pushToast({
          message: `${e instanceof Error ? e.message : '操作未完成'}；请重新核对物品状态后操作。`,
          tone: 'danger',
        });
    } finally {
      busy.current = false;
      if (mounted.current) {
        setData(undefined);
        setPending(false);
        setRefresh((v) => v + 1);
      }
    }
  }
  const filtered = inventoryFilterActive(filter) || !!slotFilter;
  const equipped = bag?.equippedItems ?? [];
  const unavailable =
    pending || !data || bagQuery.isRefreshing || !!bagQuery.error;
  const visibleData = data ?? (location === 'bag' ? bag : undefined);
  function matches(item: Item) {
    return (
      matchesInventoryFilters(item, filter) &&
      (!slotFilter ||
        (itemDefinition(item.definitionId).kind === 'equipment' &&
          (item.instanceData as DaoEquipmentInstanceV1).slot === slotFilter))
    );
  }
  const filteredItems = visibleData
    ? location === 'bag' && filtered
      ? visibleData.items.filter(matches)
      : visibleData.items
    : [];
  const visibleItems =
    location === 'bag' && sort
      ? sortInventoryItems(filteredItems, sort)
      : filteredItems;
  const selectedItems = visibleItems.filter((item) => selectedIds.has(item.id));
  function clearSelection() {
    setSelectedIds(new Set());
  }
  function toggleSelection(id: string) {
    setSelectedIds((current) => {
      const next = new Set(current);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }
  function confirmDiscard(items: Item[]) {
    if (!items.length || pending) return;
    const only = items.length === 1 ? items[0] : undefined;
    openDialog({
      title: '丢弃物品',
      content: only ? (
        <p>
          丢弃「{only.name}」
          {only.quantity > 1 ? (
            <>
              {' '}
              <span className="font-mono font-semibold tracking-tight">
                ×{only.quantity}
              </span>
            </>
          ) : null}
          ？丢弃后无法找回。
        </p>
      ) : (
        <p>
          丢弃已选的{' '}
          <span className="font-mono font-semibold tracking-tight">
            {items.length}
          </span>{' '}
          件物品？丢弃后无法找回。
        </p>
      ),
      confirmLabel: '丢弃',
      cancelLabel: '留下',
      onConfirm: () =>
        only
          ? act({ action: 'discard', id: only.id, revision: only.revision })
          : act({
              action: 'discard_many',
              items: items.map(({ id, revision }) => ({ id, revision })),
            }),
    });
  }
  function renderActions(entry: Item, close: () => void) {
    return (
      <ItemActions
        key={`${entry.id}:${entry.revision}`}
        item={entry}
        pending={unavailable}
        equipped={equipped}
        level={level}
        act={async (action) => {
          await act(action);
          close();
        }}
        onDiscard={() => {
          close();
          confirmDiscard([entry]);
        }}
      />
    );
  }
  return (
    <GameSceneFrame variant="workflow">
      <div className="grid min-w-0 gap-5 lg:grid-cols-[minmax(0,5fr)_minmax(0,9fr)] lg:gap-6">
        <EquipmentRack
          items={equipped}
          gender={character?.gender}
          level={level}
          pending={unavailable}
          onUnequip={(item) =>
            act({
              action: 'equip',
              id: item.id,
              revision: item.revision,
              equipped: false,
            })
          }
          onSlot={(slot) => {
            if (location !== 'bag') {
              setParams({ location: 'bag' });
              setData(undefined);
            }
            setPage(0);
            setFilter({ kind: 'equipment' });
            setSlotFilter(slot);
            clearSelection();
          }}
        />
        <div data-guide="inventory.items" className="space-y-2">
          <div
            data-guide="inventory.bag"
            className="space-y-2 lg:flex lg:items-center lg:gap-3 lg:space-y-0"
          >
            <div className="flex items-center justify-between gap-3 text-sm lg:shrink-0">
              <div className="flex min-w-0 items-center gap-4 whitespace-nowrap">
                {(['bag', 'storage'] as const).map((value) => (
                  <button
                    key={value}
                    disabled={pending}
                    aria-pressed={location === value}
                    className={
                      location === value
                        ? 'text-ink font-semibold underline underline-offset-4'
                        : 'text-ink-secondary'
                    }
                    onClick={() => {
                      clearSelection();
                      setParams({ location: value });
                      setPage(0);
                      setData(undefined);
                      setSlotFilter(undefined);
                    }}
                  >
                    {value === 'bag' ? '随身物品' : '洞府储藏室'}
                  </button>
                ))}
              </div>
              {selecting ? (
                <div className="flex shrink-0 items-center gap-1 whitespace-nowrap">
                  <span
                    className="text-ink-secondary font-mono text-xs"
                    aria-live="polite"
                  >
                    已选 {selectedItems.length}
                  </span>
                  <InkButton
                    onClick={() => {
                      clearSelection();
                      setSelecting(false);
                    }}
                  >
                    完成
                  </InkButton>
                </div>
              ) : (
                <span
                  className="text-ink-secondary shrink-0 font-mono text-xs whitespace-nowrap"
                  aria-live="polite"
                >
                  {location === 'bag'
                    ? `${visibleData?.used ?? '—'} / ${BAG_CAPACITY} 格`
                    : `${data?.total ?? '—'} 件`}
                </span>
              )}
            </div>
            <div className="@container min-w-0 lg:flex-1">
              <div className="flex min-w-0 items-center gap-2">
                <div className="flex min-w-0 flex-1 flex-wrap items-center gap-2">
                  <InventoryFilters
                    value={filter}
                    sort={sort}
                    onSortChange={setSort}
                    onChange={(value) => {
                      clearSelection();
                      setFilter(value);
                      setPage(0);
                      if (location === 'storage') setData(undefined);
                      setSlotFilter(undefined);
                    }}
                  />
                  {slotFilter ? (
                    <InkButton
                      onClick={() => {
                        clearSelection();
                        setSlotFilter(undefined);
                        setFilter(defaultInventoryFilter);
                      }}
                    >
                      {EQUIPMENT_SLOT_NAMES[slotFilter]} ×
                    </InkButton>
                  ) : null}
                </div>
                <div className="flex shrink-0 items-center justify-end gap-1">
                  {selecting ? (
                    <>
                      <InkButton
                        disabled={unavailable || !visibleItems.length}
                        onClick={() =>
                          setSelectedIds(
                            selectedItems.length === visibleItems.length
                              ? new Set()
                              : new Set(visibleItems.map((item) => item.id)),
                          )
                        }
                      >
                        <span className="@min-[30rem]:hidden">
                          {selectedItems.length === visibleItems.length &&
                          visibleItems.length
                            ? '清空'
                            : '全选'}
                        </span>
                        <span className="hidden @min-[30rem]:inline">
                          {selectedItems.length === visibleItems.length &&
                          visibleItems.length
                            ? '取消全选'
                            : '全选本页'}
                        </span>
                      </InkButton>
                      <InkButton
                        disabled={unavailable || !selectedItems.length}
                        onClick={() =>
                          void act({
                            action: 'transfer_many',
                            items: selectedItems.map(({ id, revision }) => ({
                              id,
                              revision,
                            })),
                            location: location === 'bag' ? 'storage' : 'bag',
                          })
                        }
                      >
                        <span className="@min-[30rem]:hidden">
                          {location === 'bag' ? '存入' : '取出'}
                        </span>
                        <span className="hidden @min-[30rem]:inline">
                          {location === 'bag' ? '存入洞府储藏室' : '取入储物袋'}
                        </span>
                      </InkButton>
                      <InkButton
                        disabled={unavailable || !selectedItems.length}
                        onClick={() => confirmDiscard(selectedItems)}
                      >
                        丢弃
                      </InkButton>
                    </>
                  ) : (
                    <>
                      <InkButton
                        disabled={unavailable}
                        onClick={() => {
                          clearSelection();
                          setSelecting(true);
                        }}
                      >
                        多选
                      </InkButton>
                      <InkButton
                        disabled={pending}
                        onClick={() => {
                          clearSelection();
                          void bagQuery.reload();
                          setData(undefined);
                          setRefresh((value) => value + 1);
                        }}
                      >
                        刷新
                      </InkButton>
                      {location === 'bag' ? (
                        <InkButton
                          disabled={unavailable || filtered || !!sort}
                          onClick={() =>
                            void act({
                              action: 'sort',
                              items: data!.items.map(({ id, revision }) => ({
                                id,
                                revision,
                              })),
                            })
                          }
                        >
                          整理
                        </InkButton>
                      ) : null}
                    </>
                  )}
                </div>
              </div>
            </div>
          </div>
          {bagQuery.error ? (
            <p role="alert" className="text-crimson text-sm">
              {bagQuery.error}
            </p>
          ) : null}
          {!visibleData ? (
            readFailed ? null : (
              <p className="text-ink-secondary text-sm">正在查看物品……</p>
            )
          ) : (
            <BagInventoryItems
              items={visibleItems}
              location={location}
              compact={location === 'bag' && (filtered || !!sort)}
              quickTouchHint={selecting}
              slotProps={(entry) => ({
                disabled: unavailable || (filtered && !entry),
                selected: !!entry && selectedIds.has(entry.id),
                badge:
                  entry && selectedIds.has(entry.id)
                    ? '已选'
                    : entry?.equipped
                      ? '穿'
                      : undefined,
                onQuickAction:
                  selecting && entry
                    ? () => toggleSelection(entry.id)
                    : undefined,
                quickOnTouch: selecting,
                renderItemPreview:
                  entry &&
                  !selecting &&
                  location === 'bag' &&
                  !entry.equipped &&
                  itemDefinition(entry.definitionId).kind === 'equipment'
                    ? (close) => (
                        <EquipmentComparisonPreview
                          key={`${character?.id}:${entry.id}:${entry.revision}`}
                          item={entry}
                          equipped={equipped}
                          level={level}
                          pending={unavailable}
                          close={close}
                          actions={renderActions(entry, close)}
                        />
                      )
                    : undefined,
                children:
                  entry && !selecting
                    ? (close) => renderActions(entry, close)
                    : undefined,
              })}
            />
          )}
          {visibleData &&
          visibleItems.length === 0 &&
          (location === 'storage' || filtered || !!sort) ? (
            <p className="text-ink-secondary text-sm">
              {filtered ? '暂无符合筛选条件的物品' : '暂无物品'}
            </p>
          ) : null}
          {location === 'storage' && data ? (
            <div className="flex items-center justify-between text-sm">
              <InkButton
                disabled={!data.page || pending}
                onClick={() => {
                  clearSelection();
                  setPage(data.page - 1);
                  setData(undefined);
                }}
              >
                上一页
              </InkButton>
              <span>
                {data.page + 1} / {Math.max(1, Math.ceil(data.total / 40))}
              </span>
              <InkButton
                disabled={(data.page + 1) * 40 >= data.total || pending}
                onClick={() => {
                  clearSelection();
                  setPage(data.page + 1);
                  setData(undefined);
                }}
              >
                下一页
              </InkButton>
            </div>
          ) : null}
        </div>
      </div>
    </GameSceneFrame>
  );
}

function ItemActions({
  item,
  pending,
  act,
  onDiscard,
  equipped,
  level,
}: {
  item: Item;
  pending: boolean;
  act: (action: BagAction) => Promise<void>;
  onDiscard: () => void;
  equipped: Item[];
  level?: number;
}) {
  const definition = itemDefinition(item.definitionId);
  const ref = { id: item.id, revision: item.revision };
  return (
    <div className="flex flex-wrap items-center gap-x-1 gap-y-1 text-sm">
      <ConsumableUseActions
        item={item}
        pending={pending}
        onUse={(quantity) => void act({ action: 'use', ...ref, quantity })}
      />
      {item.location === 'bag' && definition.kind === 'equipment' ? (
        <EquipmentAction
          item={item}
          equipped={equipped}
          level={level}
          pending={pending}
          onEquip={() =>
            void act({
              action: 'equip',
              ...ref,
              equipped: !item.equipped,
            })
          }
        />
      ) : null}
      <InkButton
        disabled={pending || item.equipped}
        onClick={() =>
          void act({
            action: 'transfer',
            ...ref,
            location: item.location === 'bag' ? 'storage' : 'bag',
          })
        }
      >
        {item.location === 'bag' ? '存入' : '取出'}
      </InkButton>
      <InkButton disabled={pending || item.equipped} onClick={onDiscard}>
        丢弃
      </InkButton>
    </div>
  );
}
