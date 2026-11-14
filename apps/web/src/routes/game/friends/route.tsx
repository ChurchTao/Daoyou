import { useChatViewport } from '@app/components/feature/chat/useChatViewport';
import { FriendTargetModal } from '@app/components/feature/friends';
import {
  socialRequest,
  useSocialQuery,
} from '@app/components/feature/friends/socialApi';
import '@app/components/feature/world-chat/worldChatViewport.css';
import { GameLoadingState, GameSceneFrame } from '@app/components/game-shell';
import { InkModal } from '@app/components/layout';
import { useInkUI } from '@app/components/providers/InkUIProvider';
import { InkButton, InkNotice } from '@app/components/ui';
import { GameIcon } from '@app/components/ui/GameIcon';
import { apiFetch } from '@app/lib/api/fetch';
import { useAuth } from '@app/lib/auth/useAuth';
import { cn } from '@app/lib/cn';
import {
  usePlayerSession,
  useUnreadMailCount,
} from '@app/lib/resources/player';
import { SYSTEM_MAIL_CONVERSATION_ID } from '@app/lib/social/mailNavigation';
import type {
  DirectConversationDTO,
  DirectConversationsPage,
} from '@daoyou/contracts/direct-messages';
import type {
  FriendCultivatorSummary,
  FriendRequestDTO,
} from '@daoyou/contracts/friends';
import { Activity, lazy, Suspense, useCallback, useRef, useState } from 'react';
import { useSearchParams } from 'react-router';
import { DirectChatPanel } from './components/DirectChatPanel';
import {
  FriendsManagement,
  type FriendsManagementTab,
} from './components/FriendsManagement';

const SystemMailPanel = lazy(async () => ({
  default: (await import('./components/SystemMailPanel')).SystemMailPanel,
}));
const MailComposer = lazy(async () => ({
  default: (await import('@app/components/mail/MailComposer')).MailComposer,
}));

type Contact = {
  key: string;
  name: string;
  friend?: FriendCultivatorSummary;
  conversation?: DirectConversationDTO;
};
const timeFormatter = new Intl.DateTimeFormat('zh-CN', {
  hour: '2-digit',
  minute: '2-digit',
});
function contactTime(value: string) {
  const date = new Date(value);
  return date.toDateString() === new Date().toDateString()
    ? timeFormatter.format(date)
    : `${date.getMonth() + 1}/${date.getDate()}`;
}

export default function FriendsPage() {
  const { user } = useAuth();
  const actorId = usePlayerSession().data?.activeCultivator?.id;
  const identity = `${user?.id}:${actorId}`;
  return <FriendsWorkspace key={identity} identity={identity} />;
}

function FriendsWorkspace({ identity }: { identity: string }) {
  const [params, setParams] = useSearchParams();
  const unreadMailCount = useUnreadMailCount() ?? 0;
  const conversationId = params.get('chat');
  const isSystemMail = conversationId === SYSTEM_MAIL_CONVERSATION_ID;
  const directConversationId = isSystemMail ? null : conversationId;
  const [mailVisited, setMailVisited] = useState(isSystemMail);
  // Browser navigation can select mail without a row click.
  if (isSystemMail && !mailVisited) setMailVisited(true);
  const [visited, setVisited] = useState<string[]>(() =>
    directConversationId ? [directConversationId] : [],
  );
  const visiblePanels = [
    ...visited.filter((id) => id !== directConversationId),
    ...(directConversationId ? [directConversationId] : []),
  ];
  const managementValue = params.get('manage') ?? params.get('tab');
  const management = ['find', 'requests', 'blocks'].includes(
    managementValue ?? '',
  )
    ? (managementValue as FriendsManagementTab)
    : null;
  const friends = useSocialQuery<{ friends: FriendCultivatorSummary[] }>(
    '/api/friends',
  );
  const composeTo = params.get('composeTo');
  const giftRecipient = friends.data?.friends.find(
    (friend) => friend.id === composeTo,
  );
  const giftObscured = Boolean(composeTo && (!friends.data || giftRecipient));
  const conversations = useSocialQuery<DirectConversationsPage>(
    '/api/direct-messages/conversations',
  );
  const requests = useSocialQuery<{ requests: FriendRequestDTO[] }>(
    '/api/friends/requests',
  );
  const [olderConversations, setOlderConversations] = useState<
    DirectConversationDTO[]
  >([]);
  const [olderCursor, setOlderCursor] = useState<string | null | undefined>(
    undefined,
  );
  const [opening, setOpening] = useState<string | null>(null);
  const [loadingOlder, setLoadingOlder] = useState(false);
  const [focusedConversation, setFocusedConversation] =
    useState<DirectConversationDTO | null>(null);
  const onConversation = useCallback(
    (conversation: DirectConversationDTO) =>
      setFocusedConversation(conversation),
    [],
  );
  const [friendDetails, setFriendDetails] =
    useState<FriendCultivatorSummary | null>(null);
  const [details, setDetails] = useState<DirectConversationDTO | null>(null);
  const [confirm, setConfirm] = useState<'remove' | 'block' | null>(null);
  const [busy, setBusy] = useState(false);
  const { pushToast } = useInkUI();
  const workspaceRef = useRef<HTMLDivElement>(null);
  const { height, keyboardViewport } = useChatViewport(workspaceRef);
  const nextCursor =
    olderCursor === undefined
      ? conversations.data?.pagination.nextCursor
      : olderCursor;
  const allConversations = [
    ...new Map(
      [
        ...olderConversations,
        ...(conversations.data?.conversations ?? []),
        ...(focusedConversation?.id === conversationId &&
        !conversations.data?.conversations.some(
          (item) => item.id === conversationId,
        )
          ? [focusedConversation]
          : []),
      ].map((item) => [item.id, item]),
    ).values(),
  ];
  const currentActorId = usePlayerSession().data?.activeCultivator?.id;
  const contacts: Contact[] = [];
  const represented = new Set<string>();
  for (const friend of friends.data?.friends ?? []) {
    const conversation = allConversations.find(
      (item) =>
        item.peer.cultivatorId === friend.id &&
        item.myCultivatorId === currentActorId,
    );
    if (conversation) represented.add(conversation.id);
    contacts.push({ key: friend.id, name: friend.name, friend, conversation });
  }
  contacts.sort(
    (a, b) =>
      (b.conversation?.updatedAt ?? '').localeCompare(
        a.conversation?.updatedAt ?? '',
      ) || a.name.localeCompare(b.name, 'zh-CN'),
  );
  const history: Contact[] = allConversations
    .filter((item) => !represented.has(item.id))
    .sort((a, b) => b.updatedAt.localeCompare(a.updatedAt))
    .map((conversation) => ({
      key: conversation.id,
      name: conversation.peer.name,
      conversation,
    }));
  const incoming =
    requests.data?.requests.filter(
      (item) => item.direction === 'incoming' && item.status === 'pending',
    ).length ?? 0;
  const error = friends.error || conversations.error || requests.error;
  const detailFriend =
    friendDetails ??
    friends.data?.friends.find(
      (friend) =>
        details &&
        details.myCultivatorId === currentActorId &&
        friend.id === details.peer.cultivatorId,
    );

  function selectChat(id: string | null) {
    if (id === SYSTEM_MAIL_CONVERSATION_ID) setMailVisited(true);
    else if (id)
      setVisited((previous) =>
        [...previous.filter((value) => value !== id), id].slice(-4),
      );
    setParams((previous) => {
      const next = new URLSearchParams(previous);
      if (id) next.set('chat', id);
      else next.delete('chat');
      next.delete('tab');
      next.delete('composeTo');
      next.delete('conversation');
      return next;
    });
  }
  function manage(tab: FriendsManagementTab | null) {
    setParams(
      (previous) => {
        const next = new URLSearchParams(previous);
        next.delete('tab');
        if (tab) next.set('manage', tab);
        else next.delete('manage');
        return next;
      },
      { replace: true },
    );
  }
  function closeGift() {
    setParams(
      (previous) => {
        const next = new URLSearchParams(previous);
        next.delete('composeTo');
        next.delete('conversation');
        return next;
      },
      { replace: true },
    );
  }
  function openGift(cultivatorId: string, chatId: string) {
    setDetails(null);
    setFriendDetails(null);
    setConfirm(null);
    setParams({ chat: chatId, composeTo: cultivatorId });
  }
  async function openContact(contact: Contact) {
    if (opening) return;
    if (contact.conversation) {
      selectChat(contact.conversation.id);
      return;
    }
    if (!contact.friend) return;
    if (contact.friend.status !== 'active') {
      setFriendDetails(contact.friend);
      return;
    }
    setOpening(contact.key);
    try {
      const result = await socialRequest<{
        conversation: DirectConversationDTO;
      }>('/api/direct-messages/conversations', {
        cultivatorId: contact.friend.id,
      });
      selectChat(result.conversation.id);
    } catch (error) {
      pushToast({
        message: error instanceof Error ? error.message : '暂时无法私聊',
        tone: 'warning',
      });
    } finally {
      setOpening(null);
    }
  }
  async function loadOlder() {
    if (!nextCursor || loadingOlder) return;
    setLoadingOlder(true);
    try {
      const response = await apiFetch(
        `/api/direct-messages/conversations?beforeCursor=${encodeURIComponent(nextCursor)}&limit=50`,
      );
      const result = (await response.json()) as DirectConversationsPage & {
        error?: string;
      };
      if (!response.ok) throw new Error(result.error || '会话读取失败');
      setOlderConversations((previous) => [
        ...new Map(
          [...previous, ...result.conversations].map((item) => [item.id, item]),
        ).values(),
      ]);
      setOlderCursor(result.pagination.nextCursor);
    } catch (error) {
      pushToast({
        message: error instanceof Error ? error.message : '会话读取失败',
        tone: 'warning',
      });
    } finally {
      setLoadingOlder(false);
    }
  }
  async function confirmAction() {
    if (!detailFriend || !confirm || busy) return;
    setBusy(true);
    try {
      await socialRequest(
        confirm === 'block'
          ? `/api/social/blocks/${detailFriend.id}`
          : `/api/friends/${detailFriend.id}`,
        undefined,
        confirm === 'block' ? 'POST' : 'DELETE',
      );
      pushToast({
        message: confirm === 'block' ? '已屏蔽道友' : '已移出好友名录',
        tone: 'success',
      });
      setConfirm(null);
      setDetails(null);
      setFriendDetails(null);
    } catch (error) {
      pushToast({
        message: error instanceof Error ? error.message : '操作失败',
        tone: 'warning',
      });
    } finally {
      setBusy(false);
    }
  }
  function contactRow(contact: Contact) {
    const conversation = contact.conversation;
    const active = conversation?.id === conversationId;
    const last = conversation?.lastMessage;
    const preview =
      contact.friend && contact.friend.status !== 'active'
        ? '道途已结束 · 查看资料'
        : last
          ? last.expired
            ? '消息正文已不可用'
            : `${last.mine ? '你：' : ''}${last.text ?? ''}`
          : contact.friend
            ? `${contact.friend.realm} ${contact.friend.realmStage}`
            : conversation?.unavailableReason || '暂无消息';
    return (
      <button
        type="button"
        key={contact.key}
        aria-label={`与${contact.name}私聊${conversation?.unreadCount ? `，${conversation.unreadCount}条未读` : ''}`}
        aria-current={active ? 'true' : undefined}
        disabled={!!opening}
        onClick={() => void openContact(contact)}
        className={cn(
          'focus-visible:outline-crimson flex w-full min-w-0 items-center gap-2.5 px-2.5 py-3 text-left disabled:opacity-50',
          active ? 'bg-ink/5 text-crimson' : 'hover:bg-ink/4 text-ink',
        )}
      >
        <span
          aria-hidden="true"
          className={cn(
            'flex size-9 shrink-0 items-center justify-center rounded-full text-base',
            active ? 'bg-crimson/8' : 'bg-ink/5 text-ink-secondary',
          )}
        >
          {Array.from(contact.name)[0]}
        </span>
        <span className="min-w-0 flex-1">
          <span className="flex items-baseline justify-between gap-2">
            <span className="truncate font-semibold">{contact.name}</span>
            {conversation?.lastMessage ? (
              <time
                className="text-ink-secondary shrink-0 font-mono text-xs"
                dateTime={last!.createdAt}
              >
                {contactTime(last!.createdAt)}
              </time>
            ) : null}
          </span>
          <span className="mt-1 flex items-center justify-between gap-2">
            <span className="text-ink-secondary truncate text-xs">
              {opening === contact.key ? '正在接续……' : preview}
            </span>
            {conversation?.unreadCount ? (
              <span className="bg-crimson/10 text-crimson shrink-0 rounded-full px-1.5 font-mono text-xs">
                {conversation.unreadCount > 99
                  ? '99+'
                  : conversation.unreadCount}
              </span>
            ) : null}
          </span>
        </span>
      </button>
    );
  }

  return (
    <GameSceneFrame description="与道友私聊，查看系统传音与邮件附件。">
      {composeTo && !giftRecipient ? (
        <div
          className="flex flex-wrap items-center gap-2"
          role={friends.data || friends.error ? 'alert' : 'status'}
        >
          <InkNotice tone={friends.data || friends.error ? 'warning' : 'muted'}>
            {friends.error
              ? `收信道友读取失败：${friends.error}`
              : friends.data
                ? '当前无法向这位道友赠物，请先检查好友关系。'
                : '正在确认收信道友……'}
          </InkNotice>
          {friends.error ? (
            <InkButton onClick={() => void friends.reload()}>重试</InkButton>
          ) : friends.data ? (
            <InkButton
              onClick={() => {
                setParams((previous) => {
                  const next = new URLSearchParams(previous);
                  next.delete('composeTo');
                  next.delete('conversation');
                  next.set('addFriend', composeTo);
                  return next;
                });
              }}
            >
              查看道友
            </InkButton>
          ) : null}
          <InkButton variant="secondary" onClick={closeGift}>
            取消赠物
          </InkButton>
        </div>
      ) : null}
      <div style={{ height }}>
        <div
          ref={workspaceRef}
          className="direct-chat-workspace"
          data-keyboard={keyboardViewport ? '' : undefined}
          style={
            keyboardViewport
              ? { top: keyboardViewport.top, height: keyboardViewport.height }
              : undefined
          }
        >
          <aside
            aria-label="道友列表"
            className={cn(
              'border-ink/15 min-h-0 min-w-0 flex-col md:w-60 md:shrink-0 md:border-r md:border-dashed md:pr-3',
              conversationId ? 'hidden md:flex' : 'flex flex-1 md:flex-none',
            )}
          >
            <div className="flex shrink-0 items-center justify-between gap-1 pb-2">
              <span className="font-semibold">
                道友{' '}
                <span className="text-ink-secondary font-mono text-xs">
                  {friends.data?.friends.length ?? '—'}
                </span>
              </span>
              <div className="flex items-center gap-1">
                <InkButton
                  variant="secondary"
                  className="min-h-11"
                  onClick={() => manage('requests')}
                >
                  申请
                  {incoming ? (
                    <span className="text-crimson ml-1 font-mono">
                      {incoming}
                    </span>
                  ) : null}
                </InkButton>
                <InkButton
                  variant="primary"
                  className="min-h-11"
                  onClick={() => manage('find')}
                >
                  结缘
                </InkButton>
              </div>
            </div>
            <button
              type="button"
              onClick={() => selectChat(SYSTEM_MAIL_CONVERSATION_ID)}
              aria-label={`系统传音${unreadMailCount ? `，${unreadMailCount}封未读` : ''}`}
              aria-current={isSystemMail ? 'true' : undefined}
              className={cn(
                'border-ink/15 focus-visible:outline-crimson mb-2 flex shrink-0 items-center gap-2.5 border-b border-dashed px-2.5 py-3 text-left',
                isSystemMail
                  ? 'bg-ink/5 text-crimson'
                  : 'hover:bg-ink/4 text-ink',
              )}
            >
              <span className="bg-ink/5 text-ink-secondary flex size-9 shrink-0 items-center justify-center rounded-full">
                <GameIcon value="📨" className="text-lg" />
              </span>
              <span className="min-w-0 flex-1">
                <span className="flex items-center justify-between gap-2">
                  <span className="font-semibold">系统传音</span>
                  {unreadMailCount > 0 ? (
                    <span className="bg-crimson/10 text-crimson shrink-0 rounded-full px-1.5 font-mono text-xs">
                      {unreadMailCount > 99 ? '99+' : unreadMailCount}
                    </span>
                  ) : null}
                </span>
                <span className="text-ink-secondary mt-1 block text-xs">
                  系统通知与奖励
                </span>
              </span>
            </button>
            <div
              className="battle-scroll min-h-0 flex-1 overflow-y-auto"
              aria-label="好友与最近会话"
            >
              {error ? (
                <InkNotice tone="warning">
                  {error}{' '}
                  <InkButton
                    onClick={() => {
                      void friends.reload();
                      void conversations.reload();
                      void requests.reload();
                    }}
                  >
                    重试
                  </InkButton>
                </InkNotice>
              ) : null}
              {friends.loading && !friends.data ? (
                <GameLoadingState
                  message="正在翻阅道友名录……"
                  variant="inline"
                />
              ) : null}
              {contacts.map(contactRow)}
              {history.length > 0 ? (
                <>
                  <p className="text-ink-secondary px-2.5 pt-4 pb-1 text-xs">
                    其他会话
                  </p>
                  {history.map(contactRow)}
                </>
              ) : null}
              {!friends.loading &&
              !conversations.loading &&
              contacts.length === 0 &&
              history.length === 0 ? (
                <p className="text-ink-secondary px-2 py-8 text-center text-sm">
                  还未结识道友，试试上方结缘。
                </p>
              ) : null}
              {nextCursor ? (
                <div className="py-2 text-center">
                  <InkButton
                    variant="secondary"
                    pending={loadingOlder}
                    onClick={() => void loadOlder()}
                  >
                    更早会话
                  </InkButton>
                </div>
              ) : null}
            </div>
            <div className="border-ink/15 flex shrink-0 items-center justify-between border-t border-dashed pt-1">
              <span className="text-ink-secondary text-xs">
                私聊记录保留 30 天
              </span>
              <InkButton
                variant="secondary"
                className="min-h-11"
                onClick={() => manage('blocks')}
              >
                屏蔽管理
              </InkButton>
            </div>
          </aside>
          <section
            aria-label="道友聊天"
            className={cn(
              'min-h-0 min-w-0 flex-1 flex-col md:pl-4',
              conversationId ? 'flex' : 'hidden md:flex',
            )}
          >
            {mailVisited || isSystemMail ? (
              <Activity mode={isSystemMail ? 'visible' : 'hidden'}>
                <Suspense
                  fallback={
                    <GameLoadingState
                      message="正在接收系统传音……"
                      variant="inline"
                    />
                  }
                >
                  <SystemMailPanel
                    onBack={() => selectChat(null)}
                    obscured={
                      !!friendDetails ||
                      !!management ||
                      !!details ||
                      !!params.get('addFriend') ||
                      giftObscured
                    }
                  />
                </Suspense>
              </Activity>
            ) : null}
            {visiblePanels.map((id) => (
              <Activity
                key={id}
                mode={id === conversationId ? 'visible' : 'hidden'}
              >
                <DirectChatPanel
                  conversationId={id}
                  identity={identity}
                  onBack={() => selectChat(null)}
                  onDetails={setDetails}
                  onConversation={onConversation}
                  obscured={
                    !!friendDetails ||
                    id !== conversationId ||
                    !!management ||
                    !!details ||
                    !!params.get('addFriend') ||
                    giftObscured
                  }
                />
              </Activity>
            ))}
            {!conversationId ? (
              <div className="flex h-full flex-col items-center justify-center gap-2 px-4 text-center">
                <span
                  className="bg-ink/5 text-ink-secondary font-heading mb-2 flex size-14 items-center justify-center rounded-full text-2xl"
                  aria-hidden="true"
                >
                  友
                </span>
                <p className="font-semibold">选择会话，接续往来</p>
                <p className="text-ink-secondary text-sm">
                  选择左侧道友开始私聊，或查看置顶的系统传音。
                </p>
              </div>
            ) : null}
          </section>
        </div>
      </div>
      {composeTo && giftRecipient && friends.data ? (
        <Suspense
          fallback={
            <InkModal isOpen title="传音赠物" onClose={closeGift}>
              <GameLoadingState message="正在准备赠物……" variant="inline" />
            </InkModal>
          }
        >
          <MailComposer
            key={composeTo}
            friends={friends.data.friends}
            recipientId={giftRecipient.id}
            onClose={closeGift}
          />
        </Suspense>
      ) : null}
      {management ? (
        <FriendsManagement
          tab={management}
          requests={requests}
          onTabChange={manage}
          onClose={() => manage(null)}
        />
      ) : null}
      <FriendTargetModal
        targetId={params.get('addFriend')}
        onClose={() =>
          setParams(
            (previous) => {
              const next = new URLSearchParams(previous);
              next.delete('addFriend');
              return next;
            },
            { replace: true },
          )
        }
      />
      <InkModal
        isOpen={!!details || !!friendDetails}
        title={
          confirm
            ? confirm === 'block'
              ? '屏蔽道友'
              : '移出好友'
            : (details?.peer.name ?? detailFriend?.name)
        }
        onClose={() => {
          if (!busy) {
            setDetails(null);
            setFriendDetails(null);
            setConfirm(null);
          }
        }}
        footer={
          <div className="flex justify-end gap-2">
            <InkButton
              variant="secondary"
              disabled={busy}
              onClick={() => {
                if (confirm) setConfirm(null);
                else {
                  setDetails(null);
                  setFriendDetails(null);
                }
              }}
            >
              {confirm ? '取消' : '返回聊天'}
            </InkButton>
            {confirm ? (
              <InkButton
                variant="primary"
                pending={busy}
                onClick={() => void confirmAction()}
              >
                确认{confirm === 'block' ? '屏蔽' : '移出'}
              </InkButton>
            ) : null}
          </div>
        }
      >
        {confirm ? (
          <div className="space-y-3 text-sm leading-7">
            <p>
              确定{confirm === 'block' ? '屏蔽' : '移出'}{' '}
              {details?.peer.name ?? detailFriend?.name}？
            </p>
            <p className="text-ink-secondary">
              {confirm === 'block'
                ? '停止新的直接联系，同时结束在授师徒关系并释放名额。既有历史仍保留；解除屏蔽不会自动恢复关系，账号一生绑定师父的记录不会清除。'
                : '双方将不能继续私聊，在授师徒关系保留，仍可自主出师。已有消息、物品和个人成长保留，可重新申请好友继续往来。'}
            </p>
          </div>
        ) : details || detailFriend ? (
          <div className="space-y-4">
            {detailFriend ? (
              <p className="text-ink-secondary text-sm">
                {detailFriend.realm} {detailFriend.realmStage}
                {detailFriend.title ? ` · ${detailFriend.title}` : ''}
              </p>
            ) : (
              <p className="text-ink-secondary text-sm">
                {details?.unavailableReason || '私聊往来'}
              </p>
            )}
            {details?.peer.cultivatorId ? (
              <div className="flex flex-wrap gap-2">
                {details.canSend ? (
                  <InkButton
                    onClick={() => {
                      const targetId = details.peer.cultivatorId;
                      if (targetId) openGift(targetId, details.id);
                    }}
                  >
                    传音赠物
                  </InkButton>
                ) : null}
                <InkButton
                  href={`/game/mentorship?target=${details.peer.cultivatorId}`}
                >
                  师徒结缘
                </InkButton>
                {!detailFriend && !details.archived ? (
                  <InkButton
                    onClick={() => setDetails(null)}
                    href={`/game/friends?chat=${details.id}&addFriend=${details.peer.cultivatorId}`}
                  >
                    查看好友关系
                  </InkButton>
                ) : null}
              </div>
            ) : null}
            {detailFriend ? (
              <div className="border-ink/15 flex flex-wrap gap-2 border-t border-dashed pt-3">
                <InkButton
                  variant="secondary"
                  onClick={() => setConfirm('remove')}
                >
                  移出好友
                </InkButton>
                <InkButton
                  variant="secondary"
                  onClick={() => setConfirm('block')}
                >
                  屏蔽道友
                </InkButton>
              </div>
            ) : null}
          </div>
        ) : null}
      </InkModal>
    </GameSceneFrame>
  );
}
