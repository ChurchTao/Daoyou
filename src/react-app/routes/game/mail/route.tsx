import {
  GameSceneAsideSection,
  GameSceneFrame,
} from '@app/components/game-shell';
import { InkModal } from '@app/components/layout';
import { MailDetailModal } from '@app/components/mail/MailDetailModal';
import { Mail, MailList } from '@app/components/mail/MailList';
import { useInkUI } from '@app/components/providers/InkUIProvider';
import { InkButton } from '@app/components/ui/InkButton';
import { InkInput } from '@app/components/ui/InkInput';
import { InkNotice } from '@app/components/ui/InkNotice';
import { InkSelect } from '@app/components/ui/InkSelect';
import { InkBadge, InkList, InkTabs } from '@app/components/ui';
import { usePlayerStateView } from '@app/lib/player-state/selectors';
import { usePlayerStateActions } from '@app/lib/player-state/store';
import { isPillConsumable } from '@shared/lib/consumables';
import { QUALITY_ORDER, type Quality } from '@shared/types/constants';
import type { Artifact, Consumable, Material } from '@shared/types/cultivator';
import { useCallback, useEffect, useRef, useState } from 'react';
import { useSearchParams } from 'react-router';

const PAGE_SIZE = 20;
const MIN_TRANSFER_QUALITY = '玄品';
const TRANSFER_ALLOWED_QUALITIES = Object.keys(QUALITY_ORDER).filter(
  (quality) =>
    QUALITY_ORDER[quality as keyof typeof QUALITY_ORDER] >=
    QUALITY_ORDER[MIN_TRANSFER_QUALITY],
) as Quality[];

type FriendSummary = {
  id: string;
  name: string;
  title: string | null;
  realm: string;
  realmStage: string;
  status: string;
};

type AttachmentOption = {
  key: string;
  itemType: 'material' | 'artifact' | 'consumable';
  itemId: string;
  name: string;
  quantity: number;
  qualityLabel: string;
};

type AttachmentItemType = AttachmentOption['itemType'];
type SelectableAttachment = (Material | Artifact | Consumable) & {
  itemType: AttachmentItemType;
};

type InventoryApiPayload = {
  success: boolean;
  data?: {
    items?: Array<Material | Artifact | Consumable>;
    pagination?: InventoryPagination;
  };
  error?: string;
};

type InventoryPagination = {
  page: number;
  pageSize: number;
  total: number;
  totalPages: number;
  hasMore: boolean;
};

const defaultAttachmentPagination: InventoryPagination = {
  page: 1,
  pageSize: PAGE_SIZE,
  total: 0,
  totalPages: 0,
  hasMore: false,
};

function isTransferableQuality(quality: string | undefined): boolean {
  return Boolean(
    quality && quality in QUALITY_ORDER &&
      QUALITY_ORDER[quality as keyof typeof QUALITY_ORDER] >=
        QUALITY_ORDER[MIN_TRANSFER_QUALITY],
  );
}

function getAttachmentQuality(item: SelectableAttachment): Quality {
  if (item.itemType === 'material') {
    return (item as Material).rank;
  }

  const quality = (item as Artifact | Consumable).quality || '凡品';
  return quality in QUALITY_ORDER ? quality : '凡品';
}

function getAttachmentUnsupportedReason(item: SelectableAttachment): string | null {
  if (item.itemType === 'artifact' && (item as Artifact).isEquipped) {
    return '已装备法宝不可附带';
  }
  if (item.itemType === 'consumable' && !isPillConsumable(item as Consumable)) {
    return '当前仅支持丹药附带';
  }
  if (!isTransferableQuality(getAttachmentQuality(item))) {
    return `仅玄品及以上物品可附带，当前为${getAttachmentQuality(item)}`;
  }
  return null;
}

function toAttachmentOption(item: SelectableAttachment): AttachmentOption | null {
  if (!item.id || getAttachmentUnsupportedReason(item)) {
    return null;
  }

  return {
    key: `${item.itemType}:${item.id}`,
    itemType: item.itemType,
    itemId: item.id,
    name: item.name,
    quantity: item.itemType === 'artifact' ? 1 : (item as Material | Consumable).quantity,
    qualityLabel: getAttachmentQuality(item),
  };
}

export default function MailPage() {
  const { cultivator } = usePlayerStateView();
  const [mails, setMails] = useState<Mail[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [page, setPage] = useState(1);
  const [hasMore, setHasMore] = useState(false);
  const [selectedMail, setSelectedMail] = useState<Mail | null>(null);
  const [batchClaiming, setBatchClaiming] = useState(false);
  const [batchReading, setBatchReading] = useState(false);
  const [friends, setFriends] = useState<FriendSummary[]>([]);
  const [friendsLoading, setFriendsLoading] = useState(true);
  const [inviteTarget, setInviteTarget] = useState<FriendSummary | null>(null);
  const [inviteAlreadyFriend, setInviteAlreadyFriend] = useState(false);
  const [inviteLoading, setInviteLoading] = useState(false);
  const [showSendModal, setShowSendModal] = useState(false);
  const [showAttachmentPicker, setShowAttachmentPicker] = useState(false);
  const [sending, setSending] = useState(false);
  const [recipientId, setRecipientId] = useState('');
  const [content, setContent] = useState('');
  const [activeAttachmentType, setActiveAttachmentType] =
    useState<AttachmentItemType>('material');
  const [selectedAttachment, setSelectedAttachment] =
    useState<AttachmentOption | null>(null);
  const [attachmentQuantity, setAttachmentQuantity] = useState('1');
  const [attachmentItems, setAttachmentItems] = useState<
    Record<AttachmentItemType, SelectableAttachment[]>
  >({
    material: [],
    artifact: [],
    consumable: [],
  });
  const [attachmentPagination, setAttachmentPagination] = useState<
    Record<AttachmentItemType, InventoryPagination>
  >({
    material: defaultAttachmentPagination,
    artifact: defaultAttachmentPagination,
    consumable: defaultAttachmentPagination,
  });
  const [attachmentLoading, setAttachmentLoading] = useState(false);
  const [attachmentError, setAttachmentError] = useState('');
  const [searchParams, setSearchParams] = useSearchParams();
  const attachmentRequestIdRef = useRef(0);
  const { mutate } = usePlayerStateActions();
  const { pushToast } = useInkUI();

  const clearInviteParam = useCallback(() => {
    setSearchParams((prev) => {
      const next = new URLSearchParams(prev);
      next.delete('addFriend');
      return next;
    });
  }, [setSearchParams]);

  const fetchFriends = useCallback(async (options: { showLoading?: boolean } = {}) => {
    try {
      if (options.showLoading) {
        setFriendsLoading(true);
      }
      const res = await fetch('/api/friends');
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || '获取好友名录失败');
      }
      const nextFriends = (data.friends || []) as FriendSummary[];
      setFriends(nextFriends);
      setRecipientId((current) => current || nextFriends[0]?.id || '');
    } catch (error) {
      pushToast({
        message: error instanceof Error ? error.message : '获取好友名录失败',
        tone: 'warning',
      });
    } finally {
      if (options.showLoading) {
        setFriendsLoading(false);
      }
    }
  }, [pushToast]);

  const fetchAttachmentPage = useCallback(
    async (itemType: AttachmentItemType, pageNumber: number) => {
      if (!cultivator?.id) return;

      const requestId = ++attachmentRequestIdRef.current;
      setAttachmentLoading(true);
      setAttachmentError('');

      try {
        const apiType =
          itemType === 'material'
            ? 'materials'
            : itemType === 'artifact'
              ? 'artifacts'
              : 'consumables';
        const params = new URLSearchParams({
          type: apiType,
          page: String(Math.max(1, pageNumber)),
          pageSize: String(PAGE_SIZE),
        });

        if (itemType === 'material') {
          params.set('materialRanks', TRANSFER_ALLOWED_QUALITIES.join(','));
          params.set('materialSortBy', 'rank');
          params.set('materialSortOrder', 'desc');
        }

        const res = await fetch(
          `/api/cultivator/inventory?${params.toString()}`,
        );
        const result = (await res.json()) as InventoryApiPayload;
        if (!res.ok || !result.success) {
          throw new Error(result.error || '读取背包失败');
        }
        if (requestId !== attachmentRequestIdRef.current) return;

        const mappedItems = (result.data?.items || []).map((item) => ({
          ...item,
          itemType,
        })) as SelectableAttachment[];
        setAttachmentItems((prev) => ({
          ...prev,
          [itemType]: mappedItems,
        }));
        setAttachmentPagination((prev) => ({
          ...prev,
          [itemType]: result.data?.pagination || defaultAttachmentPagination,
        }));
      } catch (error) {
        if (requestId === attachmentRequestIdRef.current) {
          setAttachmentError(
            error instanceof Error ? error.message : '读取背包失败',
          );
        }
      } finally {
        if (requestId === attachmentRequestIdRef.current) {
          setAttachmentLoading(false);
        }
      }
    },
    [cultivator?.id],
  );

  const fetchMails = useCallback(
    async (targetPage: number, append: boolean) => {
      try {
        if (append) {
          setLoadingMore(true);
        } else {
          setLoading(true);
        }
        const res = await fetch(
          `/api/cultivator/mail?page=${targetPage}&pageSize=${PAGE_SIZE}`,
        );
        const data = await res.json();
        if (res.ok) {
          const nextMails = (data.mails || []) as Mail[];
          setMails((prev) => (append ? [...prev, ...nextMails] : nextMails));
          setHasMore(Boolean(data.pagination?.hasMore));
          setPage(targetPage);
        }
      } catch (e) {
        console.error(e);
      } finally {
        if (append) {
          setLoadingMore(false);
        } else {
          setLoading(false);
        }
      }
    },
    [],
  );

  useEffect(() => {
    let cancelled = false;

    const loadInitialMails = async () => {
      try {
        const res = await fetch(
          `/api/cultivator/mail?page=1&pageSize=${PAGE_SIZE}`,
        );
        const data = await res.json();
        if (cancelled) return;
        if (res.ok) {
          const nextMails = (data.mails || []) as Mail[];
          setMails(nextMails);
          setHasMore(Boolean(data.pagination?.hasMore));
          setPage(1);
        }
      } catch (e) {
        if (!cancelled) {
          console.error(e);
        }
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    };

    void loadInitialMails();

    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    fetch('/api/friends')
      .then(async (res) => {
        const data = await res.json();
        if (!res.ok) {
          throw new Error(data.error || '获取好友名录失败');
        }
        const nextFriends = (data.friends || []) as FriendSummary[];
        setFriends(nextFriends);
        setRecipientId((current) => current || nextFriends[0]?.id || '');
      })
      .catch((error) => {
        pushToast({
          message: error instanceof Error ? error.message : '获取好友名录失败',
          tone: 'warning',
        });
      })
      .finally(() => {
        setFriendsLoading(false);
      });
  }, [pushToast]);

  useEffect(() => {
    const targetId = searchParams.get('addFriend');
    if (!targetId || !cultivator) {
      return;
    }
    if (targetId === cultivator.id) {
      pushToast({ message: '不能将自己加入好友名录', tone: 'warning' });
      clearInviteParam();
      return;
    }

    let cancelled = false;
    const loadInvite = async () => {
      try {
        setInviteLoading(true);
        const res = await fetch(`/api/friends/invite/${targetId}`);
        const data = await res.json();
        if (cancelled) return;
        if (!res.ok) {
          throw new Error(data.error || '查询道友失败');
        }
        setInviteTarget(data.target);
        setInviteAlreadyFriend(Boolean(data.isFriend));
      } catch (error) {
        if (!cancelled) {
          pushToast({
            message: error instanceof Error ? error.message : '查询道友失败',
            tone: 'warning',
          });
          clearInviteParam();
        }
      } finally {
        if (!cancelled) {
          setInviteLoading(false);
        }
      }
    };

    void loadInvite();

    return () => {
      cancelled = true;
    };
  }, [clearInviteParam, cultivator, pushToast, searchParams]);

  const handleSelectMail = async (mail: Mail) => {
    setSelectedMail(mail);

    // Mark as read if not already
    if (!mail.isRead) {
      try {
        await mutate(
          fetch('/api/cultivator/mail/read', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ mailId: mail.id }),
          }),
        );
        // Optimistic update locally
        setMails((prev) =>
          prev.map((m) => (m.id === mail.id ? { ...m, isRead: true } : m)),
        );
      } catch (e) {
        console.error('Failed to mark read', e);
      }
    }
  };

  const handleLoadMore = () => {
    if (!hasMore || loadingMore) return;
    fetchMails(page + 1, true);
  };

  const handleUpdate = (mailId: string) => {
    // 领取后就地更新，避免重新拉取已加载页
    setMails((prev) =>
      prev.map((mail) =>
        mail.id === mailId ? { ...mail, isClaimed: true, isRead: true } : mail,
      ),
    );
    setSelectedMail((prev) =>
      prev && prev.id === mailId
        ? { ...prev, isClaimed: true, isRead: true }
        : prev,
    );
  };

  const handleClaimAll = async () => {
    try {
      setBatchClaiming(true);
      const data = await mutate<{
        claimedCount: number;
        claimedMailIds: string[];
        unreadMailCount: number;
      }>(
        fetch('/api/cultivator/mail/claim-all', {
          method: 'POST',
        }),
      );

      const claimedMailIds = data.claimedMailIds || [];
      if (claimedMailIds.length > 0) {
        setMails((prev) =>
          prev.map((mail) =>
            claimedMailIds.includes(mail.id)
              ? { ...mail, isClaimed: true, isRead: true }
              : mail,
          ),
        );
        setSelectedMail((prev) =>
          prev && claimedMailIds.includes(prev.id)
            ? { ...prev, isClaimed: true, isRead: true }
            : prev,
        );
      }

      pushToast({
        message:
          claimedMailIds.length > 0
            ? `成功领取 ${claimedMailIds.length} 封邮件附件`
            : '暂无可领取附件',
        tone: 'success',
      });
    } catch (error) {
      console.error('Claim all failed', error);
      pushToast({ message: '一键领取失败', tone: 'danger' });
    } finally {
      setBatchClaiming(false);
    }
  };

  const handleReadAll = async () => {
    try {
      setBatchReading(true);
      const data = await mutate<{
        updatedCount: number;
        unreadMailCount: number;
      }>(
        fetch('/api/cultivator/mail/read-all', {
          method: 'POST',
        }),
      );

      const updatedCount = Number(data.updatedCount || 0);
      setMails((prev) => prev.map((mail) => ({ ...mail, isRead: true })));
      setSelectedMail((prev) => (prev ? { ...prev, isRead: true } : prev));

      pushToast({
        message:
          updatedCount > 0 ? `已标记 ${updatedCount} 封为已读` : '没有未读邮件',
        tone: 'success',
      });
    } catch (error) {
      console.error('Read all failed', error);
      pushToast({ message: '全部已读失败', tone: 'danger' });
    } finally {
      setBatchReading(false);
    }
  };

  const handleCopyInviteLink = async () => {
    if (!cultivator) return;
    const link = `${window.location.origin}/game/mail?addFriend=${cultivator.id}`;
    await navigator.clipboard.writeText(link);
    pushToast({ message: '好友邀请链接已复制', tone: 'success' });
  };

  const handleOpenAttachmentPicker = () => {
    setShowAttachmentPicker(true);
    void fetchAttachmentPage(activeAttachmentType, 1);
  };

  const handleConfirmInvite = async () => {
    if (!inviteTarget) return;
    try {
      const res = await fetch(`/api/friends/${inviteTarget.id}`, {
        method: 'POST',
      });
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || '添加道友失败');
      }
      pushToast({ message: '已加入好友名录', tone: 'success' });
      setInviteTarget(null);
      clearInviteParam();
      await fetchFriends();
    } catch (error) {
      pushToast({
        message: error instanceof Error ? error.message : '添加道友失败',
        tone: 'danger',
      });
    }
  };

  const handleRemoveFriend = async (friendId: string) => {
    try {
      const res = await fetch(`/api/friends/${friendId}`, {
        method: 'DELETE',
      });
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || '移除道友失败');
      }
      setFriends((prev) => prev.filter((friend) => friend.id !== friendId));
      if (recipientId === friendId) {
        setRecipientId('');
      }
      pushToast({ message: '已移出好友名录', tone: 'success' });
    } catch (error) {
      pushToast({
        message: error instanceof Error ? error.message : '移除道友失败',
        tone: 'danger',
      });
    }
  };

  const handleSendMail = async () => {
    if (!recipientId) {
      pushToast({ message: '请选择收信道友', tone: 'warning' });
      return;
    }
    if (!content.trim()) {
      pushToast({ message: '请写下传音内容', tone: 'warning' });
      return;
    }

    const quantity = Math.max(1, Number(attachmentQuantity) || 1);
    const attachment =
      selectedAttachment
        ? {
            itemType: selectedAttachment.itemType,
            itemId: selectedAttachment.itemId,
            quantity:
              selectedAttachment.itemType === 'artifact'
                ? 1
                : Math.min(quantity, selectedAttachment.quantity),
          }
        : undefined;

    try {
      setSending(true);
      await mutate(
        fetch('/api/cultivator/mail/send', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            recipientCultivatorId: recipientId,
            content,
            attachment,
          }),
        }),
      );
      pushToast({ message: '传音已发出', tone: 'success' });
      setShowSendModal(false);
      setContent('');
      setSelectedAttachment(null);
      setAttachmentQuantity('1');
    } catch (error) {
      pushToast({
        message: error instanceof Error ? error.message : '发送传音失败',
        tone: 'danger',
      });
    } finally {
      setSending(false);
    }
  };

  const unreadCount = mails.filter((mail) => !mail.isRead).length;
  const pendingAttachments = mails.filter(
    (mail) => mail.type === 'reward' && !mail.isClaimed,
  ).length;
  const attachmentTabs = [
    { label: '材料', value: 'material' },
    { label: '法宝', value: 'artifact' },
    { label: '丹药', value: 'consumable' },
  ];
  const currentAttachmentItems = attachmentItems[activeAttachmentType]
    .map(toAttachmentOption)
    .filter((item): item is AttachmentOption => Boolean(item));
  const currentAttachmentPagination =
    attachmentPagination[activeAttachmentType];

  return (
    <GameSceneFrame
      title="【传音玉简】"
      description="宗门告示、奖励来函与四方灵讯都在此归卷。先清掉要紧的未读与附件，再决定今日是否继续外出。"
      aside={
        <>
          <GameSceneAsideSection title="收件摘要">
            <div className="space-y-2 text-sm leading-7">
              <p>当前已载：{mails.length} 封</p>
              <p>未读：{unreadCount} 封</p>
              <p>待领附件：{pendingAttachments} 封</p>
            </div>
          </GameSceneAsideSection>
          <GameSceneAsideSection title="好友名录">
            <div className="space-y-3 text-sm">
              <div className="flex flex-wrap gap-2">
                <InkButton onClick={handleCopyInviteLink} disabled={!cultivator}>
                  复制邀请链接
                </InkButton>
                <InkButton
                  variant="primary"
                  onClick={() => setShowSendModal(true)}
                  disabled={friends.length === 0}
                >
                  发送传音
                </InkButton>
              </div>
              {friendsLoading ? (
                <p className="opacity-60">正在翻检名录...</p>
              ) : friends.length === 0 ? (
                <p className="opacity-60">尚未收录道友。</p>
              ) : (
                <div className="space-y-2">
                  {friends.slice(0, 6).map((friend) => (
                    <div
                      key={friend.id}
                      className="border-ink/10 flex items-center justify-between gap-2 border border-dashed p-2"
                    >
                      <div className="min-w-0">
                        <p className="truncate font-medium">{friend.name}</p>
                        <p className="text-xs opacity-60">
                          {friend.realm} {friend.realmStage}
                        </p>
                      </div>
                      <button
                        type="button"
                        className="text-xs opacity-60 hover:opacity-100"
                        onClick={() => void handleRemoveFriend(friend.id)}
                      >
                        移除
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </GameSceneAsideSection>
          <GameSceneAsideSection
            title="操作说明"
            className="text-sm leading-7"
            help={{
              title: '传音玉简操作说明',
              content: (
                <div className="space-y-2 text-sm leading-7">
                  <p>点击玉简可展开全文，未读会即时回写。</p>
                  <p>奖励类来函支持就地领取，不必离开当前场景。</p>
                </div>
              ),
            }}
          />
        </>
      }
    >
      <div className="space-y-4">
        <div className="flex flex-wrap justify-end gap-2">
          <InkButton
            variant="primary"
            onClick={() => setShowSendModal(true)}
            disabled={friends.length === 0}
          >
            发送传音
          </InkButton>
          <InkButton
            onClick={handleClaimAll}
            disabled={batchClaiming || batchReading || mails.length === 0}
          >
            {batchClaiming ? '领取中...' : '一键领取'}
          </InkButton>
          <InkButton
            onClick={handleReadAll}
            disabled={batchReading || batchClaiming || mails.length === 0}
          >
            {batchReading ? '处理中...' : '全部已读'}
          </InkButton>
        </div>
        {loading ? (
          <div className="py-8 text-center text-sm opacity-50">
            正在接收灵讯...
          </div>
        ) : (
          <div className="space-y-4">
            <MailList mails={mails} onSelect={handleSelectMail} />
            {hasMore ? (
              <div className="flex justify-center pt-2">
                <InkButton onClick={handleLoadMore} disabled={loadingMore}>
                  {loadingMore ? '接收中...' : '加载更多'}
                </InkButton>
              </div>
            ) : null}
          </div>
        )}
      </div>

      <MailDetailModal
        mail={selectedMail}
        onClose={() => setSelectedMail(null)}
        onUpdate={handleUpdate}
      />
      <InkModal
        isOpen={showSendModal}
        onClose={() => setShowSendModal(false)}
        title="发送传音"
      >
        <div className="space-y-4">
          <InkSelect
            label="收信道友"
            value={recipientId}
            onChange={setRecipientId}
            disabled={friends.length === 0}
          >
            <option value="">选择好友</option>
            {friends.map((friend) => (
              <option key={friend.id} value={friend.id}>
                {friend.name} · {friend.realm}{friend.realmStage}
              </option>
            ))}
          </InkSelect>
          <InkInput
            label="传音内容"
            value={content}
            onChange={setContent}
            multiline
            rows={5}
            placeholder="写下要托玉简送达的话"
            hint="发送会消耗空白传音符，可在天骄宝阁购买"
          />
          <div className="space-y-2">
            <div className="text-ink font-semibold tracking-[0.08em]">
              随附物品
            </div>
            {selectedAttachment ? (
              <div className="border-ink/10 bg-paper-2 flex items-center justify-between gap-3 border border-dashed p-3 text-sm">
                <div className="min-w-0">
                  <p className="truncate font-medium">
                    {selectedAttachment.name}
                  </p>
                  <p className="text-xs opacity-60">
                    {selectedAttachment.qualityLabel} · 可用{' '}
                    {selectedAttachment.quantity}
                  </p>
                </div>
                <div className="flex shrink-0 gap-2">
                  <InkButton
                    variant="secondary"
                    onClick={handleOpenAttachmentPicker}
                  >
                    更换
                  </InkButton>
                  <InkButton
                    variant="secondary"
                    onClick={() => {
                      setSelectedAttachment(null);
                      setAttachmentQuantity('1');
                    }}
                  >
                    移除
                  </InkButton>
                </div>
              </div>
            ) : (
              <InkButton
                variant="secondary"
                onClick={handleOpenAttachmentPicker}
              >
                选择附件
              </InkButton>
            )}
          </div>
          {selectedAttachment && selectedAttachment.itemType !== 'artifact' ? (
            <InkInput
              label="数量"
              type="number"
              value={attachmentQuantity}
              onChange={setAttachmentQuantity}
              hint={`最多 ${selectedAttachment.quantity}`}
            />
          ) : null}
          <div className="flex justify-end gap-2">
            <InkButton onClick={() => setShowSendModal(false)}>取消</InkButton>
            <InkButton
              variant="primary"
              onClick={handleSendMail}
              disabled={sending || friends.length === 0}
            >
              {sending ? '发送中...' : '发出'}
            </InkButton>
          </div>
        </div>
      </InkModal>
      <InkModal
        isOpen={showAttachmentPicker}
        onClose={() => setShowAttachmentPicker(false)}
        title="选择附件"
        className="max-w-2xl"
      >
        <div className="space-y-4">
          <InkTabs
            items={attachmentTabs}
            activeValue={activeAttachmentType}
            onChange={(value) => {
              const nextType = value as AttachmentItemType;
              setActiveAttachmentType(nextType);
              setAttachmentError('');
              void fetchAttachmentPage(nextType, 1);
            }}
          />
          {attachmentError ? (
            <InkNotice tone="danger">{attachmentError}</InkNotice>
          ) : null}
          {attachmentLoading ? (
            <div className="py-8 text-center text-sm opacity-60">
              正在翻检储物袋...
            </div>
          ) : currentAttachmentItems.length > 0 ? (
            <InkList>
              {currentAttachmentItems.map((item) => (
                <div
                  key={item.key}
                  className="border-ink/10 bg-paper-2 flex items-center justify-between gap-3 border border-dashed p-3"
                >
                  <div className="min-w-0">
                    <InkBadge tier={item.qualityLabel as Quality} hideTierText>
                      {item.name}
                    </InkBadge>
                    <p className="mt-1 text-xs opacity-60">
                      {item.qualityLabel} · 可用 {item.quantity}
                    </p>
                  </div>
                  <InkButton
                    variant="primary"
                    onClick={() => {
                      setSelectedAttachment(item);
                      setAttachmentQuantity('1');
                      setShowAttachmentPicker(false);
                    }}
                  >
                    选择
                  </InkButton>
                </div>
              ))}
            </InkList>
          ) : (
            <InkNotice>
              {activeAttachmentType === 'material'
                ? '暂无可附带材料（仅限玄品及以上）。'
                : activeAttachmentType === 'artifact'
                  ? '暂无可附带法宝（仅限玄品及以上且未装备）。'
                  : '暂无可附带丹药（仅限玄品及以上）。'}
            </InkNotice>
          )}
          {currentAttachmentPagination.totalPages > 1 ? (
            <div className="flex items-center justify-center gap-4">
              <InkButton
                variant="secondary"
                disabled={
                  attachmentLoading || currentAttachmentPagination.page <= 1
                }
                onClick={() =>
                  void fetchAttachmentPage(
                    activeAttachmentType,
                    currentAttachmentPagination.page - 1,
                  )
                }
              >
                上一页
              </InkButton>
              <span className="text-ink-secondary text-sm">
                {currentAttachmentPagination.page} /{' '}
                {currentAttachmentPagination.totalPages}
              </span>
              <InkButton
                variant="secondary"
                disabled={
                  attachmentLoading ||
                  currentAttachmentPagination.page >=
                    currentAttachmentPagination.totalPages
                }
                onClick={() =>
                  void fetchAttachmentPage(
                    activeAttachmentType,
                    currentAttachmentPagination.page + 1,
                  )
                }
              >
                下一页
              </InkButton>
            </div>
          ) : null}
        </div>
      </InkModal>
      <InkModal
        isOpen={Boolean(inviteTarget) || inviteLoading}
        onClose={() => {
          setInviteTarget(null);
          clearInviteParam();
        }}
        title="收录道友"
      >
        {inviteLoading ? (
          <div className="py-6 text-center text-sm opacity-60">
            正在辨认玉简气息...
          </div>
        ) : inviteTarget ? (
          <div className="space-y-4">
            <InkNotice tone="muted">
              <div className="space-y-1 text-sm">
                <p className="font-medium">{inviteTarget.name}</p>
                <p className="opacity-70">
                  {inviteTarget.realm} {inviteTarget.realmStage}
                </p>
                {inviteTarget.title ? (
                  <p className="opacity-70">称号：{inviteTarget.title}</p>
                ) : null}
              </div>
            </InkNotice>
            <div className="flex justify-end gap-2">
              <InkButton
                onClick={() => {
                  setInviteTarget(null);
                  clearInviteParam();
                }}
              >
                取消
              </InkButton>
              <InkButton
                variant="primary"
                onClick={handleConfirmInvite}
                disabled={inviteAlreadyFriend}
              >
                {inviteAlreadyFriend ? '已在名录中' : '加入名录'}
              </InkButton>
            </div>
          </div>
        ) : null}
      </InkModal>
    </GameSceneFrame>
  );
}
