import {
  combatV6Request,
  mutationBody,
} from '@app/components/feature/combat-v6/request';
import {
  getTalismanActionHref,
  getTalismanActionLabel,
  isAttributeResetTalisman,
  isQiRestoreTalisman,
  isSectMeridianResetTalisman,
} from '@app/components/feature/consumables';
import {
  matchesInventoryFilters,
  type InventoryKind,
} from '@app/components/feature/items/inventoryFilterModel';
import { InventoryFilters } from '@app/components/feature/items/InventoryFilters';
import { InventoryItems } from '@app/components/feature/items/InventoryItems';
import { GameSceneFrame } from '@app/components/game-shell/GameSceneFrame';
import { useInkUI } from '@app/components/providers/InkUIProvider';
import { InkButton } from '@app/components/ui/InkButton';
import { useInventoryBag } from '@app/lib/resources/bag';
import { consumeResourceMutation } from '@app/lib/resources/mutations';
import { useCultivatorIdentity } from '@app/lib/resources/player';
import type {
  InventoryAction,
  InventoryView,
} from '@shared/contracts/inventory';
import type {
  DaoEquipmentInstanceV1,
  DaoEquipmentSlot,
} from '@shared/engine/combat-v6/equipment/types';
import { combatCharacterLevel } from '@shared/engine/combat-v6/projection/character-level';
import { BAG_CAPACITY, itemDefinition } from '@shared/inventory';
import { ConsumableFactsSchema } from '@shared/items/definitions/consumables';
import { EQUIPMENT_SLOT_NAMES } from '@shared/items/definitions/equipment-blueprints';
import { useEffect, useRef, useState } from 'react';
import { useLocation, useNavigate, useSearchParams } from 'react-router';
import { EquipmentAction, EquipmentRack } from './EquipmentRack';

const endpoint = '/api/combat-v6/inventory';
type Item = InventoryView['items'][number];
type BagAction =
  | Exclude<InventoryAction, { action: 'learn' }>
  | { action: 'use'; id: string; revision: number };
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
  const [search, setSearch] = useState('');
  const [kind, setKind] = useState<InventoryKind>('all');
  const [selecting, setSelecting] = useState(false);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(() => new Set());
  const [storage, setData] = useState<InventoryView>();
  const bagQuery = useInventoryBag();
  const bag = bagQuery.data;
  const data = location === 'bag' ? bag : storage;
  const [readFailed, setReadFailed] = useState(false);
  const [slotFilter, setSlotFilter] = useState<DaoEquipmentSlot>();
  const { pushToast } = useInkUI();
  const [pending, setPending] = useState(false);
  const [refresh, setRefresh] = useState(0);
  const busy = useRef(false);
  const reader = useRef<AbortController | null>(null);
  const mounted = useRef(true);
  const remoteSearch = location === 'storage' ? search : '';
  const remoteKind = location === 'storage' ? kind : 'all';
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
      search: remoteSearch,
      kind: remoteKind,
    });
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
  }, [location, page, remoteSearch, remoteKind, refresh, pushToast]);
  async function act(action: BagAction) {
    if (busy.current) return;
    busy.current = true;
    setPending(true);
    reader.current?.abort();
    try {
      if (action.action === 'use') {
        await consumeResourceMutation(
          await fetch(
            '/api/cultivator/consume',
            mutationBody({
              consumableId: action.id,
              revision: action.revision,
            }),
          ),
        );
      } else
        await consumeResourceMutation(
          await fetch(endpoint, mutationBody(action)),
        );
      if (!mounted.current) return;
      pushToast({
        message:
          action.action === 'transfer_many'
            ? `已转移 ${action.items.length} 件物品`
            : action.action === 'equip'
              ? action.equipped
                ? '已穿戴道装'
                : '已卸下道装'
              : '已完成',
        tone: 'success',
      });
      setSelectedIds(new Set());
    } catch (e) {
      bagQuery.invalidate();
      if (mounted.current)
        pushToast({
          message: `${e instanceof Error ? e.message : '请求失败'}；请重新核对物品状态后操作。`,
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
  const filtered = !!search || kind !== 'all' || !!slotFilter;
  const equipped = bag?.equippedItems ?? [];
  const unavailable =
    pending || !data || bagQuery.isRefreshing || !!bagQuery.error;
  const visibleData = data ?? (location === 'bag' ? bag : undefined);
  function matches(item: Item) {
    return (
      matchesInventoryFilters(item, search, kind) &&
      (!slotFilter ||
        (itemDefinition(item.definitionId).kind === 'equipment' &&
          (item.instanceData as DaoEquipmentInstanceV1).slot === slotFilter))
    );
  }
  const visibleItems = visibleData
    ? location === 'bag' && filtered
      ? visibleData.items.filter(matches)
      : visibleData.items
    : [];
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
  return (
    <GameSceneFrame variant="workflow">
      <div className="grid min-w-0 gap-5 lg:grid-cols-2 lg:gap-6">
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
            setSearch('');
            setKind('equipment');
            setSlotFilter(slot);
            clearSelection();
          }}
        />
        <div className="space-y-2">
          <div className="flex items-center justify-between gap-3 text-sm">
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
          <div className="@container">
            <div className="flex min-w-0 items-center gap-2">
              <div className="flex min-w-0 flex-1 flex-wrap items-center gap-2">
                <InventoryFilters
                  search={search}
                  kind={kind}
                  onSearch={(value) => {
                    clearSelection();
                    setSearch(value);
                    setPage(0);
                    if (location === 'storage') setData(undefined);
                  }}
                  onKind={(value) => {
                    clearSelection();
                    setKind(value);
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
                      setKind('all');
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
                        {location === 'bag' ? '存入储藏室' : '取入背包'}
                      </span>
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
                  </>
                )}
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
            <InventoryItems
              items={visibleItems}
              location={location}
              compact={location === 'bag' && filtered}
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
                comparisonItem:
                  entry &&
                  !entry.equipped &&
                  itemDefinition(entry.definitionId).kind === 'equipment'
                    ? equipped.find(
                        (item) =>
                          (item.instanceData as DaoEquipmentInstanceV1).slot ===
                          (entry.instanceData as DaoEquipmentInstanceV1).slot,
                      )
                    : undefined,
                children:
                  entry && !selecting
                    ? (close) => (
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
                        />
                      )
                    : undefined,
              })}
            />
          )}
          <div className="flex justify-end gap-3">
            {location === 'bag' && !selecting ? (
              <InkButton
                disabled={unavailable || filtered}
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
          </div>
          {location === 'storage' && data?.total === 0 ? (
            <p className="text-ink-secondary text-sm">暂无物品</p>
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
  equipped,
  level,
}: {
  item: Item;
  pending: boolean;
  act: (action: BagAction) => Promise<void>;
  equipped: Item[];
  level?: number;
}) {
  const definition = itemDefinition(item.definitionId);
  const [quantity, setQuantity] = useState(1);
  const ref = { id: item.id, revision: item.revision };
  const navigate = useNavigate();
  const consumable =
    definition.kind === 'consumable'
      ? {
          ...ConsumableFactsSchema.parse(item.instanceData),
          id: item.id,
          quantity: item.quantity,
        }
      : undefined;
  const beastFood =
    consumable &&
    consumable.spec.kind !== 'talisman' &&
    consumable.spec.operations.some(
      (operation) => operation.type === 'gain_beast_cultivation',
    );
  const actionHref = beastFood
    ? '/game/beasts'
    : consumable && getTalismanActionHref(consumable);
  const directUse =
    !beastFood &&
    consumable &&
    (consumable.spec.kind !== 'talisman' ||
      isQiRestoreTalisman(consumable) ||
      isAttributeResetTalisman(consumable) ||
      isSectMeridianResetTalisman(consumable));
  return (
    <div className="space-y-4 text-sm">
      <div className="flex flex-wrap gap-3">
        {item.location === 'bag' && directUse ? (
          <InkButton
            disabled={pending}
            onClick={() => void act({ action: 'use', ...ref })}
          >
            使用
          </InkButton>
        ) : null}
        {item.location === 'bag' && consumable && actionHref && !directUse ? (
          <InkButton disabled={pending} onClick={() => navigate(actionHref)}>
            {beastFood
              ? '前往喂养灵兽'
              : (getTalismanActionLabel(consumable) ?? '前往使用')}
          </InkButton>
        ) : null}
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
          {item.location === 'bag' ? '存入储藏室' : '取入背包'}
        </InkButton>
      </div>
      {item.location === 'bag' && item.quantity > 1 ? (
        <div className="flex items-center gap-3">
          <input
            aria-label="拆分数量"
            type="number"
            min={1}
            max={item.quantity - 1}
            value={quantity}
            className="border-ink/20 w-20 border bg-transparent p-2"
            onChange={(e) => setQuantity(Number(e.target.value))}
          />
          <InkButton
            disabled={
              pending ||
              !Number.isInteger(quantity) ||
              quantity < 1 ||
              quantity >= item.quantity
            }
            onClick={() => void act({ action: 'split', ...ref, quantity })}
          >
            拆分到空格
          </InkButton>
        </div>
      ) : null}
    </div>
  );
}
