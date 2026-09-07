import {
  combatV6Request,
  mutationBody,
} from '@app/components/feature/combat-v6/request';
import { EquipmentDetails } from '@app/components/feature/forging/EquipmentDetails';
import { GameSceneFrame } from '@app/components/game-shell/GameSceneFrame';
import { InkButton } from '@app/components/ui/InkButton';
import { InkDetailDrawer } from '@app/components/ui/InkDetailDrawer';
import { InkTooltip } from '@app/components/ui/InkTooltip';
import { combatV6SkillDetails } from '@shared/combat-v6/skill-details';
import type { BeastManagementView } from '@shared/contracts/combatV6Beasts';
import type {
  InventoryAction,
  InventoryView,
} from '@shared/contracts/inventory';
import {
  BEAST_SKILLS,
  activeBeastSkills,
} from '@shared/engine/combat-v6/beasts';
import { BAG_CAPACITY, itemDefinition } from '@shared/inventory';
import {
  MATERIAL_TYPE_NAMES,
  MaterialFactsSchema,
} from '@shared/items/definitions/materials';
import { materialFactsOf } from '@shared/items/material';
import { useEffect, useRef, useState } from 'react';
import { Link, useLocation, useSearchParams } from 'react-router';

const endpoint = '/api/combat-v6/inventory';
const details = combatV6SkillDetails(BEAST_SKILLS, []);
const skillName = (id: string) =>
  BEAST_SKILLS.find((s) => s.id === id)?.name ?? id;
type Item = InventoryView['items'][number];
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
  const [selected, setSelected] = useState<string>();
  const [moving, setMoving] = useState<Item>();
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
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
        if (!controller.signal.aborted) setError(e.message);
      });
    return () => controller.abort();
  }, [location, page, search, kind, refresh]);
  async function act(action: InventoryAction) {
    if (busy.current) return;
    busy.current = true;
    setPending(true);
    setError('');
    setNotice('');
    reader.current?.abort();
    try {
      const result = await combatV6Request<{
        oldSkill?: string;
        newSkill?: string;
      }>(endpoint, mutationBody(action));
      if (!mounted.current) return;
      setSelected(undefined);
      setMoving(undefined);
      setNotice(
        result.newSkill
          ? `${skillName(result.oldSkill!)} → ${skillName(result.newSkill)}`
          : '已完成',
      );
    } catch (e) {
      if (mounted.current)
        setError(
          `${e instanceof Error ? e.message : '请求失败'}；请重新核对物品状态后操作。`,
        );
    } finally {
      busy.current = false;
      if (mounted.current) {
        setPending(false);
        setRefresh((v) => v + 1);
      }
    }
  }
  const item = data?.items.find((i) => i.id === selected);
  const slots = new Map(data?.items.map((i) => [i.slotIndex, i]));
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
    setSelected(entry?.id);
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
                setSelected(undefined);
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
            <option value="equipment">道装</option>
            <option value="blueprint">图纸</option>
            <option value="material">材料</option>
          </select>
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
        {error ? (
          <p role="alert" className="text-crimson text-sm">
            {error}
            <button
              disabled={pending}
              className="ml-2 underline"
              onClick={() => {
                setError('');
                setRefresh((v) => v + 1);
              }}
            >
              重新读取
            </button>
          </p>
        ) : null}
        {notice ? (
          <p role="status" className="text-sm">
            {notice}
          </p>
        ) : null}
        {moving ? (
          <p className="text-sm">
            选择目标格位，同类合并，其他物品交换位置。
            <button
              className="ml-2 underline"
              onClick={() => setMoving(undefined)}
            >
              取消移动
            </button>
          </p>
        ) : null}
        {!data ? (
          <p className="text-ink-secondary text-sm">正在查看物品……</p>
        ) : (
          <div className="grid grid-cols-4 gap-2 sm:grid-cols-8">
            {(location === 'bag'
              ? Array.from({ length: BAG_CAPACITY }, (_, slot) => ({
                  entry: slots.get(slot),
                  slot,
                }))
              : data.items.map((entry, slot) => ({ entry, slot }))
            ).map(({ entry, slot }) => (
              <button
                key={location === 'bag' ? slot : entry!.id}
                disabled={
                  pending || (!entry && !moving) || (filtered && !entry)
                }
                aria-label={
                  entry
                    ? `${entry.name}，${entry.quantity}件${entry.equipped ? '，已装备' : ''}`
                    : `空格 ${slot + 1}`
                }
                onClick={() => choose(entry, slot)}
                className={`border-ink/15 relative flex min-h-20 min-w-0 flex-col items-center justify-center gap-1 rounded border p-1 text-xs ${moving?.id === entry?.id && moving ? 'ring-ink ring-1' : 'hover:bg-ink/5'}`}
              >
                {entry ? (
                  <>
                    <span aria-hidden className="text-ink-secondary text-lg">
                      {itemDefinition(entry.definitionId).kind === 'equipment'
                        ? '◇'
                        : itemDefinition(entry.definitionId).kind === 'material'
                          ? '◆'
                          : '卷'}
                    </span>
                    <span className="line-clamp-2 break-all">{entry.name}</span>
                    <span className="text-ink-secondary">
                      {entry.equipped ? '已装备' : `×${entry.quantity}`}
                    </span>
                  </>
                ) : (
                  <span aria-hidden className="text-ink/15">
                    ·
                  </span>
                )}
              </button>
            ))}
          </div>
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
        {item ? (
          <ItemDrawer
            key={`${item.id}:${item.revision}`}
            item={item}
            initialBeastId={params.get('beastId')}
            pending={pending}
            error={error}
            close={() => {
              if (!pending) setSelected(undefined);
            }}
            act={act}
            move={() => {
              setMoving(item);
              setSelected(undefined);
              setSearch('');
              setKind('all');
            }}
          />
        ) : null}
      </div>
    </GameSceneFrame>
  );
}

function ItemDrawer({
  item,
  initialBeastId,
  pending,
  error,
  close,
  act,
  move,
}: {
  item: Item;
  initialBeastId: string | null;
  pending: boolean;
  error: string;
  close: () => void;
  act: (action: InventoryAction) => Promise<void>;
  move: () => void;
}) {
  const definition = itemDefinition(item.definitionId);
  const [learning, setLearning] = useState(false);
  const [roster, setRoster] = useState<BeastManagementView>();
  const [loadError, setLoadError] = useState('');
  const [beastId, setBeastId] = useState(initialBeastId ?? '');
  const [quantity, setQuantity] = useState(1);
  useEffect(() => {
    if (!learning) return;
    const controller = new AbortController();
    void combatV6Request<BeastManagementView>('/api/combat-v6/beasts', {
      signal: controller.signal,
    })
      .then((value) => {
        if (!controller.signal.aborted) setRoster(value);
      })
      .catch((e) => {
        if (!controller.signal.aborted) setLoadError(e.message);
      });
    return () => controller.abort();
  }, [learning]);
  const beast = roster?.beasts.find((b) => b.id === beastId);
  const valid =
    !!beast &&
    beast.skillSlotCapacity > 0 &&
    beast.level <= roster!.ownerLevel &&
    !beast.skills.includes(definition.skillId!);
  const ref = { id: item.id, revision: item.revision };
  return (
    <InkDetailDrawer
      isOpen
      title={learning ? `学习 · ${item.name}` : item.name}
      onClose={close}
      size="sm"
    >
      <div className="space-y-4 text-sm">
        {error || loadError ? (
          <p role="alert" className="text-crimson">
            {error || loadError}
          </p>
        ) : null}
        <p>
          持有 {item.quantity} {definition.kind === 'beast_book' ? '本' : '件'}
        </p>
        {definition.skillId ? (
          <p>
            {details[definition.skillId]?.description}
            <InkTooltip label="兽诀使用说明">
              消耗一本，等概率覆盖一个现有技能，包括出生技能。普通和高级同系同时存在时仅高级生效。
            </InkTooltip>
          </p>
        ) : definition.kind === 'material' ? (
          <MaterialDetails
            data={materialFactsOf(item.definitionId, item.instanceData)}
          />
        ) : definition.kind === 'blueprint' ? (
          <p>
            {definition.level}级图纸，铸造消耗一张。
            <Link className="ml-2 underline" to="/game/craft/refine">
              前往炼器室
            </Link>
          </p>
        ) : (
          <EquipmentDetails data={item.instanceData} />
        )}
        {learning ? (
          <>
            {!roster && !loadError ? <p>正在查看灵兽……</p> : null}
            <label className="block">
              选择灵兽
              <select
                aria-label="选择学习灵兽"
                className="border-ink/20 mt-2 w-full border bg-transparent p-2"
                value={beastId}
                disabled={pending}
                onChange={(e) => setBeastId(e.target.value)}
              >
                <option value="">请选择</option>
                {roster?.beasts.map((b) => (
                  <option
                    key={b.id}
                    value={b.id}
                    disabled={
                      b.level > roster.ownerLevel ||
                      !b.skillSlotCapacity ||
                      b.skills.includes(definition.skillId!)
                    }
                  >
                    {b.name} · {b.level}级
                    {b.skills.includes(definition.skillId!)
                      ? ' · 已拥有'
                      : b.level > roster.ownerLevel
                        ? ' · 等级过高'
                        : !b.skillSlotCapacity
                          ? ' · 无技能格'
                          : ''}
                  </option>
                ))}
              </select>
            </label>
            {beast ? (
              <div className="space-y-2">
                {beast.skills.map((id) => (
                  <p key={id}>
                    {skillName(id)}
                    {!activeBeastSkills(beast).includes(id)
                      ? '（被高级技能抑制）'
                      : ''}
                    <InkTooltip label="技能说明">
                      {details[id]?.description}
                    </InkTooltip>
                  </p>
                ))}
              </div>
            ) : null}
            <p>随机覆盖其中一个技能，消耗一本，结果不可撤销。</p>
            <div className="flex gap-3">
              <InkButton disabled={pending} onClick={() => setLearning(false)}>
                返回
              </InkButton>
              <InkButton
                pending={pending}
                disabled={!valid}
                onClick={() =>
                  void act({
                    action: 'learn',
                    ...ref,
                    beastId,
                    beastRevision: beast!.revision,
                  })
                }
              >
                确认学习
              </InkButton>
            </div>
          </>
        ) : (
          <>
            <div className="flex flex-wrap gap-3">
              {item.location === 'bag' && definition.kind === 'beast_book' ? (
                <InkButton disabled={pending} onClick={() => setLearning(true)}>
                  使用
                </InkButton>
              ) : null}
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
                  onClick={() =>
                    void act({ action: 'split', ...ref, quantity })
                  }
                >
                  拆分到空格
                </InkButton>
              </div>
            ) : null}
          </>
        )}
      </div>
    </InkDetailDrawer>
  );
}

function MaterialDetails({ data }: { data: unknown }) {
  const material = MaterialFactsSchema.parse(data);
  return (
    <div>
      <p>
        {material.rank} · {MATERIAL_TYPE_NAMES[material.type]}
        {material.element ? ` · ${material.element}` : ''}
      </p>
      <p>{material.description}</p>
    </div>
  );
}
