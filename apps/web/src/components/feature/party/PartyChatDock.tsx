import { GameIcon } from '@app/components/ui/GameIcon';
import { useRef, useState, type PointerEvent } from 'react';
import { useLocation, useSearchParams } from 'react-router';
import './party-chat-dock.css';
import { PartyWorkspace } from './PartyWorkspace';
import { useParty, type PartyRecruitmentFocus } from './useParty';

export function PartyChatDock() {
  const { value, unread, drawer, openParty, closeParty } = useParty();
  const { key, pathname } = useLocation();
  const [params, setParams] = useSearchParams();
  const id = params.get('partyJoin');
  const hunt = params.get('hunt');
  const focus: PartyRecruitmentFocus | undefined =
    pathname === '/game/ancient-demon-invasion'
      ? { kind: 'invasion' }
      : pathname === '/game/hunt-team' || (pathname === '/game/map-v2' && hunt)
        ? { kind: 'hunt' }
        : pathname === '/game/arena'
          ? { kind: 'arena' }
          : undefined;
  const visible =
    !!focus ||
    !!id ||
    (!!value?.party && !value.roleMismatch) ||
    ['/game', '/game/'].includes(pathname);
  const localDrawer = drawer?.routeKey === key ? drawer : undefined;
  const open = !!id || !!localDrawer;
  const inBattle = pathname.startsWith('/game/combat-v6/');
  const approvals = value?.incoming.length ?? 0;
  const [position, setPosition] = useState<{
    edge: 'left' | 'right';
    top: number;
  }>();
  const pointer = useRef<{ id: number; x: number; y: number; moved: boolean }>(
    null,
  );
  const skipClick = useRef(false);
  const inviteQuery = new URLSearchParams();
  for (const name of ['kind', 'eventId', 'week', 'recruitmentId']) {
    const value = params.get(name);
    if (value) inviteQuery.set(name, value);
  }
  const invite = id
    ? `/${encodeURIComponent(id)}/preview?${inviteQuery}`
    : undefined;

  function close() {
    closeParty();
    if (id) {
      const next = new URLSearchParams(params);
      for (const name of [
        'partyJoin',
        'kind',
        'eventId',
        'week',
        'recruitmentId',
      ])
        next.delete(name);
      setParams(next, { replace: true });
    }
  }

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

  if (!visible && !open) return null;

  return (
    <>
      {visible && (
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
            openParty(focus);
          }}
        >
          <GameIcon value="🚩" />
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
      )}
      {open && (
        <PartyWorkspace
          key={key}
          initialTab={inBattle ? 'chat' : 'party'}
          invite={invite}
          focus={localDrawer?.focus ?? focus}
          inHuntOverlay={pathname === '/game/map-v2' && !!hunt}
          onClose={close}
        />
      )}
    </>
  );
}
