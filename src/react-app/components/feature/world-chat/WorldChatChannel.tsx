import { FriendTargetModal } from '@app/components/feature/friends';
import { GameLoadingState } from '@app/components/game-shell/GameLoadingState';
import { useInkUI } from '@app/components/providers/InkUIProvider';
import { InkButton } from '@app/components/ui/InkButton';
import { InkInput } from '@app/components/ui/InkInput';
import { InkNotice } from '@app/components/ui/InkNotice';
import { InkTabs } from '@app/components/ui/InkTabs';
import type { WorldChatChannel as WorldChatViewChannel } from '@shared/types/world-chat';
import { useEffect, useMemo, useRef, useState } from 'react';
import { WorldChatMessageItem } from './WorldChatMessageItem';
import { WorldChatShowcaseDialog } from './WorldChatShowcaseDialog';
import { useWorldChatFeedModel } from './useWorldChatFeedModel';

const MAX_LENGTH = 100;

function countChars(input: string): number {
  return Array.from(input).length;
}

export function WorldChatChannel() {
  const { pushToast } = useInkUI();
  const {
    messages,
    loading,
    loadingMore,
    hasMore,
    posting,
    hasSect,
    unreadCounts,
    loadMore,
    sendTextMessage,
    sendShowcaseMessage,
    activeChannel,
    setActiveChannel,
  } = useWorldChatFeedModel();
  const [input, setInput] = useState('');
  const [showcaseOpen, setShowcaseOpen] = useState(false);
  const [friendTargetId, setFriendTargetId] = useState<string | null>(null);
  const messageListRef = useRef<HTMLDivElement | null>(null);
  const shouldStickBottomRef = useRef(true);
  const skipNextAutoScrollRef = useRef(false);

  const charCount = useMemo(() => countChars(input), [input]);
  const displayMessages = useMemo(() => [...messages].reverse(), [messages]);
  const canSendMessage = activeChannel !== 'system';
  const channelTabs = useMemo(
    () =>
      [
        { label: '系统', value: 'system' },
        { label: '世界', value: 'world' },
        { label: '宗门', value: 'sect' },
      ].map((item) => ({
        ...item,
        label:
          unreadCounts[item.value as WorldChatViewChannel] > 0
            ? `${item.label} (${unreadCounts[item.value as WorldChatViewChannel]})`
            : item.label,
      })),
    [unreadCounts],
  );
  const canSendToActiveChannel =
    canSendMessage && (activeChannel !== 'sect' || hasSect);
  useEffect(() => {
    if (skipNextAutoScrollRef.current) {
      skipNextAutoScrollRef.current = false;
      return;
    }

    if (!shouldStickBottomRef.current) {
      return;
    }

    const el = messageListRef.current;
    if (!el) {
      return;
    }

    el.scrollTop = el.scrollHeight;
  }, [messages]);

  const handleLoadMore = async () => {
    if (!hasMore || loadingMore) {
      return;
    }

    skipNextAutoScrollRef.current = true;
    await loadMore();
  };

  const handleSend = async () => {
    const text = input.trim();
    const textLength = countChars(text);
    if (textLength < 1 || textLength > MAX_LENGTH) {
      pushToast({ message: '消息长度需在 1-100 字之间', tone: 'warning' });
      return;
    }

    const sent = await sendTextMessage(text);
    if (sent) {
      setInput('');
    }
  };

  return (
    <>
      <div className="space-y-4">
        <InkTabs
          activeValue={activeChannel}
          onChange={(value) => setActiveChannel(value as WorldChatViewChannel)}
          items={channelTabs}
        />

        <div
          ref={messageListRef}
          className="battle-scroll h-[22rem] overflow-y-auto pr-1 md:h-[20rem]"
          onScroll={(event) => {
            const el = event.currentTarget;
            const distanceToBottom =
              el.scrollHeight - el.scrollTop - el.clientHeight;
            shouldStickBottomRef.current = distanceToBottom < 48;
          }}
        >
          {loading ? (
            <GameLoadingState message="正在接引传音……" variant="inline" />
          ) : messages.length === 0 ? (
            <InkNotice>
              {activeChannel === 'system'
                ? '暂无系统传音。'
                : activeChannel === 'sect' && !hasSect
                  ? '尚未拜入宗门，暂无宗门频道。'
                  : activeChannel === 'sect'
                    ? '暂无宗门传音。'
                    : activeChannel === 'world'
                      ? '暂无世界传音。'
                      : '暂无传音。'}
            </InkNotice>
          ) : (
            <div>
              {hasMore ? (
                <div className="mb-2 flex justify-center">
                  <InkButton
                    onClick={handleLoadMore}
                    pending={loadingMore}
                    pendingLabel="加载中……"
                  >
                    加载更早消息
                  </InkButton>
                </div>
              ) : null}
              {displayMessages.map((message) => (
                <WorldChatMessageItem
                  key={message.id}
                  message={message}
                  onSelectFriend={setFriendTargetId}
                />
              ))}
            </div>
          )}
        </div>

        {canSendToActiveChannel ? (
          <div className="pt-3">
            <InkInput
              value={input}
              multiline
              rows={3}
              placeholder="道友请留步，输入你想说的话..."
              onChange={(next) => {
                const limited = Array.from(next).slice(0, MAX_LENGTH).join('');
                setInput(limited);
              }}
              hint={`${charCount}/${MAX_LENGTH}`}
              disabled={posting}
            />
            <div className="flex justify-end gap-2">
              <InkButton
                variant="secondary"
                onClick={() => setShowcaseOpen(true)}
                disabled={posting}
              >
                展示道具
              </InkButton>
              <InkButton
                variant="primary"
                onClick={handleSend}
                disabled={charCount < 1}
                pending={posting}
                pendingLabel="传音中……"
              >
                发送
              </InkButton>
            </div>
          </div>
        ) : null}
      </div>

      <FriendTargetModal
        targetId={friendTargetId}
        onClose={() => setFriendTargetId(null)}
      />

      {showcaseOpen && canSendToActiveChannel ? (
        <WorldChatShowcaseDialog
          key={activeChannel}
          channelName={activeChannel === 'sect' ? '宗门' : '世界'}
          posting={posting}
          send={sendShowcaseMessage}
          onClose={() => setShowcaseOpen(false)}
        />
      ) : null}
    </>
  );
}
