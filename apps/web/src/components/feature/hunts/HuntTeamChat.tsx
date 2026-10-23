import { FriendTargetModal } from '@app/components/feature/friends';
import { WorldChatMessageItem } from '@app/components/feature/world-chat/WorldChatMessageItem';
import { WorldChatTextComposer } from '@app/components/feature/world-chat/WorldChatTextComposer';
import { useInkUI } from '@app/components/providers/InkUIProvider';
import { InkButton } from '@app/components/ui/InkButton';
import { InkNotice } from '@app/components/ui/InkNotice';
import { apiFetch } from '@app/lib/api/fetch';
import { realtimeClient } from '@app/lib/realtime/realtimeClient';
import { REALM_VALUES } from '@daoyou/constants/realms';
import {
  HUNT_TEAM_CHAT_MAX_CHARS,
  type HuntTeamChatMessage,
} from '@daoyou/contracts/hunts';
import type { WorldChatMessageDTO } from '@daoyou/contracts/world-chat';
import type { HuntTeam } from '@daoyou/game-domain/hunts';
import {
  Fragment,
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
} from 'react';

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

function normalize(message: HuntTeamChatMessage): HuntTeamChatMessage {
  return {
    ...message,
    senderRealm: message.senderRealm ?? '',
    senderRealmStage: message.senderRealmStage ?? '',
    reply: message.reply ?? null,
  };
}

function mergeMessages(
  current: HuntTeamChatMessage[],
  incoming: HuntTeamChatMessage[],
) {
  const byId = new Map(current.map((message) => [message.id, message]));
  for (const message of incoming) byId.set(message.id, normalize(message));
  return [...byId.values()].sort(
    (left, right) =>
      left.createdAt.localeCompare(right.createdAt) ||
      left.id.localeCompare(right.id),
  );
}

function dateLabel(createdAt: string) {
  const date = new Date(createdAt);
  const today = new Date();
  const yesterday = new Date();
  yesterday.setDate(today.getDate() - 1);
  if (date.toDateString() === today.toDateString()) return '今天';
  if (date.toDateString() === yesterday.toDateString()) return '昨天';
  return new Intl.DateTimeFormat('zh-CN', {
    ...(date.getFullYear() !== today.getFullYear()
      ? { year: 'numeric' as const }
      : {}),
    month: 'long',
    day: 'numeric',
  }).format(date);
}

function toWorldMessage(
  message: HuntTeamChatMessage,
  team: HuntTeam,
): WorldChatMessageDTO {
  const member = team.members.find(
    (item) => item.cultivatorId === message.senderCultivatorId,
  );
  const realm = (REALM_VALUES as readonly string[]).includes(
    message.senderRealm,
  )
    ? message.senderRealm
    : (member?.realm ?? '炼气');
  return {
    id: message.id,
    sequence: 0,
    clientMessageId: null,
    reply: message.reply
      ? {
          messageId: message.reply.messageId,
          senderName: message.reply.senderName,
          messageType: 'text',
          summary: message.reply.summary,
          availability: 'available',
        }
      : null,
    channel: 'world',
    sectId: null,
    senderUserId: member?.userId ?? '',
    senderCultivatorId: message.senderCultivatorId,
    senderName: message.senderName,
    senderRealm: realm,
    senderRealmStage: message.senderRealmStage || realm,
    messageType: 'text',
    textContent: message.text,
    payload: { text: message.text },
    status: 'active',
    createdAt: message.createdAt,
  };
}

export function HuntTeamChat({
  team,
  actorId,
}: {
  team: HuntTeam;
  actorId: string;
}) {
  const { pushToast } = useInkUI();
  const [messages, setMessages] = useState<HuntTeamChatMessage[]>([]);
  const [text, setText] = useState('');
  const [reply, setReply] = useState<WorldChatMessageDTO | null>(null);
  const [loadError, setLoadError] = useState('');
  const [sendError, setSendError] = useState('');
  const [reloadKey, setReloadKey] = useState(0);
  const [pending, setPending] = useState(false);
  const [pendingText, setPendingText] = useState('');
  const [cooldownUntil, setCooldownUntil] = useState(0);
  const [now, setNow] = useState(() => Date.now());
  const [following, setFollowing] = useState(true);
  const [seenId, setSeenId] = useState<string | null>(null);
  const [loaded, setLoaded] = useState(false);
  const [highlight, setHighlight] = useState<string | null>(null);
  const [friendTargetId, setFriendTargetId] = useState<string | null>(null);
  const logRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const loadedRef = useRef(false);
  const followingRef = useRef(true);
  const teamId = team.id;
  const cooldownRemaining = Math.max(
    0,
    Math.ceil((cooldownUntil - now) / 1000),
  );
  const seenIndex = messages.findIndex((message) => message.id === seenId);
  const pendingCount =
    seenId === null || seenIndex < 0
      ? 0
      : messages
          .slice(seenIndex + 1)
          .filter((message) => message.senderCultivatorId !== actorId).length;
  const displayMessages = useMemo(
    () => messages.map((message) => toWorldMessage(message, team)),
    [messages, team],
  );
  const rememberLatest = (list: HuntTeamChatMessage[]) => {
    const id = list.at(-1)?.id;
    if (id) setSeenId(id);
  };

  useEffect(() => {
    followingRef.current = following;
  }, [following]);
  useLayoutEffect(() => {
    const input = inputRef.current;
    if (!input) return;
    input.style.height = 'auto';
    input.style.height = `${Math.min(128, Math.max(44, input.scrollHeight))}px`;
  }, [text]);
  useEffect(() => {
    if (cooldownUntil <= Date.now()) return;
    const timer = window.setInterval(() => setNow(Date.now()), 250);
    return () => window.clearInterval(timer);
  }, [cooldownUntil]);
  useEffect(() => {
    if (!highlight) return;
    const timer = window.setTimeout(() => setHighlight(null), 1600);
    return () => window.clearTimeout(timer);
  }, [highlight]);
  useLayoutEffect(() => {
    if (!following) return;
    const scroller = logRef.current;
    if (scroller) scroller.scrollTop = scroller.scrollHeight;
  }, [messages, pendingText, following]);
  useEffect(() => {
    const scroller = logRef.current;
    if (!scroller) return;
    const onScroll = () => {
      const next =
        scroller.scrollHeight - scroller.scrollTop - scroller.clientHeight < 48;
      followingRef.current = next;
      setFollowing((current) => (current === next ? current : next));
    };
    scroller.addEventListener('scroll', onScroll, { passive: true });
    return () => scroller.removeEventListener('scroll', onScroll);
  }, []);

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
          if (!loadedRef.current) setLoadError('');
          loadedRef.current = true;
          setLoaded(true);
          setLoadError('');
          setMessages((current) => mergeMessages(current, data.messages));
          setSeenId((current) => current ?? data.messages.at(-1)?.id ?? null);
        }
      } catch (cause) {
        if (abort.signal.aborted || disposed || loadedRef.current) return;
        setLoadError(cause instanceof Error ? cause.message : '暂时未能传音');
      }
    };
    void load();
    const timer = window.setInterval(() => {
      if (document.visibilityState === 'visible') void load();
    }, 2000);
    return () => {
      disposed = true;
      abort.abort();
      window.clearInterval(timer);
    };
  }, [teamId, reloadKey]);

  useEffect(
    () =>
      realtimeClient.subscribe('hunt-team.chat', (event) => {
        if (event.payload.teamId !== teamId) return;
        setMessages((current) => mergeMessages(current, [event.payload]));
        if (followingRef.current) setSeenId(event.payload.id);
      }),
    [teamId],
  );

  const send = async () => {
    const body = text.trim();
    if (pending || cooldownRemaining > 0 || !body || !actorId) return;
    const quoted = reply;
    setText('');
    setReply(null);
    setPending(true);
    setPendingText(body);
    setSendError('');
    setFollowing(true);
    followingRef.current = true;
    try {
      const message = await readChat<HuntTeamChatMessage>(
        `/api/hunts/teams/${teamId}/chat`,
        {
          method: 'POST',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify({
            text: body,
            ...(quoted ? { replyToMessageId: quoted.id } : {}),
          }),
        },
      );
      setMessages((current) => mergeMessages(current, [message]));
      setSeenId(message.id);
      setCooldownUntil(Date.now() + 1000);
      setNow(Date.now());
    } catch (cause) {
      const message = cause instanceof Error ? cause.message : '暂时未能传音';
      const wait = /请\s*(\d+)\s*秒/.exec(message);
      if (wait) {
        setCooldownUntil(Date.now() + Number(wait[1]) * 1000);
        setNow(Date.now());
      }
      setText((current) => current || body);
      setReply((current) => current ?? quoted);
      setSendError(message);
    } finally {
      setPending(false);
      setPendingText('');
    }
  };

  const locate = (id: string) => {
    const node = logRef.current?.querySelector(
      `[data-message-id="${CSS.escape(id)}"]`,
    );
    if (!(node instanceof HTMLElement)) {
      pushToast({ message: '原消息已不在记录中', tone: 'warning' });
      return;
    }
    followingRef.current = false;
    setFollowing(false);
    setHighlight(id);
    node.scrollIntoView({ block: 'center' });
  };
  const composer = (
    <WorldChatTextComposer
      inputId="hunt-team-chat-input"
      inputRef={inputRef}
      draft={text}
      maxChars={HUNT_TEAM_CHAT_MAX_CHARS}
      placeholder="与道友说点什么……"
      label="传音内容"
      posting={pending}
      cooldownRemaining={cooldownRemaining}
      reply={reply}
      onDraftChange={setText}
      onClearReply={() => setReply(null)}
      onSend={() => void send()}
    />
  );

  return (
    <section
      aria-label="队伍传音"
      className="mt-4 flex min-h-64 flex-1 flex-col"
    >
      <div
        ref={logRef}
        className="battle-scroll min-h-0 flex-1 overflow-y-auto"
      >
        <div className="flex min-h-full flex-col justify-end">
          {loadError ? (
            <InkNotice tone="warning">
              {loadError}{' '}
              <InkButton onClick={() => setReloadKey((value) => value + 1)}>
                重试
              </InkButton>
            </InkNotice>
          ) : null}
          {!loaded && !loadError ? (
            <p className="text-ink-secondary py-8 text-center text-sm">
              正在接引传音……
            </p>
          ) : null}
          {loaded && displayMessages.length === 0 ? (
            <p className="text-ink-secondary py-8 text-center">
              暂无传音，向道友问声好吧
            </p>
          ) : null}
          {displayMessages.map((message, index) => {
            const previous = displayMessages[index - 1];
            const date = dateLabel(message.createdAt);
            const differentDate =
              !previous || date !== dateLabel(previous.createdAt);
            const elapsed = previous
              ? new Date(message.createdAt).getTime() -
                new Date(previous.createdAt).getTime()
              : Infinity;
            const grouped =
              !differentDate &&
              !!message.senderCultivatorId &&
              previous.senderCultivatorId === message.senderCultivatorId &&
              previous.senderName === message.senderName &&
              previous.senderRealm === message.senderRealm &&
              previous.senderRealmStage === message.senderRealmStage &&
              !message.reply &&
              !previous.reply &&
              elapsed >= 0 &&
              elapsed < 120_000;
            return (
              <Fragment key={message.id}>
                {differentDate ? (
                  <div className="text-ink-secondary flex items-center gap-3 py-3 text-xs">
                    <span className="bg-ink/10 h-px flex-1" />
                    <span>{date}</span>
                    <span className="bg-ink/10 h-px flex-1" />
                  </div>
                ) : null}
                <WorldChatMessageItem
                  message={message}
                  grouped={grouped}
                  highlighted={highlight === message.id}
                  onSelectFriend={setFriendTargetId}
                  onReply={(item) => {
                    setReply(item);
                    inputRef.current?.focus();
                  }}
                  onLocateReply={locate}
                />
              </Fragment>
            );
          })}
          {pendingText ? (
            <div className="bg-teal/5 my-1.5 ml-9 px-2.5 py-1.5 text-sm leading-6">
              <p className="break-words whitespace-pre-wrap">{pendingText}</p>
              <p className="text-ink-secondary mt-1 text-sm">发送中……</p>
            </div>
          ) : null}
        </div>
      </div>
      <div className="border-ink/15 shrink-0 space-y-2 border-t border-dashed pt-2">
        {sendError ? (
          <InkNotice tone="warning">
            {sendError} <InkButton onClick={() => void send()}>重试</InkButton>
          </InkNotice>
        ) : null}
        {!following ? (
          <div className="flex justify-center">
            <InkButton
              variant="primary"
              className="min-h-11"
              onClick={() => {
                followingRef.current = true;
                setFollowing(true);
                rememberLatest(messages);
              }}
            >
              {pendingCount > 0 ? `↓ ${pendingCount} 条新消息` : '↓ 回到最新'}
            </InkButton>
          </div>
        ) : null}
        {composer}
      </div>
      <FriendTargetModal
        targetId={friendTargetId}
        onClose={() => setFriendTargetId(null)}
      />
    </section>
  );
}
