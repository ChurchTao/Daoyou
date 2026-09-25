import type { InventoryKind } from '@app/components/feature/items/InventoryFilters';
import { useInventoryBag } from '@app/lib/resources/bag';
import { useCraftStorage } from '@app/lib/resources/craftStorage';
import { consumeResourceMutation } from '@app/lib/resources/mutations';
import type { ForgeRequest, ForgeView } from '@shared/contracts/forging';
import type { InventoryView } from '@shared/contracts/inventory';
import {
  equipmentRealm,
  isOpenEquipmentLevel,
} from '@shared/engine/combat-v6/equipment/realm';
import type { DaoEquipmentInstanceV1 } from '@shared/engine/combat-v6/equipment/types';
import type { DaoWeaponType } from '@shared/engine/combat-v6/equipment/weapons';
import { FORGE_INTENT_MAX_LENGTH } from '@shared/forging/narrative';
import { forgingCost, forgingInputs } from '@shared/forging/rules';
import { itemDefinition } from '@shared/inventory';
import { FORGING_MATERIAL_TYPES } from '@shared/items/definitions/materials';
import { materialFactsOf } from '@shared/items/material';
import { QUALITY_ORDER } from '@shared/types/constants';
import { useEffect, useRef, useState } from 'react';
import { combatV6Request, mutationBody } from '../combat-v6/request';

export type ForgeItem = InventoryView['items'][number];
const endpoint = '/api/combat-v6/forging';
const emptyMaterials = (): (string | null)[] => Array(5).fill(null);

export function useForgingSession(kind: InventoryKind) {
  const bagQuery = useInventoryBag();
  const [source, setSource] = useState<'bag' | 'storage'>('bag');
  const storage = useCraftStorage(kind, source === 'storage');
  const inventory = source === 'bag' ? bagQuery.data : storage.view;
  const [chosenItems, setChosenItems] = useState<Map<string, ForgeItem>>(
    new Map(),
  );
  const [view, setView] = useState<ForgeView>();
  const [refresh, setRefresh] = useState(0);
  const [blueprintId, setBlueprintId] = useState('');
  const [materialIds, setMaterialIds] = useState(emptyMaterials);
  const [pending, setPending] = useState(false);
  const [intent, setIntent] = useState('');
  const [weaponType, setWeaponType] = useState<DaoWeaponType>('sword');
  const [retryInput, setRetryInput] = useState<ForgeRequest>();
  const [error, setError] = useState('');
  const [result, setResult] = useState<{
    equipment: DaoEquipmentInstanceV1;
    destination: 'bag' | 'storage';
  }>();
  const busy = useRef(false);
  const alive = useRef(true);
  const reader = useRef<AbortController | null>(null);
  const stopCeremony = useRef<(() => void) | null>(null);
  useEffect(() => {
    alive.current = true;
    return () => {
      alive.current = false;
      reader.current?.abort();
      stopCeremony.current?.();
    };
  }, []);
  useEffect(() => {
    const controller = new AbortController();
    reader.current = controller;
    void combatV6Request<ForgeView>(endpoint, { signal: controller.signal })
      .then((data) => {
        if (!controller.signal.aborted) setView(data);
      })
      .catch((e) => {
        if (!controller.signal.aborted)
          setError((previous) => previous || `读取储物袋失败：${e.message}`);
      });
    return () => controller.abort();
  }, [refresh]);

  const byId = new Map([
    ...chosenItems,
    ...(bagQuery.data?.items.map((item) => [item.id, item] as const) ?? []),
    ...(storage.view?.items.map((item) => [item.id, item] as const) ?? []),
  ]);
  const blueprint = byId.get(blueprintId);
  const definition = blueprint
    ? itemDefinition(blueprint.definitionId)
    : undefined;
  const cost = definition?.level ? forgingCost(definition.level) : undefined;
  const quantities = new Map<string, number>();
  for (const id of materialIds) {
    if (id) quantities.set(id, (quantities.get(id) ?? 0) + 1);
  }
  const total = materialIds.filter(Boolean).length;
  const locked =
    pending ||
    !!retryInput ||
    !view ||
    !!result ||
    !inventory ||
    (source === 'bag' ? bagQuery.isRefreshing : storage.loading) ||
    !!(source === 'bag' ? bagQuery.error : storage.error);
  function itemProblem(item: ForgeItem, targetCost = cost): string | null {
    const def = itemDefinition(item.definitionId);
    if (def.kind === 'blueprint' && !isOpenEquipmentLevel(def.level!))
      return '该境界道装尚未开放打造';
    if (def.kind === 'blueprint')
      return equipmentRealm(def.level!).requiredLevel > (view?.ownerLevel ?? 0)
        ? '图纸境界超过人物境界'
        : null;
    if (def.kind !== 'material') return '此物不能用于铸造';
    if (!targetCost) return '请先选择道装图纸';
    const facts = materialFactsOf(item.instanceData);
    if (!FORGING_MATERIAL_TYPES.some((type) => type === facts.type))
      return '此类材料不能用于铸造';
    return QUALITY_ORDER[facts.rank] < QUALITY_ORDER[targetCost.rank]
      ? `本次材料需${targetCost.rank}或更高品质`
      : null;
  }
  const problem = !view
    ? error
      ? '请重新核对图纸和材料后备料'
      : '正在读取图纸和材料……'
    : !blueprint
      ? '请先选择道装图纸'
      : (itemProblem(blueprint) ??
        (total !== cost!.quantity
          ? `还需投入 ${cost!.quantity - total} 份灵材`
          : null) ??
        (Array.from(quantities).some(([id, quantity]) => {
          const item = byId.get(id);
          return !item || quantity > item.quantity || !!itemProblem(item);
        })
          ? '材料已变化，请重新备料'
          : null) ??
        (view.spiritStones < cost!.spiritStones ? '灵石不足' : null) ??
        (view.qi < cost!.qi ? '天地灵气不足' : null));

  const intentTooLong =
    Array.from(intent.trim()).length > FORGE_INTENT_MAX_LENGTH;
  const forging =
    !problem && definition?.level && view
      ? forgingInputs(
          definition.level,
          view.ownerLevel,
          Array.from(quantities, ([id, quantity]) => {
            const item = byId.get(id)!;
            return { facts: materialFactsOf(item.instanceData), quantity };
          }),
        )
      : undefined;

  function choose(item: ForgeItem): string {
    if (locked) return '当前不能调整炉中材料';
    const reason = itemProblem(item);
    if (reason) return reason;
    const def = itemDefinition(item.definitionId);
    setChosenItems((current) => new Map(current).set(item.id, item));
    if (def.kind === 'blueprint') {
      const nextCost = forgingCost(def.level!);
      const kept = materialIds
        .filter((id): id is string => {
          const entry = id ? byId.get(id) : undefined;
          return !!entry && !itemProblem(entry, nextCost);
        })
        .slice(0, nextCost.quantity);
      setBlueprintId(item.id);
      setMaterialIds([...kept, ...Array(5 - kept.length).fill(null)]);
      return kept.length < total
        ? '已更换图纸，不符合本次要求的材料已移出'
        : '图纸已放入';
    }
    if ((quantities.get(item.id) ?? 0) >= item.quantity)
      return '该材料的可用数量不足';
    const slot = materialIds.findIndex(
      (id, index) => !id && index < cost!.quantity,
    );
    if (slot < 0) return '材料位已满，可先点击炉中材料移出';
    setMaterialIds((old) =>
      old.map((id, index) => (index === slot ? item.id : id)),
    );
    return '已投入一份';
  }
  function remove(index: number) {
    if (!locked)
      setMaterialIds((old) => old.map((id, i) => (i === index ? null : id)));
  }
  function reload() {
    if (busy.current) return;
    setError('');
    setRetryInput(undefined);
    void bagQuery.reload();
    storage.reload();
    setChosenItems(new Map());
    setView(undefined);
    setMaterialIds(emptyMaterials());
    setRefresh((n) => n + 1);
  }
  async function submit(inputToRetry?: ForgeRequest) {
    if (
      busy.current ||
      (!inputToRetry && (locked || problem || intentTooLong || !blueprint))
    )
      return;
    busy.current = true;
    setPending(true);
    setError('');
    reader.current?.abort();
    const input: ForgeRequest = inputToRetry ?? {
      requestId: crypto.randomUUID(),
      intent: intent.trim(),
      ...(definition?.slot === 'weapon' ? { weaponType } : {}),
      blueprint: { id: blueprint!.id, revision: blueprint!.revision },
      materials: Array.from(quantities, ([id, quantity]) => ({
        id,
        revision: byId.get(id)!.revision,
        quantity,
      })),
    };
    try {
      const ceremony = new Promise<void>((resolve) => {
        const timer = window.setTimeout(
          resolve,
          window.matchMedia('(prefers-reduced-motion: reduce)').matches
            ? 0
            : 1800,
        );
        stopCeremony.current = () => {
          window.clearTimeout(timer);
          resolve();
        };
      });
      const [response] = await Promise.all([
        consumeResourceMutation<{
          equipment: DaoEquipmentInstanceV1;
          destination: 'bag' | 'storage';
        }>(
          await fetch(endpoint, {
            ...mutationBody(input),
            headers: { 'Content-Type': 'application/json' },
          }),
        ),
        ceremony,
      ]);
      if (alive.current) {
        setResult(response);
        setIntent('');
        setRetryInput(undefined);
      }
    } catch (e) {
      bagQuery.invalidate();
      if (alive.current) {
        setError(
          `${e instanceof Error ? e.message : '请求失败'}。可重试本次开炉以核对结果，或核对储物袋后重新备料。`,
        );
        setRetryInput(input);
        setBlueprintId('');
      }
    } finally {
      stopCeremony.current?.();
      stopCeremony.current = null;
      busy.current = false;
      if (alive.current) {
        setPending(false);
        setMaterialIds(emptyMaterials());
        storage.reload();
        setChosenItems(new Map());
        setView(undefined);
        setRefresh((n) => n + 1);
      }
    }
  }
  return {
    view,
    inventory,
    source,
    setSource(next: 'bag' | 'storage') {
      if (next === 'storage') storage.reload();
      setSource(next);
    },
    storage,
    blueprint,
    cost,
    byId,
    materialIds,
    quantities,
    total,
    pending,
    intent,
    weaponType,
    setWeaponType,
    setIntent,
    intentTooLong,
    canRetry: !!retryInput,
    retry: () => {
      if (retryInput) void submit(retryInput);
    },
    locked,
    error: error || (source === 'bag' ? bagQuery.error : storage.error),
    result,
    problem,
    forging,
    definition,
    itemProblem,
    choose,
    remove,
    reload,
    submit,
    continueForging: () => setResult(undefined),
  };
}
export type ForgingSession = ReturnType<typeof useForgingSession>;
