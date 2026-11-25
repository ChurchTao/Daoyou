import { GameIcon } from '@app/components/ui/GameIcon';
import { InkDetailDrawer } from '@app/components/ui/InkDetailDrawer';
import { apiFetch } from '@app/lib/api/fetch';
import { realtimeClient } from '@app/lib/realtime/realtimeClient';
import { usePlayerSession } from '@app/lib/resources/player';
import type { CurrentParty, PartyView } from '@daoyou/contracts/party';
import type { WorldChatMessageDTO } from '@daoyou/contracts/world-chat';
import {
  useCallback,
  useEffect,
  useRef,
  useState,
  type PointerEvent,
} from 'react';
import './party-chat-dock.css';
import { PartyChat } from './PartyChat';
import { PARTY_CHANGED, PARTY_CHAT_OPEN } from './partyEvents';

export function PartyChatDock() {
  const actorId = usePlayerSession().data?.activeCultivator?.id;
  return actorId ? <PartyChannel key={actorId} actorId={actorId} /> : null;
}

function PartyChannel({ actorId }: { actorId: string }) {
  const [party, setParty] = useState<PartyView>();
  useEffect(() => {
    const abort = new AbortController();
    let reading = false;
    let refreshAfterRead = false;
    const refresh = async () => {
      if (reading) {
        refreshAfterRead = true;
        return;
      }
      reading = true;
      try {
        const response = await apiFetch('/api/parties/me', {
          signal: abort.signal,
          cache: 'no-store',
        });
        if (!abort.signal.aborted && response.ok) {
          const current = (await response.json()) as CurrentParty;
          if (!abort.signal.aborted)
            setParty(
              current.roleMismatch ? undefined : (current.party ?? undefined),
            );
        }
      } catch {
        // A later poll or membership change refreshes the channel.
      } finally {
        reading = false;
        if (refreshAfterRead && !abort.signal.aborted) {
          refreshAfterRead = false;
          void refresh();
        }
      }
    };
    const poll = () => {
      if (document.visibilityState === 'visible') void refresh();
    };
    const immediate = () => void refresh();
    void refresh();
    const timer = window.setInterval(poll, 5000);
    window.addEventListener(PARTY_CHANGED, immediate);
    window.addEventListener('daoyou:hunt-team-changed', immediate);
    document.addEventListener('visibilitychange', poll);
    return () => {
      abort.abort();
      window.clearInterval(timer);
      window.removeEventListener(PARTY_CHANGED, immediate);
      window.removeEventListener('daoyou:hunt-team-changed', immediate);
      document.removeEventListener('visibilitychange', poll);
    };
  }, []);
  return (
    party && <PartyDrawer key={party.id} actorId={actorId} party={party} />
  );
}

function PartyDrawer({
  actorId,
  party,
}: {
  actorId: string;
  party: PartyView;
}) {
  const [open, setOpen] = useState(false);
  const [unread, setUnread] = useState(0);
  const [draft, setDraft] = useState('');
  const [reply, setReply] = useState<WorldChatMessageDTO | null>(null);
  const [position, setPosition] = useState<{
    edge: 'left' | 'right';
    top: number;
  }>();
  const pointer = useRef<{ id: number; x: number; y: number; moved: boolean }>(
    null,
  );
  const skipClick = useRef(false);
  const openRef = useRef(false);
  const seen = useRef(new Set<string>());

  useEffect(
    () =>
      realtimeClient.subscribe('hunt-team.chat', ({ payload }) => {
        if (
          payload.teamId !== party.id ||
          payload.senderCultivatorId === actorId ||
          seen.current.has(payload.id)
        )
          return;
        if (seen.current.size >= 100) seen.current.clear();
        seen.current.add(payload.id);
        if (!openRef.current) setUnread((count) => Math.min(count + 1, 100));
      }),
    [actorId, party.id],
  );

  const updateOpen = useCallback((next: boolean) => {
    openRef.current = next;
    setOpen(next);
    if (next) setUnread(0);
  }, []);

  useEffect(() => {
    const reveal = () => updateOpen(true);
    window.addEventListener(PARTY_CHAT_OPEN, reveal);
    return () => window.removeEventListener(PARTY_CHAT_OPEN, reveal);
  }, [updateOpen]);

  function begin(event: PointerEvent<HTMLButtonElement>) {
    if (event.button !== 0) return;
    skipClick.current = false;
    pointer.current = {
      id: event.pointerId,
      x: event.clientX,
      y: event.clientY,
      moved: false,
    };
    event.currentTarget.setPointerCapture(event.pointerId);
  }

  function move(event: PointerEvent<HTMLButtonElement>) {
    const start = pointer.current;
    if (!start || start.id !== event.pointerId) return;
    if (
      !start.moved &&
      Math.hypot(event.clientX - start.x, event.clientY - start.y) < 10
    )
      return;
    start.moved = true;
    setPosition({
      edge: event.clientX < window.innerWidth / 2 ? 'left' : 'right',
      top: Math.max(0.21, Math.min(0.67, event.clientY / window.innerHeight)),
    });
  }

  function end() {
    skipClick.current = !!pointer.current?.moved;
    pointer.current = null;
  }

  return (
    <>
      <button
        type="button"
        className="party-chat-dock"
        data-edge={position?.edge ?? 'right'}
        style={position && { top: `${position.top * 100}dvh` }}
        aria-label={
          unread
            ? `队伍传音，${unread > 99 ? '99 条以上' : `${unread} 条`}新消息`
            : '队伍传音'
        }
        aria-haspopup="dialog"
        aria-expanded={open}
        onPointerDown={begin}
        onPointerMove={move}
        onPointerUp={end}
        onPointerCancel={end}
        onClick={(event) => {
          if (event.detail && skipClick.current) return;
          updateOpen(true);
        }}
      >
        <GameIcon value="💬" />
        <span>队伍</span>
        {unread > 0 && (
          <b aria-hidden="true" className="font-mono">
            {unread > 99 ? '99+' : unread}
          </b>
        )}
      </button>
      <InkDetailDrawer
        isOpen={open}
        onClose={() => updateOpen(false)}
        title="队伍传音"
        size="sm"
        className="h-[calc(var(--overlay-viewport-height,100dvh)*0.76)] md:h-full"
        bodyClassName="flex flex-col overflow-hidden pt-2"
      >
        <PartyChat
          actorId={actorId}
          team={party}
          draft={draft}
          setDraft={setDraft}
          reply={reply}
          setReply={setReply}
        />
      </InkDetailDrawer>
    </>
  );
}
