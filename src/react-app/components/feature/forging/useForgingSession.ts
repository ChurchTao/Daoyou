import { consumeResourceMutation } from '@app/lib/resources/mutations';
import type { ForgeRequest, ForgeView } from '@shared/contracts/forging';
import type { InventoryView } from '@shared/contracts/inventory';
import type { DaoEquipmentInstanceV1 } from '@shared/engine/combat-v6/equipment/types';
import { forgingCost } from '@shared/forging/rules';
import { itemDefinition } from '@shared/inventory';
import { materialFactsOf } from '@shared/items/material';
import { QUALITY_ORDER } from '@shared/types/constants';
import { useEffect, useRef, useState } from 'react';
import { combatV6Request, mutationBody } from '../combat-v6/request';

export type ForgeItem = InventoryView['items'][number];
const endpoint = '/api/combat-v6/forging';
const emptyMaterials = (): (string | null)[] => Array(5).fill(null);

export function useForgingSession() {
  const [view, setView] = useState<ForgeView>();
  const [refresh, setRefresh] = useState(0);
  const [blueprintId, setBlueprintId] = useState('');
  const [materialIds, setMaterialIds] = useState(emptyMaterials);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState('');
  const [result, setResult] = useState<{
    equipment: DaoEquipmentInstanceV1;
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

  const byId = new Map(view?.inventory.items.map((item) => [item.id, item]));
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
  const locked = pending || !view || !!result;
  function itemProblem(item: ForgeItem, targetCost = cost): string | null {
    const def = itemDefinition(item.definitionId);
    if (def.kind === 'blueprint')
      return def.level! > (view?.ownerLevel ?? 0)
        ? '图纸等级超过人物等级'
        : null;
    if (def.kind !== 'material') return '此物不能用于铸造';
    if (!targetCost) return '请先选择道装图纸';
    const facts = materialFactsOf(item.definitionId, item.instanceData);
    return QUALITY_ORDER[facts.rank] < QUALITY_ORDER[targetCost.rank]
      ? `本次材料需${targetCost.rank}或更高品质`
      : null;
  }
  const problem = !view
    ? error
      ? '请重新核对储物袋后备料'
      : '正在读取储物袋……'
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

  function choose(item: ForgeItem): string {
    if (locked) return '当前不能调整炉中材料';
    const reason = itemProblem(item);
    if (reason) return reason;
    const def = itemDefinition(item.definitionId);
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
    setView(undefined);
    setMaterialIds(emptyMaterials());
    setRefresh((n) => n + 1);
  }
  async function submit() {
    if (busy.current || locked || problem || !blueprint) return;
    busy.current = true;
    setPending(true);
    setError('');
    reader.current?.abort();
    const input: ForgeRequest = {
      blueprint: { id: blueprint.id, revision: blueprint.revision },
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
        }>(
          await fetch(endpoint, {
            ...mutationBody(input),
            headers: { 'Content-Type': 'application/json' },
          }),
        ),
        ceremony,
      ]);
      if (alive.current) setResult(response);
    } catch (e) {
      if (alive.current) {
        setError(
          `${e instanceof Error ? e.message : '请求失败'}。请核对储物袋后重新备料，勿重复开炉。`,
        );
        setBlueprintId('');
      }
    } finally {
      stopCeremony.current?.();
      stopCeremony.current = null;
      busy.current = false;
      if (alive.current) {
        setPending(false);
        setMaterialIds(emptyMaterials());
        setView(undefined);
        setRefresh((n) => n + 1);
      }
    }
  }
  return {
    view,
    blueprint,
    cost,
    byId,
    materialIds,
    quantities,
    total,
    pending,
    locked,
    error,
    result,
    problem,
    itemProblem,
    choose,
    remove,
    reload,
    submit,
    continueForging: () => setResult(undefined),
  };
}
export type ForgingSession = ReturnType<typeof useForgingSession>;
