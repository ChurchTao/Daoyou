import { apiFetch } from '@app/lib/api/fetch';
import { invalidateCachedRequest } from '@app/lib/client/requestCache';
import { useResourceMutation } from '@app/lib/resources/mutations';
import type {
  AvatarCollectionView,
  AvatarJobView,
} from '@daoyou/contracts/player/avatar';
import { useEffect, useState } from 'react';

export const AVATAR_API = '/api/cultivator/avatars';

async function readCollection(signal?: AbortSignal, before?: string) {
  const path = before
    ? `${AVATAR_API}?before=${encodeURIComponent(before)}`
    : AVATAR_API;
  const response = await apiFetch(path, { signal });
  if (!response.ok) throw new Error('暂时无法读取头像收藏');
  const body = (await response.json()) as { data: AvatarCollectionView };
  return body.data;
}

export function isAvatarJobPending(job?: AvatarJobView | null) {
  return (
    job?.status === 'queued' ||
    job?.status === 'generating' ||
    job?.status === 'processing'
  );
}

export function useAvatarCollection(followJob = false) {
  const [view, setView] = useState<AvatarCollectionView>();
  const [extra, setExtra] =
    useState<Pick<AvatarCollectionView, 'avatars' | 'nextCursor'>>();
  const [error, setError] = useState('');
  const [paging, setPaging] = useState(false);
  const [refresh, setRefresh] = useState(0);
  const [observedJobId, setObservedJobId] = useState<string>();

  useEffect(() => {
    const controller = new AbortController();
    let timer: number | undefined;
    let following = followJob;

    async function poll() {
      try {
        const current = await readCollection(controller.signal);
        if (controller.signal.aborted) return;
        setView(current);
        setError('');
        const job = current.latestJob;
        if (followJob && job && isAvatarJobPending(job))
          setObservedJobId(job.id);
        following =
          followJob &&
          (isAvatarJobPending(job) ||
            (job?.status === 'failed' && !job.refundLocation));
        if (following) timer = window.setTimeout(() => void poll(), 2_500);
      } catch (reason) {
        if (controller.signal.aborted) return;
        setError(
          reason instanceof Error ? reason.message : '暂时无法读取头像收藏',
        );
        if (following) timer = window.setTimeout(() => void poll(), 5_000);
      }
    }

    void poll();
    return () => {
      controller.abort();
      window.clearTimeout(timer);
    };
  }, [followJob, refresh]);

  const nextCursor = extra ? extra.nextCursor : view?.nextCursor;
  const knownIds = new Set(view?.avatars.map((entry) => entry.id));
  const avatars = extra
    ? [
        ...(view?.avatars ?? []),
        ...extra.avatars.filter((entry) => !knownIds.has(entry.id)),
      ]
    : (view?.avatars ?? []);

  async function nextPage() {
    if (!nextCursor || paging) return;
    setPaging(true);
    setError('');
    try {
      const data = await readCollection(undefined, nextCursor);
      setExtra((current) => ({
        avatars: [...(current?.avatars ?? []), ...data.avatars],
        nextCursor: data.nextCursor,
      }));
    } catch {
      setError('暂时无法载入更多头像');
    } finally {
      setPaging(false);
    }
  }

  return {
    view,
    avatars,
    nextCursor,
    error,
    paging,
    nextPage,
    observedJobId,
    reload: () => setRefresh((value) => value + 1),
    setLatestJob: (latestJob: AvatarJobView) => {
      setObservedJobId(latestJob.id);
      setView((current) => (current ? { ...current, latestJob } : current));
    },
  };
}

export function useAvatarEquip(cultivatorId: string) {
  const { mutate } = useResourceMutation();
  const [equipping, setEquipping] = useState(false);
  const [equipError, setEquipError] = useState('');

  async function equip(avatarId: string | null) {
    if (equipping) return;
    setEquipping(true);
    setEquipError('');
    try {
      const next = await mutate<{ avatarId: string | null }>(
        apiFetch(`${AVATAR_API}/active`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ avatarId }),
        }),
      );
      invalidateCachedRequest(`character-card:${cultivatorId}`);
      invalidateCachedRequest(`card-settings:${cultivatorId}`);
      return next;
    } catch (reason) {
      setEquipError(
        reason instanceof Error ? reason.message : '暂时无法切换头像',
      );
    } finally {
      setEquipping(false);
    }
  }

  return { equip, equipping, equipError };
}
