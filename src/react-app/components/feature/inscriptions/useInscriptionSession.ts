import { useInventoryBag } from '@app/lib/resources/bag';
import { consumeResourceMutation } from '@app/lib/resources/mutations';
import {
  useCultivatorCurrency,
  useCultivatorIdentity,
} from '@app/lib/resources/player';
import {
  InscriptionRequestSchema,
  type InscriptionRequest,
  type InscriptionResult,
  type InscriptionView,
} from '@shared/contracts/inscriptions';
import { useEffect, useRef, useState } from 'react';
import { combatV6Request, mutationBody } from '../combat-v6/request';

const endpoint = '/api/combat-v6/inscriptions';
export function useInscriptionSession(ownerId: string) {
  const bag = useInventoryBag();
  const profile = useCultivatorIdentity();
  const currency = useCultivatorCurrency();
  const [refresh, setRefresh] = useState(0);
  const version = `${profile.version}:${currency.version}:${bag.version}:${refresh}`;
  const [read, setRead] = useState<{
    version: string;
    view: InscriptionView;
  }>();
  const [error, setError] = useState('');
  const [pending, setPending] = useState(false);
  const [result, setResult] = useState<InscriptionResult>();
  const storageKey = `inscription:v1:${ownerId}`;
  const [unresolved, setUnresolved] = useState<InscriptionRequest | null>(
    () => {
      try {
        const raw = sessionStorage.getItem(storageKey);
        return raw ? InscriptionRequestSchema.parse(JSON.parse(raw)) : null;
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
    void combatV6Request<InscriptionView>(endpoint, {
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
  const locked =
    pending ||
    !!unresolved ||
    !!result ||
    !view ||
    !bag.data ||
    bag.isRefreshing ||
    !!bag.error;
  function reload() {
    if (busy.current) return;
    setError('');
    setRefresh((n) => n + 1);
    void bag.reload();
  }
  async function submit(request?: InscriptionRequest) {
    if (busy.current || (!unresolved && (locked || !request))) return;
    const input = unresolved ?? request!;
    busy.current = true;
    setPending(true);
    setError('');
    try {
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
      if (response.status === 400 || failure?.code === 'INSCRIPTION_REJECTED') {
        sessionStorage.removeItem(storageKey);
        if (alive.current) setUnresolved(null);
      }
      const data = await consumeResourceMutation<InscriptionResult>(response);
      sessionStorage.removeItem(storageKey);
      if (alive.current) {
        setUnresolved(null);
        setResult(data);
      }
    } catch (e) {
      if (alive.current)
        setError(e instanceof Error ? e.message : '本次结果暂未确认');
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
    bag,
    view,
    locked,
    pending,
    unresolved,
    result,
    error: error || bag.error,
    reload,
    submit,
    continueWork: () => {
      setResult(undefined);
      reload();
    },
  };
}
