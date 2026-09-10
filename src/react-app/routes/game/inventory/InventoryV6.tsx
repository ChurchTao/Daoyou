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
import { InventoryItems } from '@app/components/feature/items/InventoryItems';
import { GameSceneFrame } from '@app/components/game-shell/GameSceneFrame';
import { useInkUI } from '@app/components/providers/InkUIProvider';
import { InkButton } from '@app/components/ui/InkButton';
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
  const [kind, setKind] = useState('all');
  const [data, setData] = useState<InventoryView>();
  const [bag, setBag] = useState<InventoryView>();
  const [readFailed, setReadFailed] = useState(false);
  const [slotFilter, setSlotFilter] = useState<DaoEquipmentSlot>();
  const [moving, setMoving] = useState<Item>();
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
    const controller = new AbortController();
    reader.current = controller;
    const query = new URLSearchParams({
      location,
      page: String(page),
      search: remoteSearch,
      kind: remoteKind,
    });
    const bagRead = combatV6Request<InventoryView>(`${endpoint}?location=bag`, {
      signal: controller.signal,
    });
    void Promise.all([
      bagRead,
      location === 'bag'
        ? bagRead
        : combatV6Request<InventoryView>(`${endpoint}?${query}`, {
            signal: controller.signal,
          }),
    ])
      .then(([bagView, view]) => {
        if (!controller.signal.aborted) {
          setBag(bagView);
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
      } else await combatV6Request(endpoint, mutationBody(action));
      if (!mounted.current) return;
      setMoving(undefined);
      pushToast({
        message:
          action.action === 'equip'
            ? action.equipped
              ? '已穿戴道装'
              : '已卸下道装'
            : '已完成',
        tone: 'success',
      });
    } catch (e) {
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
  const equipped = bag?.items.filter((item) => item.equipped) ?? [];
  const unavailable = pending || !data;
  const visibleData = data ?? (location === 'bag' ? bag : undefined);
  function matches(item: Item) {
    return (
      item.name.toLocaleLowerCase().includes(search.toLocaleLowerCase()) &&
      (kind === 'all' || itemDefinition(item.definitionId).kind === kind) &&
      (!slotFilter ||
        (itemDefinition(item.definitionId).kind === 'equipment' &&
          (item.instanceData as DaoEquipmentInstanceV1).slot === slotFilter))
    );
  }
  function choose(entry: Item | undefined, slot: number) {
    if (unavailable) return;
    if (moving) {
      void act({
        action: 'move',
        id: moving.id,
        revision: moving.revision,
        slot,
        targetId: entry?.id ?? null,
        targetRevision: entry?.revision ?? null,
      });
      return;
    }
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
            setMoving(undefined);
          }}
        />
        <div className="space-y-4">
          <div className="flex items-center gap-3 text-sm">
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
                  setParams({ location: value });
                  setPage(0);
                  setData(undefined);
                  setMoving(undefined);
                  setSlotFilter(undefined);
                }}
              >
                {value === 'bag' ? '随身物品' : '洞府储藏室'}
              </button>
            ))}
            <span className="text-ink-secondary ml-auto font-mono text-xs whitespace-nowrap">
              {location === 'bag'
                ? `${visibleData?.used ?? '—'} / ${BAG_CAPACITY}`
                : `${data?.total ?? '—'} 件`}
            </span>
          </div>
          <div className="flex flex-wrap gap-2">
            <input
              aria-label="搜索物品"
              placeholder="搜索物品"
              value={search}
              className="border-ink/20 min-w-0 flex-1 border-b bg-transparent p-2 text-sm"
              onChange={(e) => {
                setSearch(e.target.value);
                setPage(0);
                if (location === 'storage') setData(undefined);
                setMoving(undefined);
              }}
            />
            <select
              aria-label="物品分类"
              value={kind}
              className="bg-transparent text-sm"
              onChange={(e) => {
                setKind(e.target.value);
                setPage(0);
                if (location === 'storage') setData(undefined);
                setMoving(undefined);
                setSlotFilter(undefined);
              }}
            >
              <option value="all">全部</option>
              <option value="beast_book">兽诀</option>
              <option value="manual_jade">功法玉简</option>
              <option value="equipment">道装</option>
              <option value="blueprint">图纸</option>
              <option value="material">材料</option>
              <option value="seed">灵种</option>
              <option value="consumable">丹药与消耗品</option>
            </select>
            {slotFilter ? (
              <InkButton
                onClick={() => {
                  setSlotFilter(undefined);
                  setKind('all');
                }}
              >
                {EQUIPMENT_SLOT_NAMES[slotFilter]} ×
              </InkButton>
            ) : null}
          </div>
          {moving ? (
            <InkButton disabled={pending} onClick={() => setMoving(undefined)}>
              取消移动
            </InkButton>
          ) : null}
          {!visibleData ? (
            readFailed ? null : (
              <p className="text-ink-secondary text-sm">正在查看物品……</p>
            )
          ) : (
            <InventoryItems
              items={visibleData.items}
              location={location}
              className="grid-cols-5 gap-1.5 sm:grid-cols-5"
              slotProps={(entry, slot) => ({
                disabled: unavailable || (filtered && !entry),
                className:
                  entry && location === 'bag' && !matches(entry)
                    ? 'opacity-30'
                    : undefined,
                badge: entry?.equipped ? '穿' : undefined,
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
                selected: !!entry && moving?.id === entry.id,
                onQuickAction: moving ? () => choose(entry, slot) : undefined,
                quickOnTouch: !!moving,
                children: entry
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
                        move={() => {
                          setMoving(entry);
                          pushToast({
                            message:
                              '选择目标格位，同类合并，其他物品交换位置。',
                          });
                          close();
                          setSearch('');
                          setKind('all');
                          setSlotFilter(undefined);
                        }}
                      />
                    )
                  : undefined,
              })}
            />
          )}
          <div className="flex justify-end gap-3">
            <InkButton
              disabled={pending}
              onClick={() => {
                setData(undefined);
                setRefresh((value) => value + 1);
              }}
            >
              刷新
            </InkButton>
            {location === 'bag' ? (
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
  move,
  equipped,
  level,
}: {
  item: Item;
  pending: boolean;
  act: (action: BagAction) => Promise<void>;
  move: () => void;
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
  const actionHref = consumable && getTalismanActionHref(consumable);
  const directUse =
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
            {getTalismanActionLabel(consumable) ?? '前往使用'}
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
        {item.location === 'bag' ? (
          <InkButton disabled={pending} onClick={move}>
            移动／合并
          </InkButton>
        ) : null}
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
