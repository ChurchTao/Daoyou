import { GameIcon } from '@app/components/ui/GameIcon';
import { InkDetailDrawer } from '@app/components/ui/InkDetailDrawer';
import { useEffect, useRef, useState, type PointerEvent } from 'react';
import { useLocation } from 'react-router';
import './party-chat-dock.css';
import { PartyWorkspace } from './PartyWorkspace';
import { useParty } from './useParty';

export function PartyChatDock() {
  const { value } = useParty();
  const { pathname } = useLocation();
  const party = value?.party;
  return party && !value?.roleMismatch && pathname !== '/game/party' ? (
    <PartyDrawer
      key={party.id}
      inBattle={pathname.startsWith('/game/combat-v6/')}
    />
  ) : null;
}

function PartyDrawer({ inBattle }: { inBattle: boolean }) {
  const { value, unread } = useParty();
  const approvals = value?.incoming.length ?? 0;
  const [open, setOpen] = useState(false);
  const [position, setPosition] = useState<{
    edge: 'left' | 'right';
    top: number;
  }>();
  const pointer = useRef<{ id: number; x: number; y: number; moved: boolean }>(
    null,
  );
  const skipClick = useRef(false);
  useEffect(() => {
    if (!open) return;
    const close = () => setOpen(false);
    window.addEventListener('popstate', close);
    return () => window.removeEventListener('popstate', close);
  }, [open]);

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
        aria-label={[
          '队伍',
          ...(unread ? [`${unread > 99 ? '99+' : unread} 条传音`] : []),
          ...(approvals ? [`${approvals} 条待审申请`] : []),
        ].join('，')}
        aria-haspopup="dialog"
        aria-expanded={open}
        onPointerDown={begin}
        onPointerMove={move}
        onPointerUp={end}
        onPointerCancel={end}
        onClick={(event) => {
          if (event.detail && skipClick.current) return;
          setOpen(true);
        }}
      >
        <GameIcon value="💬" />
        <span>队伍</span>
        {(unread > 0 || approvals > 0) && (
          <span className="party-dock-indicators" aria-hidden="true">
            {unread > 0 && (
              <b className="font-mono" data-telegram>
                {unread > 99 ? '99+' : unread}
              </b>
            )}
            {approvals > 0 && <b className="font-mono">{approvals}</b>}
          </span>
        )}
      </button>
      <InkDetailDrawer
        isOpen={open}
        onClose={() => setOpen(false)}
        title="队伍"
        size="sm"
        className="h-[calc(var(--overlay-viewport-height,100dvh)*0.76)] md:h-full"
        bodyClassName="flex flex-col overflow-hidden pt-2"
      >
        {open && (
          <PartyWorkspace compact initialTab={inBattle ? 'chat' : 'party'} />
        )}
      </InkDetailDrawer>
    </>
  );
}
