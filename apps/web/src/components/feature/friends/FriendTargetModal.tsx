import { InkModal } from '@app/components/layout';
import { useInkUI } from '@app/components/providers/InkUIProvider';
import { InkButton, InkNotice } from '@app/components/ui';
import { pendingCommandRequest } from '@app/lib/pendingCommandRequest';
import { usePlayerSession } from '@app/lib/resources/player';
import type {
  FriendCultivatorSummary,
  FriendRequestResult,
  FriendTargetResponse,
} from '@daoyou/contracts/friends';
import { useState } from 'react';
import { useNavigate } from 'react-router';
import { socialRequest, useSocialQuery } from './socialApi';

export interface FriendTargetModalProps {
  targetId: string | null;
  onClose: () => void;
  onAdded?: (friend: FriendCultivatorSummary) => void | Promise<void>;
}

export function FriendTargetModal({
  targetId,
  onClose,
  onAdded,
}: FriendTargetModalProps) {
  const target = useSocialQuery<FriendTargetResponse>(
    targetId ? `/api/friends/invite/${targetId}` : null,
  );
  const actor = usePlayerSession().data?.activeCultivator;
  const [busy, setBusy] = useState(false);
  const { pushToast } = useInkUI();
  const navigate = useNavigate();

  async function act() {
    if (!target.data || !actor || busy) return;
    setBusy(true);
    const incoming =
      target.data.relationship === 'incoming' ? target.data.request : undefined;
    const pending = pendingCommandRequest(actor.id, 'friend-request', {
      targetId,
    });
    try {
      const result = await socialRequest<FriendRequestResult>(
        incoming
          ? `/api/friends/requests/${incoming.id}/accept`
          : '/api/friends/requests',
        incoming
          ? { expectedRevision: incoming.revision }
          : { cultivatorId: targetId, requestId: pending.requestId },
      );
      pending.complete();
      if (result.relationship === 'friend')
        await onAdded?.(result.friend ?? target.data.target);
      pushToast({
        message: result.message || (incoming ? '已成为好友' : '好友申请已送达'),
        tone: 'success',
      });
      await target.reload();
    } catch (error) {
      pushToast({
        message: error instanceof Error ? error.message : '结缘未完成',
        tone: 'warning',
      });
    } finally {
      setBusy(false);
    }
  }

  async function chat() {
    if (!targetId || busy) return;
    setBusy(true);
    try {
      const result = await socialRequest<{ conversation: { id: string } }>(
        '/api/direct-messages/conversations',
        { cultivatorId: targetId },
      );
      onClose();
      navigate(`/game/friends?chat=${result.conversation.id}`);
    } catch (error) {
      pushToast({
        message: error instanceof Error ? error.message : '暂时无法私聊',
        tone: 'warning',
      });
    } finally {
      setBusy(false);
    }
  }

  const relationship = target.data?.relationship;
  return (
    <InkModal isOpen={Boolean(targetId)} onClose={onClose} title="结识道友">
      {target.loading && !target.data ? (
        <p role="status" className="py-5 text-center text-sm">
          正在辨认道友身份……
        </p>
      ) : null}
      {target.error ? (
        <InkNotice tone="warning">{target.error}</InkNotice>
      ) : null}
      {target.data ? (
        <div className="space-y-4">
          <div className="space-y-1 text-sm">
            <p className="font-semibold">{target.data.target.name}</p>
            <p className="text-ink-secondary">
              {target.data.target.realm} {target.data.target.realmStage}
              {target.data.target.title ? ` · ${target.data.target.title}` : ''}
            </p>
            <p className="text-ink-secondary font-mono text-xs">
              道号标识：{target.data.target.id.slice(0, 8)}
            </p>
          </div>
          {relationship === 'outgoing' ? (
            <p className="text-ink-secondary text-sm">
              申请已送达，等待对方接受。
            </p>
          ) : relationship === 'incoming' ? (
            <p className="text-sm">这位道友也向你发来了好友申请。</p>
          ) : relationship === 'unavailable' ? (
            <p className="text-ink-secondary text-sm">当前无法联系这位道友。</p>
          ) : relationship === 'none' ? (
            <p className="text-ink-secondary text-sm">
              对方接受后即可免费私聊，也可互寄传音玉简。
            </p>
          ) : null}
          <div className="flex flex-wrap justify-end gap-2">
            <InkButton onClick={onClose} variant="secondary">
              关闭
            </InkButton>
            {relationship === 'friend' ? (
              <>
                <InkButton
                  href={`/game/mentorship?target=${targetId}`}
                  onClick={onClose}
                >
                  师徒结缘
                </InkButton>
                <InkButton
                  variant="primary"
                  pending={busy}
                  onClick={() => void chat()}
                >
                  私聊
                </InkButton>
              </>
            ) : (
              <InkButton
                variant="primary"
                pending={busy}
                disabled={
                  relationship === 'outgoing' || relationship === 'unavailable'
                }
                onClick={() => void act()}
              >
                {relationship === 'incoming'
                  ? '接受申请'
                  : relationship === 'outgoing'
                    ? '等待接受'
                    : '申请好友'}
              </InkButton>
            )}
          </div>
        </div>
      ) : (
        <div className="flex justify-end">
          <InkButton onClick={onClose}>关闭</InkButton>
        </div>
      )}
    </InkModal>
  );
}
