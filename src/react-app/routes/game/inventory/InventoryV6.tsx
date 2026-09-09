import {
  combatV6Request,
  mutationBody,
} from '@app/components/feature/combat-v6/request';
import { InventoryItems } from '@app/components/feature/items/InventoryItems';
import { GameSceneFrame } from '@app/components/game-shell/GameSceneFrame';
import { useInkUI } from '@app/components/providers/InkUIProvider';
import { InkButton } from '@app/components/ui/InkButton';
import type {
  InventoryAction,
  InventoryView,
} from '@shared/contracts/inventory';
import { BAG_CAPACITY, itemDefinition } from '@shared/inventory';
import { useEffect, useRef, useState } from 'react';
import { useLocation, useSearchParams } from 'react-router';

const endpoint = '/api/combat-v6/inventory';
type Item = InventoryView['items'][number];
type BagAction = Exclude<InventoryAction, { action: 'learn' }>;
export default function InventoryV6() {
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
  const [moving, setMoving] = useState<Item>();
  const { pushToast } = useInkUI();
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
    const controller = new AbortController();
    reader.current = controller;
    const query = new URLSearchParams({
      location,
      page: String(page),
      search,
      kind,
    });
    void combatV6Request<InventoryView>(`${endpoint}?${query}`, {
      signal: controller.signal,
    })
      .then((view) => {
        if (!controller.signal.aborted) {
          setData(view);
          setPage(view.page);
        }
      })
      .catch((e) => {
        if (!controller.signal.aborted)
          pushToast({
            message: e.message,
            tone: 'danger',
            actionLabel: '重新读取',
            onAction: () => setRefresh((v) => v + 1),
          });
      });
    return () => controller.abort();
  }, [location, page, search, kind, refresh, pushToast]);
  async function act(action: BagAction) {
    if (busy.current) return;
    busy.current = true;
    setPending(true);
    reader.current?.abort();
    try {
      await combatV6Request(endpoint, mutationBody(action));
      if (!mounted.current) return;
      setMoving(undefined);
      pushToast({ message: '已完成', tone: 'success' });
    } catch (e) {
      if (mounted.current)
        pushToast({
          message: `${e instanceof Error ? e.message : '请求失败'}；请重新核对物品状态后操作。`,
          tone: 'danger',
        });
    } finally {
      busy.current = false;
      if (mounted.current) {
        setPending(false);
        setRefresh((v) => v + 1);
      }
    }
  }
  const filtered = !!search || kind !== 'all';
  function choose(entry: Item | undefined, slot: number) {
    if (pending) return;
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
              }}
            >
              {value === 'bag' ? '随身物品' : '洞府储藏室'}
            </button>
          ))}
          <span className="text-ink-secondary ml-auto">
            {data?.used ?? '—'} / {BAG_CAPACITY} 格
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
              setData(undefined);
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
              setData(undefined);
              setMoving(undefined);
            }}
          >
            <option value="all">全部</option>
            <option value="beast_book">兽诀</option>
            <option value="manual_jade">功法玉简</option>
            <option value="equipment">道装</option>
            <option value="blueprint">图纸</option>
            <option value="material">材料</option>
          </select>
          <InkButton
            disabled={pending}
            onClick={() => setRefresh((value) => value + 1)}
          >
            刷新
          </InkButton>
          {location === 'bag' ? (
            <InkButton
              disabled={pending || !data || filtered}
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
        {moving ? (
          <InkButton disabled={pending} onClick={() => setMoving(undefined)}>
            取消移动
          </InkButton>
        ) : null}
        {!data ? (
          <p className="text-ink-secondary text-sm">正在查看物品……</p>
        ) : (
          <InventoryItems
            items={data.items}
            location={location}
            slotProps={(entry, slot) => ({
              disabled: pending || (filtered && !entry),
              selected: !!entry && moving?.id === entry.id,
              onQuickAction: moving ? () => choose(entry, slot) : undefined,
              quickOnTouch: !!moving,
              children: entry
                ? (close) => (
                    <ItemActions
                      key={`${entry.id}:${entry.revision}`}
                      item={entry}
                      pending={pending}
                      act={async (action) => {
                        await act(action);
                        close();
                      }}
                      move={() => {
                        setMoving(entry);
                        pushToast({
                          message: '选择目标格位，同类合并，其他物品交换位置。',
                        });
                        close();
                        setSearch('');
                        setKind('all');
                      }}
                    />
                  )
                : undefined,
            })}
          />
        )}
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
    </GameSceneFrame>
  );
}

function ItemActions({
  item,
  pending,
  act,
  move,
}: {
  item: Item;
  pending: boolean;
  act: (action: BagAction) => Promise<void>;
  move: () => void;
}) {
  const definition = itemDefinition(item.definitionId);
  const [quantity, setQuantity] = useState(1);
  const ref = { id: item.id, revision: item.revision };
  return (
    <div className="space-y-4 text-sm">
      <div className="flex flex-wrap gap-3">
        {item.location === 'bag' && definition.kind === 'equipment' ? (
          <InkButton
            pending={pending}
            onClick={() =>
              void act({
                action: 'equip',
                ...ref,
                equipped: !item.equipped,
              })
            }
          >
            {item.equipped ? '卸下' : '装备'}
          </InkButton>
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
