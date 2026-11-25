import { notifyHuntTeamChanged } from '@app/components/feature/hunts/huntTeamView';
import { useInkUI } from '@app/components/providers/useInkUI';
import { realtimeClient } from '@app/lib/realtime/realtimeClient';
import type { CurrentParty, PartyCommand } from '@daoyou/contracts/party';
import {
  useCallback,
  useEffect,
  useRef,
  useState,
  type ReactNode,
} from 'react';
import { requestParty } from './partyWorkspaceApi';
import { PartyContext, type PartyDraft, type PartyResult } from './useParty';

export function PartyProvider({
  actorId,
  children,
}: {
  actorId: string;
  children: ReactNode;
}) {
  const { pushToast } = useInkUI();
  const [value, setValue] = useState<CurrentParty>();
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const [draft, setDraft] = useState<PartyDraft>();
  const [unread, setUnread] = useState<{ partyId: string; count: number }>();
  const prior = useRef<CurrentParty>(undefined);
  const request = useRef<AbortController>(null);
  const queued = useRef(false);
  const mutation = useRef(false);
  const chatVisible = useRef(false);
  const partyId = value?.roleMismatch ? undefined : value?.party?.id;

  const accept = useCallback(
    (next: CurrentParty) => {
      const previous = prior.current;
      prior.current = next;
      setValue(next);
      if (
        next.party &&
        !next.roleMismatch &&
        previous &&
        !previous.party &&
        next.outgoing.some(
          (item) =>
            item.status === 'accepted' &&
            item.partyId === next.party?.id &&
            previous.outgoing.some(
              (old) => old.id === item.id && old.status === 'pending',
            ),
        )
      )
        pushToast({ message: '入队申请已通过', tone: 'success' });
      if (
        previous &&
        (previous.party?.id !== next.party?.id ||
          previous.party?.revision !== next.party?.revision)
      )
        notifyHuntTeamChanged();
    },
    [pushToast],
  );

  const refresh = useCallback(
    function load() {
      if (mutation.current || request.current) {
        queued.current = true;
        return;
      }
      queued.current = false;
      const abort = new AbortController();
      request.current = abort;
      void requestParty<CurrentParty>('/me', { signal: abort.signal })
        .then((data) => {
          if (abort.signal.aborted) return;
          accept(data);
        })
        .catch((cause: Error) => {
          if (!abort.signal.aborted && !prior.current) setError(cause.message);
        })
        .finally(() => {
          if (request.current !== abort) return;
          request.current = null;
          if (queued.current) load();
        });
    },
    [accept],
  );

  useEffect(() => {
    refresh();
    const poll = () => {
      if (!document.hidden) refresh();
    };
    const timer = window.setInterval(poll, 5000);
    document.addEventListener('visibilitychange', poll);
    const reconnect = realtimeClient.subscribe('ready', poll);
    const changed = realtimeClient.subscribe('party.changed', poll);
    return () => {
      window.clearInterval(timer);
      document.removeEventListener('visibilitychange', poll);
      reconnect();
      changed();
      request.current?.abort();
      request.current = null;
    };
  }, [refresh]);

  useEffect(() => {
    if (!partyId) return;
    const seen = new Set<string>();
    return realtimeClient.subscribe('hunt-team.chat', ({ payload }) => {
      if (
        payload.teamId !== partyId ||
        payload.senderCultivatorId === actorId ||
        seen.has(payload.id)
      )
        return;
      if (seen.size >= 100) seen.clear();
      seen.add(payload.id);
      if (!chatVisible.current)
        setUnread((old) => ({
          partyId,
          count: Math.min(100, (old?.partyId === partyId ? old.count : 0) + 1),
        }));
    });
  }, [actorId, partyId]);

  const setChatVisible = useCallback((visible: boolean) => {
    chatVisible.current = visible;
    if (visible) setUnread(undefined);
  }, []);

  async function send(command: PartyCommand) {
    if (mutation.current) return;
    mutation.current = true;
    request.current?.abort();
    request.current = null;
    setBusy(true);
    setError('');
    try {
      const next = await requestParty<PartyResult>('', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify(command),
      });
      accept(next);
      return next;
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : '暂时无法处理队伍事务');
      return undefined;
    } finally {
      mutation.current = false;
      setBusy(false);
      refresh();
    }
  }

  return (
    <PartyContext.Provider
      value={{
        actorId,
        value,
        error,
        busy,
        refresh,
        send,
        unread: unread?.partyId === partyId ? (unread?.count ?? 0) : 0,
        draft: draft?.partyId === partyId ? draft : undefined,
        setDraft: (update) => {
          if (partyId)
            setDraft((old) =>
              update(
                old?.partyId === partyId
                  ? old
                  : { partyId, text: '', reply: null },
              ),
            );
        },
        setChatVisible,
      }}
    >
      {children}
    </PartyContext.Provider>
  );
}
