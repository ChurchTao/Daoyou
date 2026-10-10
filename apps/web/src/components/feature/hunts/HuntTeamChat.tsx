import { InkButton } from '@app/components/ui/InkButton';
import { InkDetailDrawer } from '@app/components/ui/InkDetailDrawer';
import { InkInput } from '@app/components/ui/InkInput';
import { apiFetch } from '@app/lib/api/fetch';
import { realtimeClient } from '@app/lib/realtime/realtimeClient';
import {
  HUNT_TEAM_CHAT_MAX_CHARS,
  type HuntTeamChatMessage,
} from '@daoyou/contracts/hunts';
import type { HuntTeam } from '@daoyou/game-domain/hunts';
import { useEffect, useRef, useState } from 'react';

async function readChat<T>(url: string, init?: RequestInit): Promise<T> {
  const response = await apiFetch(url, init);
  const json = (await response.json().catch(() => null)) as {
    success?: boolean;
    error?: string;
    data?: T;
  } | null;
  if (!response.ok || !json?.success || json.data === undefined) {
    throw new Error(
      typeof json?.error === 'string' ? json.error : '暂时未能传音',
    );
  }
  return json.data;
}

function mergeMessages(
  current: HuntTeamChatMessage[],
  incoming: HuntTeamChatMessage[],
) {
  const byId = new Map(current.map((message) => [message.id, message]));
  for (const message of incoming) byId.set(message.id, message);
  return [...byId.values()].sort(
    (left, right) =>
      left.createdAt.localeCompare(right.createdAt) ||
      left.id.localeCompare(right.id),
  );
}

export function HuntTeamChat({
  team,
  actorId,
}: {
  team: HuntTeam;
  actorId: string;
}) {
  const [messages, setMessages] = useState<HuntTeamChatMessage[]>([]);
  const [text, setText] = useState('');
  const [error, setError] = useState('');
  const [pending, setPending] = useState(false);
  const [cooling, setCooling] = useState(false);
  const [open, setOpen] = useState(false);
  const [seenId, setSeenId] = useState<string | null>(null);
  const logRef = useRef<HTMLDivElement>(null);
  const stickRef = useRef(true);
  const loadedRef = useRef(false);
  const openRef = useRef(false);
  const coolTimerRef = useRef<number | null>(null);
  const teamId = team.id;
  const length = Array.from(text).length;
  const seenIndex = messages.findIndex((message) => message.id === seenId);
  const unread =
    open || seenId === null
      ? 0
      : messages
          .slice(seenIndex + 1)
          .filter((message) => message.senderCultivatorId !== actorId).length;
  const rememberLatest = (list: HuntTeamChatMessage[]) => {
    setSeenId(list.at(-1)?.id ?? '');
  };

  useEffect(
    () => () => {
      if (coolTimerRef.current !== null)
        window.clearTimeout(coolTimerRef.current);
    },
    [],
  );

  useEffect(() => {
    if (!open || !stickRef.current) return;
    const scroller = logRef.current?.parentElement;
    if (scroller) scroller.scrollTop = scroller.scrollHeight;
  }, [messages, open]);

  useEffect(() => {
    const scroller = logRef.current?.parentElement;
    if (!open || !scroller) return;
    const onScroll = () => {
      stickRef.current =
        scroller.scrollHeight - scroller.scrollTop - scroller.clientHeight < 48;
    };
    scroller.addEventListener('scroll', onScroll);
    return () => scroller.removeEventListener('scroll', onScroll);
  }, [open]);

  useEffect(() => {
    let disposed = false;
    const abort = new AbortController();
    const load = async () => {
      try {
        const data = await readChat<{ messages: HuntTeamChatMessage[] }>(
          `/api/hunts/teams/${teamId}/chat`,
          { signal: abort.signal },
        );
        if (!disposed) {
          if (!loadedRef.current) setError('');
          loadedRef.current = true;
          setMessages((current) => mergeMessages(current, data.messages));
          setSeenId(
            (current) =>
              current ??
              (openRef.current ? null : (data.messages.at(-1)?.id ?? '')),
          );
        }
      } catch (cause) {
        if (abort.signal.aborted || disposed || loadedRef.current) return;
        setError(cause instanceof Error ? cause.message : '暂时未能传音');
      }
    };
    void load();
    const timer = setInterval(() => {
      if (document.visibilityState === 'visible') void load();
    }, 2000);
    return () => {
      disposed = true;
      abort.abort();
      clearInterval(timer);
    };
  }, [teamId]);

  useEffect(
    () =>
      realtimeClient.subscribe('hunt-team.chat', (event) => {
        if (event.payload.teamId !== teamId) return;
        stickRef.current = true;
        setMessages((current) => mergeMessages(current, [event.payload]));
        if (openRef.current) setSeenId(event.payload.id);
      }),
    [teamId],
  );

  const send = async () => {
    const body = text.trim();
    if (pending || cooling || !body || !actorId) return;
    setPending(true);
    setError('');
    try {
      const message = await readChat<HuntTeamChatMessage>(
        `/api/hunts/teams/${teamId}/chat`,
        {
          method: 'POST',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify({ text: body }),
        },
      );
      stickRef.current = true;
      setMessages((current) => mergeMessages(current, [message]));
      if (openRef.current) setSeenId(message.id);
      setText('');
      setCooling(true);
      if (coolTimerRef.current !== null)
        window.clearTimeout(coolTimerRef.current);
      coolTimerRef.current = window.setTimeout(() => {
        coolTimerRef.current = null;
        setCooling(false);
      }, 1000);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : '暂时未能传音');
    } finally {
      setPending(false);
    }
  };

  const openDrawer = () => {
    stickRef.current = true;
    openRef.current = true;
    setOpen(true);
    rememberLatest(messages);
  };
  const composer = (
    <ChatComposer
      text={text}
      length={length}
      pending={pending}
      cooling={cooling}
      error={error}
      onChange={setText}
      onSubmit={() => void send()}
    />
  );

  return (
    <>
      <section className="border-ink/15 space-y-2 border border-dashed px-3 py-3">
        <div className="flex items-center justify-between gap-3">
          <p className="text-ink-secondary text-sm">队伍传音</p>
          <span className="flex items-center gap-2">
            {unread > 0 ? (
              <span className="bg-crimson text-bgpaper inline-flex min-w-4 items-center justify-center rounded-full px-1 text-[0.62rem] leading-4">
                {unread > 9 ? '9+' : unread}
              </span>
            ) : null}
            <InkButton variant="secondary" onClick={openDrawer}>
              展开
            </InkButton>
          </span>
        </div>
        <ChatLog messages={messages.slice(-5)} leaderId={team.leaderId} />
        {composer}
      </section>
      <InkDetailDrawer
        isOpen={open}
        onClose={() => {
          openRef.current = false;
          setOpen(false);
          rememberLatest(messages);
        }}
        title="队伍传音"
        size="md"
        footer={composer}
      >
        <div ref={logRef} className="flex min-h-full flex-col justify-end">
          <ChatLog messages={messages} leaderId={team.leaderId} />
        </div>
      </InkDetailDrawer>
    </>
  );
}

function ChatLog({
  messages,
  leaderId,
}: {
  messages: HuntTeamChatMessage[];
  leaderId: string;
}) {
  if (messages.length === 0) {
    return <p className="text-ink-secondary py-2 text-sm">还没有人说话。</p>;
  }
  return (
    <ol role="log" className="text-sm">
      {messages.map((message) => (
        <li
          key={message.id}
          className="grid grid-cols-[3.25rem_minmax(0,1fr)] gap-x-3 py-1.5"
        >
          <time
            dateTime={message.createdAt}
            title={new Date(message.createdAt).toLocaleString('zh-CN', {
              hour12: false,
            })}
            className="text-ink-muted pt-0.5 font-mono text-xs leading-6 whitespace-nowrap"
          >
            {new Date(message.createdAt).toLocaleTimeString('zh-CN', {
              hour: '2-digit',
              minute: '2-digit',
              hour12: false,
            })}
          </time>
          <div className="min-w-0">
            <p className="text-ink-secondary text-xs leading-6">
              {message.senderName}
              {message.senderCultivatorId === leaderId ? (
                <span className="text-crimson"> · 队长</span>
              ) : null}
            </p>
            <p className="text-ink leading-6 break-words">{message.text}</p>
          </div>
        </li>
      ))}
    </ol>
  );
}

function ChatComposer({
  text,
  length,
  pending,
  cooling,
  error,
  onChange,
  onSubmit,
}: {
  text: string;
  length: number;
  pending: boolean;
  cooling: boolean;
  error: string;
  onChange: (value: string) => void;
  onSubmit: () => void;
}) {
  return (
    <form
      className="space-y-2"
      onSubmit={(event) => {
        event.preventDefault();
        onSubmit();
      }}
    >
      {error ? (
        <p role="alert" className="text-crimson text-sm">
          {error}
        </p>
      ) : null}
      <div className="flex items-center gap-2">
        <div className="min-w-0 flex-1">
          <InkInput
            value={text}
            size="sm"
            placeholder="交代战术或号令"
            disabled={pending}
            onChange={(next) => {
              onChange(
                Array.from(next).slice(0, HUNT_TEAM_CHAT_MAX_CHARS).join(''),
              );
            }}
          />
        </div>
        <span className="text-ink-muted shrink-0 font-mono text-xs">
          {length}/{HUNT_TEAM_CHAT_MAX_CHARS}
        </span>
        <InkButton
          type="submit"
          disabled={pending || cooling || text.trim().length < 1}
          pending={pending}
          pendingLabel="发送中"
        >
          发送
        </InkButton>
      </div>
    </form>
  );
}
