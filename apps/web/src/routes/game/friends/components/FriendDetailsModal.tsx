import { CharacterCardContent } from '@app/components/feature/character-card/CharacterCardContent';
import { socialRequest } from '@app/components/feature/friends/socialApi';
import { InkModal } from '@app/components/layout';
import { useInkUI } from '@app/components/providers/InkUIProvider';
import { InkButton } from '@app/components/ui/InkButton';
import type { DirectConversationDTO } from '@daoyou/contracts/direct-messages';
import type { FriendCultivatorSummary } from '@daoyou/contracts/friends';
import { useLayoutEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router';

export function FriendDetailsModal({
  conversation,
  friend,
  onClose,
  onGift,
}: {
  conversation: DirectConversationDTO | null;
  friend?: FriendCultivatorSummary;
  onClose: () => void;
  onGift: (cultivatorId: string, chatId: string) => void;
}) {
  const [detailOpen, setDetailOpen] = useState(false);
  const [confirm, setConfirm] = useState<'remove' | 'block' | null>(null);
  const [busy, setBusy] = useState(false);
  const { pushToast } = useInkUI();
  const navigate = useNavigate();
  const confirmationRef = useRef<HTMLDivElement>(null);
  const actionRef = useRef<HTMLElement>(null);
  const name = conversation?.peer.name ?? friend?.name;
  const targetId = conversation?.peer.cultivatorId ?? friend?.id;
  const cardId = friend && friend.status !== 'active' ? null : targetId;
  const canGift = !!friend && conversation?.canSend;
  const canViewMentorship =
    !!targetId && !!conversation && !conversation.archived;
  const actionLabel = confirm === 'block' ? '屏蔽' : '移出';
  const unavailableReason =
    conversation?.unavailableReason ??
    (friend && friend.status !== 'active' ? '这位道友的道途已结束。' : null);
  const fallback = (
    <div className="space-y-1">
      <h2 className="text-xl font-semibold wrap-anywhere">{name}</h2>
      {friend ? (
        <p className="text-ink-secondary text-sm">
          {friend.realm} · {friend.realmStage}
          {friend.title ? ` · ${friend.title}` : ''}
        </p>
      ) : null}
    </div>
  );

  useLayoutEffect(() => {
    if (confirm) {
      confirmationRef.current?.focus();
    } else {
      actionRef.current?.focus();
      actionRef.current = null;
    }
  }, [confirm]);

  function beginConfirmation(action: 'remove' | 'block') {
    const active = document.activeElement;
    if (active instanceof HTMLElement) actionRef.current = active;
    setConfirm(action);
  }

  async function confirmAction() {
    if (!friend || !confirm || busy) return;
    setBusy(true);
    try {
      await socialRequest(
        confirm === 'block'
          ? `/api/social/blocks/${friend.id}`
          : `/api/friends/${friend.id}`,
        undefined,
        confirm === 'block' ? 'POST' : 'DELETE',
      );
      pushToast({
        message: confirm === 'block' ? '已屏蔽道友' : '已移出好友名录',
        tone: 'success',
      });
      onClose();
    } catch (error) {
      pushToast({
        message: error instanceof Error ? error.message : '操作失败',
        tone: 'warning',
      });
      setBusy(false);
    }
  }

  return (
    <InkModal
      isOpen
      title={
        confirm ? (confirm === 'block' ? '屏蔽道友' : '移出好友') : '道友资料'
      }
      manageFocus
      onClose={() => {
        if (!busy) onClose();
      }}
      footer={
        <div className="flex justify-end gap-2">
          <InkButton
            variant="secondary"
            className="min-h-11"
            disabled={busy}
            onClick={() => {
              if (confirm) setConfirm(null);
              else onClose();
            }}
          >
            {confirm ? '取消' : conversation ? '返回聊天' : '关闭'}
          </InkButton>
          {confirm ? (
            <InkButton
              variant="primary"
              className="min-h-11"
              pending={busy}
              disabled={!friend}
              onClick={() => void confirmAction()}
            >
              确认{actionLabel}
            </InkButton>
          ) : null}
        </div>
      }
    >
      <div hidden={!!confirm}>
        {cardId ? (
          <CharacterCardContent
            key={cardId}
            id={cardId}
            fallback={fallback}
            onDetailChange={setDetailOpen}
          />
        ) : (
          fallback
        )}
        {!detailOpen && (unavailableReason || canViewMentorship || friend) ? (
          <section
            aria-label="道友往来"
            className="border-ink/15 mt-4 border-t pt-2"
          >
            {unavailableReason ? (
              <p className="text-ink-secondary py-1 text-sm">
                {unavailableReason}
              </p>
            ) : null}
            {canViewMentorship ? (
              <div className="flex flex-wrap gap-x-3">
                {canGift && conversation && targetId ? (
                  <InkButton
                    variant="primary"
                    className="min-h-11"
                    onClick={() => onGift(targetId, conversation.id)}
                  >
                    传音赠物
                  </InkButton>
                ) : null}
                <InkButton
                  href={`/game/mentorship?target=${targetId}`}
                  className="min-h-11"
                >
                  师徒结缘
                </InkButton>
                {!friend ? (
                  <InkButton
                    className="min-h-11"
                    onClick={() => {
                      onClose();
                      navigate(
                        `/game/friends?chat=${conversation.id}&addFriend=${targetId}`,
                      );
                    }}
                  >
                    查看好友关系
                  </InkButton>
                ) : null}
              </div>
            ) : null}
            {friend ? (
              <details className="text-ink-secondary">
                <summary className="hover:text-ink focus-visible:outline-crimson min-h-11 w-fit cursor-pointer py-3 text-sm">
                  关系管理
                </summary>
                <div className="flex flex-wrap gap-x-3">
                  <InkButton
                    variant="secondary"
                    className="min-h-11"
                    onClick={() => beginConfirmation('remove')}
                  >
                    移出好友
                  </InkButton>
                  <InkButton
                    variant="secondary"
                    className="min-h-11"
                    onClick={() => beginConfirmation('block')}
                  >
                    屏蔽道友
                  </InkButton>
                </div>
              </details>
            ) : null}
          </section>
        ) : null}
      </div>
      {confirm ? (
        <div
          ref={confirmationRef}
          tabIndex={-1}
          className="space-y-3 text-sm leading-7"
        >
          <p>
            确定{actionLabel} {name}？
          </p>
          <p className="text-ink-secondary">
            {confirm === 'block'
              ? '停止新的直接联系，同时结束在授师徒关系并释放名额。既有历史仍保留；解除屏蔽不会自动恢复关系，账号一生绑定师父的记录不会清除。'
              : '双方将不能继续私聊，在授师徒关系保留，仍可自主出师。已有消息、物品和个人成长保留，可重新申请好友继续往来。'}
          </p>
        </div>
      ) : null}
    </InkModal>
  );
}
