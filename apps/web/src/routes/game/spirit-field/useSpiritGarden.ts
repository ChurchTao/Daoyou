import { apiFetch } from '@app/lib/api/fetch';
import { useResourceMutation } from '@app/lib/resources/mutations';
import type {
  SpiritFieldArchiveRequest,
  SpiritFieldBranchRequest,
  SpiritFieldEvolveRequest,
  SpiritFieldRestoreRequest,
  SpiritFieldRetireRequest,
  SpiritFieldSnapshot,
  SpiritFieldSowRequest,
} from '@daoyou/contracts/spirit-field';
import type { SpiritGardenProduct } from '@daoyou/game-domain/spirit-field';
import { useCallback, useEffect, useRef, useState } from 'react';

type Input<T> = Omit<T, 'requestId' | 'expectedVersion'>;
export type GardenAction =
  | { endpoint: 'starter' | 'harvest'; input: Record<string, never> }
  | { endpoint: 'sow'; input: Input<SpiritFieldSowRequest> }
  | { endpoint: 'branch'; input: Input<SpiritFieldBranchRequest> }
  | { endpoint: 'evolve'; input: Input<SpiritFieldEvolveRequest> }
  | { endpoint: 'archive'; input: Input<SpiritFieldArchiveRequest> }
  | { endpoint: 'restore'; input: Input<SpiritFieldRestoreRequest> }
  | { endpoint: 'retire'; input: Input<SpiritFieldRetireRequest> };
export interface GardenOutcome {
  action: GardenAction;
  result: {
    message?: string;
    plantId?: string;
    products?: SpiritGardenProduct[];
    quantity?: number;
    locations?: string[];
  };
}
interface Attempt {
  action: GardenAction;
  body: string;
}

/** Transport owns retries; changing the visible panel never changes a pending request. */
export function useSpiritGarden() {
  const { mutate } = useResourceMutation();
  const [snapshot, setSnapshot] = useState<SpiritFieldSnapshot>();
  const [snapshotAt, setSnapshotAt] = useState(0);
  const [now, setNow] = useState(Date.now);
  const [readError, setReadError] = useState('');
  const [mutationError, setMutationError] = useState('');
  const [busy, setBusy] = useState(false);
  const [needsRetry, setNeedsRetry] = useState(false);
  const pending = useRef(false);
  const attempt = useRef<Attempt | null>(null);
  const readSequence = useRef(0);

  const refresh = useCallback(async () => {
    const sequence = ++readSequence.current;
    try {
      const response = await apiFetch('/api/spirit-field');
      const result = (await response.json()) as {
        success: boolean;
        data?: SpiritFieldSnapshot;
        error?: string;
      };
      if (!response.ok || !result.success || !result.data)
        throw new Error(result.error ?? '灵田读取失败');
      if (sequence !== readSequence.current) return;
      setSnapshot(result.data);
      setSnapshotAt(Date.now());
      setReadError('');
    } catch (cause) {
      if (sequence === readSequence.current)
        setReadError(cause instanceof Error ? cause.message : '灵田读取失败');
    }
  }, []);

  useEffect(() => {
    const initial = window.setTimeout(() => void refresh(), 0);
    const tick = window.setInterval(() => {
      setNow(Date.now());
      if (
        !pending.current &&
        !attempt.current &&
        document.visibilityState === 'visible'
      )
        void refresh();
    }, 15_000);
    const focus = () => {
      if (!pending.current && !attempt.current) void refresh();
    };
    window.addEventListener('focus', focus);
    return () => {
      window.clearTimeout(initial);
      window.clearInterval(tick);
      window.removeEventListener('focus', focus);
      readSequence.current += 1;
    };
  }, [refresh]);

  async function perform(request: Attempt): Promise<GardenOutcome | null> {
    if (pending.current) return null;
    pending.current = true;
    readSequence.current += 1;
    setBusy(true);
    setMutationError('');
    try {
      const response = await apiFetch(
        `/api/spirit-field/${request.action.endpoint}`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: request.body,
        },
      );
      if (response.status >= 400 && response.status < 500)
        attempt.current = null;
      const result = await mutate<GardenOutcome['result']>(
        Promise.resolve(response),
      );
      attempt.current = null;
      setNeedsRetry(false);
      await refresh();
      return { action: request.action, result };
    } catch (cause) {
      setNeedsRetry(Boolean(attempt.current));
      setMutationError(cause instanceof Error ? cause.message : '灵田操作失败');
      await refresh();
      return null;
    } finally {
      pending.current = false;
      setBusy(false);
    }
  }

  async function act(action: GardenAction) {
    if (!snapshot || pending.current || attempt.current) return null;
    const request = {
      action,
      body: JSON.stringify({
        ...action.input,
        expectedVersion: snapshot.profile.version,
        requestId: `field:${crypto.randomUUID()}`,
      }),
    };
    attempt.current = request;
    return perform(request);
  }

  return {
    snapshot,
    snapshotAt,
    now,
    readError,
    mutationError,
    busy,
    needsRetry,
    locked: busy || needsRetry,
    refresh,
    act,
    retry: () =>
      attempt.current ? perform(attempt.current) : Promise.resolve(null),
  };
}
