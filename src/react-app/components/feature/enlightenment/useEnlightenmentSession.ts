import { useInventoryBag } from '@app/lib/resources/bag';
import { consumeResourceMutation } from '@app/lib/resources/mutations';
import {
  useCultivatorCurrency,
  useCultivatorIdentity,
  useCultivatorProgress,
} from '@app/lib/resources/player';
import {
  EnlightenmentRequestSchema,
  type EnlightenmentRequest,
  type EnlightenmentResult,
  type EnlightenmentView,
} from '@shared/contracts/enlightenment';
import type { InventoryView } from '@shared/contracts/inventory';
import {
  enlightenmentMaterialProblem,
  prepareEnlightenment,
  type EnlightenmentPreview,
} from '@shared/manuals/enlightenment';
import { useEffect, useRef, useState } from 'react';
import { combatV6Request, mutationBody } from '../combat-v6/request';

const endpoint = '/api/combat-v6/enlightenment';
export type EnlightenmentItem = InventoryView['items'][number];
const emptySlots = (): (string | null)[] => Array(4).fill(null);

export function useEnlightenmentSession(ownerId: string) {
  const bag = useInventoryBag();
  const profile = useCultivatorIdentity();
  const currency = useCultivatorCurrency();
  const progress = useCultivatorProgress();
  const [refresh, setRefresh] = useState(0);
  const version = `${profile.version}:${currency.version}:${progress.version}:${refresh}`;
  const [read, setRead] = useState<{
    version: string;
    view: EnlightenmentView;
  }>();
  const [error, setError] = useState('');
  const [slots, setSlots] = useState(emptySlots);
  const [pending, setPending] = useState(false);
  const [result, setResult] = useState<EnlightenmentResult>();
  const storageKey = `manual-enlightenment:v1:${ownerId}`;
  const [unresolved, setUnresolved] = useState<EnlightenmentRequest | null>(
    () => {
      try {
        const raw = sessionStorage.getItem(storageKey);
        return raw ? EnlightenmentRequestSchema.parse(JSON.parse(raw)) : null;
      } catch {
        return null;
      }
    },
  );
  const busy = useRef(false);
  const alive = useRef(true);
  useEffect(() => {
    alive.current = true;
    return () => {
      alive.current = false;
    };
  }, []);
  useEffect(() => {
    const controller = new AbortController();
    void combatV6Request<EnlightenmentView>(endpoint, {
      signal: controller.signal,
    })
      .then((view) => {
        if (!controller.signal.aborted && view.ownerId === ownerId)
          setRead({ version, view });
      })
      .catch((e) => {
        if (!controller.signal.aborted) setError(e.message);
      });
    return () => controller.abort();
  }, [version, ownerId]);
  const view = read?.version === version ? read.view : undefined;
  const byId = new Map(bag.data?.items.map((item) => [item.id, item]));
  const quantities = new Map<string, number>();
  for (const id of slots)
    if (id) quantities.set(id, (quantities.get(id) ?? 0) + 1);
  const refs = Array.from(quantities, ([id, quantity]) => ({
    id,
    quantity,
    revision: byId.get(id)?.revision ?? -1,
  }));
  let preview: EnlightenmentPreview | undefined;
  let problem = view?.blockedReason ?? null;
  if (view && bag.data && refs.length) {
    try {
      preview = prepareEnlightenment(
        bag.data.items,
        refs,
        view.realm,
        view.insightMultiplier,
      ).preview;
    } catch (e) {
      problem ??= e instanceof Error ? e.message : '典籍无效';
    }
  }
  problem ??= !refs.length ? '选择一至四本典籍，静心参悟' : null;
  if (preview && view) {
    if (view.qi < preview.cost.qi) problem ??= '天地灵气不足';
    if (view.insight < preview.cost.insight) problem ??= '道心感悟不足';
  }
  const locked =
    pending ||
    !!result ||
    !!unresolved ||
    !view ||
    !bag.data ||
    bag.isRefreshing ||
    !!bag.error;
  function itemProblem(item: EnlightenmentItem) {
    return view
      ? enlightenmentMaterialProblem(item, view.realm)
      : '正在核对境界……';
  }
  function choose(item: EnlightenmentItem) {
    if (locked) return;
    const reason = itemProblem(item);
    if (reason) {
      setError(reason);
      return;
    }
    if ((quantities.get(item.id) ?? 0) >= item.quantity) {
      setError('该典籍可用数量不足');
      return;
    }
    const index = slots.indexOf(null);
    if (index < 0) {
      setError('典籍位已满，可先移出一本');
      return;
    }
    setError('');
    setSlots((old) => old.map((id, i) => (i === index ? item.id : id)));
  }
  function reload() {
    if (busy.current) return;
    setError('');
    setRefresh((n) => n + 1);
    void bag.reload();
  }
  async function submit() {
    if (busy.current) return;
    if (!unresolved && (locked || problem || !view || !preview)) return;
    const input: EnlightenmentRequest = unresolved ?? {
      requestId: crypto.randomUUID(),
      materials: refs,
      expected: {
        realm: view!.realm,
        insightMultiplier: view!.insightMultiplier,
        qi: preview!.cost.qi,
        insight: preview!.cost.insight,
      },
    };
    busy.current = true;
    setPending(true);
    setError('');
    try {
      // Persist before sending, so a reload retries the same draw rather than buying a new one.
      sessionStorage.setItem(storageKey, JSON.stringify(input));
      setUnresolved(input);
      const response = await fetch(endpoint, {
        ...mutationBody(input),
        headers: { 'Content-Type': 'application/json' },
        signal: AbortSignal.timeout(30000),
      });
      const failure = !response.ok
        ? await response
            .clone()
            .json()
            .catch(() => null)
        : null;
      if (
        response.status === 400 ||
        failure?.code === 'ENLIGHTENMENT_REJECTED'
      ) {
        sessionStorage.removeItem(storageKey);
        if (alive.current) setUnresolved(null);
      }
      const data = await consumeResourceMutation<EnlightenmentResult>(response);
      sessionStorage.removeItem(storageKey);
      if (alive.current) {
        setUnresolved(null);
        setResult(data);
        setSlots(emptySlots());
      }
    } catch (e) {
      if (alive.current)
        setError(e instanceof Error ? e.message : '参悟结果暂未确认');
    } finally {
      busy.current = false;
      if (alive.current) {
        setPending(false);
        setRefresh((n) => n + 1);
        void bag.reload();
      }
    }
  }
  return {
    ownerId,
    view,
    inventory: bag.data,
    slots,
    byId,
    quantities,
    preview,
    problem,
    locked,
    pending,
    unresolved,
    result,
    error: error || bag.error,
    choose,
    itemProblem,
    reload,
    submit,
    remove: (index: number) => {
      if (!locked)
        setSlots((old) => old.map((id, i) => (i === index ? null : id)));
    },
    continueEnlightenment: () => {
      setResult(undefined);
      reload();
    },
  };
}
export type EnlightenmentSession = ReturnType<typeof useEnlightenmentSession>;
