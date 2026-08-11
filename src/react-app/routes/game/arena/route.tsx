import {
  NpcConversation,
  RoomView,
  type RoomActorView,
} from '@app/components/feature/room';
import { GameSceneFrame } from '@app/components/game-shell';
import { realtimeClient } from '@app/lib/realtime/realtimeClient';
import { usePlayerSession } from '@app/lib/resources/player';
import type {
  ArenaRoomResponseV1,
  ArenaRoomSeatV1,
  ArenaRoomV1,
  ArenaStartResponseV1,
  ArenaTeamIdV1,
} from '@shared/contracts/arena';
import {
  ARENA_ROOM_MAX_SEATS_PER_TEAM,
  allArenaSeatsReady,
  hasBothArenaTeams,
  isArenaRoomActive,
} from '@shared/contracts/arena';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router';

const ARENA_ROOM_TOUCH_INTERVAL_MS = 5 * 60_000;

const ACTORS: readonly RoomActorView[] = [
  {
    id: 'wang-hu',
    sigil: '虎',
    name: '王虎',
    identity: '擂台切磋主持人',
    responsibility: '简要说明切磋规则。',
    appearance: 'person',
  },
  {
    id: 'ring',
    sigil: '🥁',
    name: '擂台',
    identity: '切磋设施',
    responsibility: '创建房间，或凭六位数字邀请码加入切磋。',
    appearance: 'facility',
  },
];

export default function ArenaPage() {
  const navigate = useNavigate();
  const session = usePlayerSession();
  const [selectedId, setSelectedId] = useState<string>();
  const [room, setRoom] = useState<ArenaRoomV1 | null>(null);
  const [loading, setLoading] = useState(true);
  const currentCultivatorId = session.data?.activeCultivator?.id;

  const applyRoom = useCallback((next: ArenaRoomV1 | null) => {
    setRoom((current) => {
      if (!next) return null;
      if (current?.roomId === next.roomId && current.revision > next.revision) {
        return current;
      }
      return next;
    });
  }, []);

  const refreshRoom = useCallback(async () => {
    const response = await requestArena<{ room: ArenaRoomV1 | null }>(
      '/api/arena/room',
    );
    applyRoom(response.room);
  }, [applyRoom]);

  useEffect(() => {
    let cancelled = false;
    void requestArena<{ room: ArenaRoomV1 | null }>('/api/arena/room')
      .then((response) => {
        if (!cancelled) setRoom(response.room);
      })
      .catch(() => undefined)
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    realtimeClient.enableChannel('arena-room');
    const unsubscribe = realtimeClient.subscribe(
      'arena-room.changed',
      ({ payload }) => {
        if (payload.room) {
          applyRoom(payload.room);
          return;
        }
        void refreshRoom().catch(() => undefined);
      },
    );
    const unsubscribeStatus = realtimeClient.subscribeStatus((status) => {
      if (status.channels['arena-room'].state === 'online') {
        void refreshRoom().catch(() => undefined);
      }
    });
    return () => {
      unsubscribe();
      unsubscribeStatus();
      realtimeClient.disableChannel('arena-room');
    };
  }, [applyRoom, refreshRoom]);

  useEffect(() => {
    if (!room || !isArenaRoomActive(room.status)) return;
    const timer = window.setInterval(() => {
      void requestArena<ArenaRoomResponseV1>(
        `/api/arena/rooms/${room.roomId}/touch`,
        jsonRequest({}),
      )
        .then((response) => applyRoom(response.room))
        .catch(() => void refreshRoom().catch(() => undefined));
    }, ARENA_ROOM_TOUCH_INTERVAL_MS);
    return () => window.clearInterval(timer);
  }, [applyRoom, refreshRoom, room]);

  useEffect(() => {
    if (
      !room?.battleMatchId ||
      (room.status !== 'starting' && room.status !== 'in_battle')
    )
      return;
    navigate(`/game/battle/live/${encodeURIComponent(room.battleMatchId)}`);
  }, [navigate, room?.battleMatchId, room?.status]);

  useEffect(() => {
    if (room?.status !== 'starting' || room.battleMatchId) return;
    const timer = window.setInterval(
      () => void refreshRoom().catch(() => undefined),
      2_000,
    );
    return () => window.clearInterval(timer);
  }, [refreshRoom, room?.battleMatchId, room?.status]);

  return (
    <GameSceneFrame
      variant="workflow"
      description="无消耗的公共擂台切磋。创建房间或凭邀请码入场，准备完毕后即可开始。"
    >
      <RoomView
        eyebrow="擂台场"
        description="青石擂台立在场中，来客可创建房间或凭邀请码入场切磋。"
        actors={ACTORS.map((actor) =>
          actor.id === 'ring' && room
            ? { ...actor, status: { label: '已有候场房间', tone: 'active' } }
            : actor,
        )}
        selectedId={selectedId}
        onSelect={setSelectedId}
        prompt="点击擂台入场；若想了解细则，可问王虎"
        promptDetail="这里是无消耗的自由切磋，双方到齐并准备后即可开始。"
        detail={
          selectedId === 'wang-hu' ? (
            <WangHuConversation onExit={() => setSelectedId(undefined)} />
          ) : selectedId === 'ring' ? (
            <ArenaFacility
              room={room}
              loading={loading}
              currentCultivatorId={currentCultivatorId}
              onRoom={applyRoom}
              onExit={() => setSelectedId(undefined)}
            />
          ) : undefined
        }
      />
    </GameSceneFrame>
  );
}

function WangHuConversation({ onExit }: { onExit(): void }) {
  const [topic, setTopic] = useState<'rules'>();

  return (
    <NpcConversation
      actor={ACTORS[0]!}
      messages={[
        {
          id: 'greeting',
          speaker: '王虎',
          body: '这里是无消耗的自由切磋，双方到齐并准备后即可开始。',
        },
        ...(topic === 'rules'
          ? [
              {
                id: 'rules',
                speaker: '王虎',
                body: '双方人数不必相同，每方最多四人。所有人准备后，由房主开始切磋，每回合有三十息同时定招。此间不消耗费用、物资或战斗外状态。',
              },
            ]
          : []),
      ]}
      options={[
        { id: 'rules', label: '请讲讲切磋规矩' },
        { id: 'leave', label: '我明白了', tone: 'muted' },
      ]}
      selectedOptionId={topic}
      onSelectOption={(optionId) => {
        if (optionId === 'leave') onExit();
        else if (optionId === 'rules') setTopic('rules');
      }}
    />
  );
}

function ArenaFacility({
  room,
  loading,
  currentCultivatorId,
  onRoom,
  onExit,
}: {
  room: ArenaRoomV1 | null;
  loading: boolean;
  currentCultivatorId?: string;
  onRoom(room: ArenaRoomV1 | null): void;
  onExit(): void;
}) {
  const [inviteCode, setInviteCode] = useState('');
  const [joining, setJoining] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string>();
  const [startRequestId] = useState(() => crypto.randomUUID());

  const perform = async (action: 'create' | 'join') => {
    setBusy(true);
    setError(undefined);
    try {
      const response = await requestArena<ArenaRoomResponseV1>(
        action === 'create' ? '/api/arena/rooms' : '/api/arena/rooms/join',
        {
          method: 'POST',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify(action === 'create' ? {} : { inviteCode }),
        },
      );
      onRoom(response.room);
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : '擂台暂时无法入场');
    } finally {
      setBusy(false);
    }
  };

  return (
    <NpcConversation
      actor={ACTORS[1]!}
      messages={[
        {
          id: 'facility',
          body: room
            ? `你的候场房间邀请码为 ${room.inviteCode}。`
            : '创建一间房，或凭六位数字邀请码加入已有房间。入房后将自动分队。',
        },
      ]}
      busy={busy || loading}
      error={error}
      options={room ? [] : [{ id: 'leave', label: '返回场中', tone: 'muted' }]}
      onSelectOption={onExit}
    >
      {room ? (
        <ArenaRoomWorkspace
          room={room}
          currentCultivatorId={currentCultivatorId}
          busy={busy}
          onBusy={setBusy}
          onError={setError}
          onRoom={onRoom}
          startRequestId={startRequestId}
        />
      ) : (
        <div className="mt-4 space-y-2">
          <button
            type="button"
            disabled={busy || loading}
            onClick={() => void perform('create')}
            className="border-crimson/45 text-crimson hover:bg-crimson/6 focus-visible:outline-crimson w-full border-l-2 px-5 py-3 text-left disabled:opacity-50"
          >
            创建一间切磋房
          </button>

          <div>
            <button
              type="button"
              disabled={busy || loading}
              onClick={() => setJoining((current) => !current)}
              aria-expanded={joining}
              className="border-ink/20 text-ink-secondary hover:border-crimson/40 hover:text-crimson w-full border-l-2 px-5 py-3 text-left disabled:opacity-50"
            >
              已有邀请码？加入房间
            </button>

            {joining ? (
              <div className="bg-ink/[0.018] mt-3 space-y-3 px-4 py-4 sm:px-5">
                <ArenaInviteCodeInput
                  value={inviteCode}
                  onChange={setInviteCode}
                  disabled={busy}
                />
                <button
                  type="button"
                  disabled={busy || inviteCode.length !== 6}
                  onClick={() => void perform('join')}
                  className="border-crimson/45 text-crimson hover:bg-crimson/6 w-full border-l-2 px-5 py-3 text-left disabled:opacity-50"
                >
                  加入房间
                </button>
              </div>
            ) : null}
          </div>
        </div>
      )}
    </NpcConversation>
  );
}

function ArenaRoomWorkspace({
  room,
  currentCultivatorId,
  busy,
  onBusy,
  onError,
  onRoom,
  startRequestId,
}: {
  room: ArenaRoomV1;
  currentCultivatorId?: string;
  busy: boolean;
  onBusy(value: boolean): void;
  onError(value: string | undefined): void;
  onRoom(room: ArenaRoomV1 | null): void;
  startRequestId: string;
}) {
  const [copied, setCopied] = useState(false);
  const current = useMemo(
    () => findCurrentSeat(room, currentCultivatorId),
    [currentCultivatorId, room],
  );
  const isHost = current?.seat.userId === room.hostUserId;
  const canStart =
    isHost &&
    isArenaRoomActive(room.status) &&
    hasBothArenaTeams(room) &&
    allArenaSeatsReady(room);

  const mutate = async (
    action: 'ready' | 'switch-team' | 'leave',
    body: Record<string, unknown>,
  ) => {
    onBusy(true);
    onError(undefined);
    try {
      const response = await requestArena<{ room: ArenaRoomV1 | null }>(
        `/api/arena/rooms/${room.roomId}/${action}`,
        jsonRequest(body),
      );
      onRoom(response.room);
    } catch (reason) {
      onError(reason instanceof Error ? reason.message : '擂台房间操作失败');
    } finally {
      onBusy(false);
    }
  };

  const copyInviteCode = async () => {
    try {
      await navigator.clipboard.writeText(room.inviteCode);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1800);
    } catch {
      onError('无法复制邀请码，请手动记下这六位数字');
    }
  };

  const startBattle = async () => {
    onBusy(true);
    onError(undefined);
    try {
      const response = await requestArena<ArenaStartResponseV1>(
        `/api/arena/rooms/${room.roomId}/start`,
        jsonRequest({ requestId: room.startRequestId ?? startRequestId }),
      );
      onRoom(response.room);
    } catch (reason) {
      onError(reason instanceof Error ? reason.message : '开擂失败');
    } finally {
      onBusy(false);
    }
  };

  return (
    <div className="mt-4 space-y-4">
      <div className="bg-ink/[0.025] flex flex-wrap items-center justify-between gap-3 px-4 py-3">
        <div>
          <p className="text-ink-secondary text-xs tracking-[0.18em]">
            六位邀请码
          </p>
          <p className="mt-1 font-mono text-2xl tracking-[0.35em]">
            {room.inviteCode}
          </p>
        </div>
        <button
          type="button"
          disabled={busy}
          onClick={() => void copyInviteCode()}
          className="border-ink/20 text-ink-secondary hover:border-crimson/40 hover:text-crimson border px-4 py-2 text-sm disabled:opacity-50"
        >
          {copied ? '已复制' : '复制邀请码'}
        </button>
      </div>

      <div className="grid gap-3 sm:grid-cols-2">
        {(['alpha', 'beta'] as const).map((teamId) => (
          <ArenaTeamPanel
            key={teamId}
            teamId={teamId}
            seats={room.teams[teamId]}
            hostUserId={room.hostUserId}
            currentCultivatorId={currentCultivatorId}
          />
        ))}
      </div>

      {current ? (
        <div className="grid gap-2 sm:grid-cols-3">
          <button
            type="button"
            disabled={busy || !isArenaRoomActive(room.status)}
            onClick={() => void mutate('ready', { ready: !current.seat.ready })}
            className="border-crimson/45 text-crimson bg-crimson/6 border px-4 py-3 text-sm disabled:opacity-45"
          >
            {current.seat.ready ? '取消准备' : '准备完毕'}
          </button>
          <button
            type="button"
            disabled={
              busy ||
              !isArenaRoomActive(room.status) ||
              room.teams[current.teamId === 'alpha' ? 'beta' : 'alpha']
                .length >= ARENA_ROOM_MAX_SEATS_PER_TEAM
            }
            onClick={() => void mutate('switch-team', {})}
            className="border-ink/20 text-ink-secondary hover:border-crimson/40 hover:text-crimson border px-4 py-3 text-sm disabled:opacity-45"
          >
            换到{current.teamId === 'alpha' ? '赤方' : '青方'}
          </button>
          <button
            type="button"
            disabled={busy || !isArenaRoomActive(room.status)}
            onClick={() => void mutate('leave', {})}
            className="border-ink/20 text-ink-secondary hover:border-crimson/40 hover:text-crimson border px-4 py-3 text-sm disabled:opacity-45"
          >
            离开房间
          </button>
        </div>
      ) : (
        <p className="text-crimson text-sm">
          当前修士不在此房间中，请刷新页面。
        </p>
      )}

      {isHost ? (
        <button
          type="button"
          disabled={busy || (!canStart && room.status !== 'starting')}
          onClick={() => void startBattle()}
          className="border-crimson/50 bg-crimson/6 text-crimson w-full border border-l-2 px-5 py-3 text-left disabled:cursor-not-allowed disabled:opacity-45"
        >
          {room.status === 'starting'
            ? '开擂中，点击重试连接战斗服务'
            : '开始擂台切磋'}
        </button>
      ) : null}

      <p className="text-ink-secondary text-xs leading-6">
        {room.status === 'starting'
          ? '阵容已冻结，正在创建实时战斗对局。'
          : canStart
            ? '双方已准备完毕，房主现在可以开始切磋。'
            : '等待双方到齐并准备完毕。'}
      </p>
    </div>
  );
}

function ArenaInviteCodeInput({
  value,
  onChange,
  disabled,
}: {
  value: string;
  onChange(value: string): void;
  disabled: boolean;
}) {
  return (
    <label className="block cursor-text">
      <span className="text-ink-secondary text-sm">六位数字邀请码</span>
      <input
        id="arena-invite-code"
        aria-label="六位数字邀请码"
        inputMode="numeric"
        autoComplete="one-time-code"
        autoFocus
        maxLength={6}
        value={value}
        disabled={disabled}
        onChange={(event) =>
          onChange(event.target.value.replace(/\D/g, '').slice(0, 6))
        }
        placeholder="000000"
        className="border-ink/20 focus:border-crimson/55 focus:ring-crimson/10 placeholder:text-ink-secondary/30 mt-2 w-full border bg-transparent px-4 py-3 text-center font-mono text-xl tracking-[0.45em] transition-colors outline-none focus:ring-2 disabled:cursor-not-allowed disabled:opacity-50"
      />
    </label>
  );
}

function ArenaTeamPanel({
  teamId,
  seats,
  hostUserId,
  currentCultivatorId,
}: {
  teamId: ArenaTeamIdV1;
  seats: readonly ArenaRoomSeatV1[];
  hostUserId: string;
  currentCultivatorId?: string;
}) {
  return (
    <section className="border-ink/15 min-h-40 border p-4">
      <div className="flex items-center justify-between">
        <p className="text-ink-secondary text-xs tracking-[0.2em]">
          {teamId === 'alpha' ? '青方' : '赤方'}
        </p>
        <span className="text-ink-secondary text-xs">{seats.length} / 4</span>
      </div>
      <div className="mt-3 space-y-2">
        {seats.length ? (
          seats.map((seat) => (
            <div
              key={seat.userId}
              className="bg-ink/[0.025] flex items-center justify-between gap-3 px-3 py-2 text-sm"
            >
              <span className="min-w-0">
                <span className="block truncate">
                  {seat.displayName}
                  {seat.userId === hostUserId ? (
                    <span className="text-ink-secondary ml-2 text-xs">
                      房主
                    </span>
                  ) : null}
                  {seat.cultivatorId === currentCultivatorId ? (
                    <span className="text-crimson ml-2 text-xs">你</span>
                  ) : null}
                </span>
                <span className="text-ink-secondary mt-0.5 block text-xs">
                  境界：
                  {seat.realm && seat.realmStage
                    ? `${seat.realm}${seat.realmStage}`
                    : '未知'}
                </span>
              </span>
              <span className={seat.ready ? 'text-teal' : 'text-ink-secondary'}>
                {seat.ready ? '已准备' : '未准备'}
              </span>
            </div>
          ))
        ) : (
          <p className="text-ink-secondary py-6 text-center text-sm">
            暂无参战者
          </p>
        )}
      </div>
    </section>
  );
}

function findCurrentSeat(room: ArenaRoomV1, cultivatorId?: string) {
  if (!cultivatorId) return null;
  for (const teamId of ['alpha', 'beta'] as const) {
    const seat = room.teams[teamId].find(
      (candidate) => candidate.cultivatorId === cultivatorId,
    );
    if (seat) return { teamId, seat };
  }
  return null;
}

function jsonRequest(body: Record<string, unknown>): RequestInit {
  return {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(body),
  };
}

async function requestArena<T>(url: string, init?: RequestInit): Promise<T> {
  const response = await fetch(url, {
    credentials: 'include',
    cache: 'no-store',
    ...init,
  });
  const body = (await response.json()) as T & { error?: string };
  if (!response.ok) throw new Error(body.error ?? '擂台请求失败');
  return body;
}
