import { FriendTargetModal } from '@app/components/feature/friends';
import {
  GameLoadingState,
  GameSceneAsideSection,
  GameSceneFrame,
} from '@app/components/game-shell';
import { InkModal } from '@app/components/layout';
import { MailDetailModal } from '@app/components/mail/MailDetailModal';
import { Mail, MailList } from '@app/components/mail/MailList';
import { useInkUI } from '@app/components/providers/InkUIProvider';
import { InkBadge, InkList, InkTabs } from '@app/components/ui';
import { InkButton } from '@app/components/ui/InkButton';
import { InkInput } from '@app/components/ui/InkInput';
import { InkNotice } from '@app/components/ui/InkNotice';
import { InkSelect } from '@app/components/ui/InkSelect';
import {
  useArtifactInventoryResource,
  useConsumableInventoryResource,
  useMaterialInventoryResource,
} from '@app/lib/resources/inventory';
import { useResourceMutation } from '@app/lib/resources/mutations';
import { usePlayerSession } from '@app/lib/resources/player';
import type {
  FriendCultivatorSummary,
  FriendSearchResponse,
  FriendSearchResult,
} from '@shared/contracts/friends';
import { MAX_PLAYER_ITEM_QUANTITY } from '@shared/config/itemQuantity';
import { MAX_FRIENDS_PER_CULTIVATOR } from '@shared/config/socialConfig';
import { isPillConsumable } from '@shared/lib/consumables';
import { QUALITY_ORDER, type Quality } from '@shared/types/constants';
import type { Artifact, Consumable, Material } from '@shared/types/cultivator';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { useSearchParams } from 'react-router';

const PAGE_SIZE = 20;
const MAIL_PAGE_TABS = [
  { label: '收件玉简', value: 'mail' },
  { label: '好友名录', value: 'friends' },
];
const MIN_TRANSFER_QUALITY = '玄品';
const TRANSFER_ALLOWED_QUALITIES = Object.keys(QUALITY_ORDER).filter(
  (quality) =>
    QUALITY_ORDER[quality as keyof typeof QUALITY_ORDER] >=
    QUALITY_ORDER[MIN_TRANSFER_QUALITY],
) as Quality[];

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
    quality &&
    quality in QUALITY_ORDER &&
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

function getAttachmentUnsupportedReason(
  item: SelectableAttachment,
): string | null {
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

function toAttachmentOption(
  item: SelectableAttachment,
): AttachmentOption | null {
  if (!item.id || getAttachmentUnsupportedReason(item)) {
    return null;
  }

  return {
    key: `${item.itemType}:${item.id}`,
    itemType: item.itemType,
    itemId: item.id,
    name: item.name,
    quantity:
      item.itemType === 'artifact'
        ? 1
        : (item as Material | Consumable).quantity,
    qualityLabel: getAttachmentQuality(item),
  };
}

export default function MailPage() {
  const cultivator = usePlayerSession().data?.activeCultivator;
  const [mails, setMails] = useState<Mail[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [page, setPage] = useState(1);
  const [hasMore, setHasMore] = useState(false);
  const [selectedMail, setSelectedMail] = useState<Mail | null>(null);
  const [batchClaiming, setBatchClaiming] = useState(false);
  const [batchReading, setBatchReading] = useState(false);
  const [friends, setFriends] = useState<FriendCultivatorSummary[]>([]);
  const [friendsLoading, setFriendsLoading] = useState(true);
  const [friendTargetId, setFriendTargetId] = useState<string | null>(null);
  const [friendSearchName, setFriendSearchName] = useState('');
  const [friendSearchResults, setFriendSearchResults] = useState<
    FriendSearchResult[]
  >([]);
  const [friendSearching, setFriendSearching] = useState(false);
  const [friendSearchAttempted, setFriendSearchAttempted] = useState(false);
  const [manualShareLink, setManualShareLink] = useState<string | null>(null);
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
  const materialInventory = useMaterialInventoryResource({
    pageSize: PAGE_SIZE,
    enabled: showAttachmentPicker && activeAttachmentType === 'material',
    materialRanks: TRANSFER_ALLOWED_QUALITIES,
    materialSortBy: 'rank',
    materialSortOrder: 'desc',
  });
  const artifactInventory = useArtifactInventoryResource({
    pageSize: PAGE_SIZE,
    enabled: showAttachmentPicker && activeAttachmentType === 'artifact',
  });
  const consumableInventory = useConsumableInventoryResource({
    pageSize: PAGE_SIZE,
    enabled: showAttachmentPicker && activeAttachmentType === 'consumable',
  });
  const activeAttachmentInventory =
    activeAttachmentType === 'material'
      ? materialInventory
      : activeAttachmentType === 'artifact'
        ? artifactInventory
        : consumableInventory;
  const [searchParams, setSearchParams] = useSearchParams();
  const inviteTargetId = searchParams.get('addFriend');
  const activeTab =
    searchParams.get('tab') === 'friends' || inviteTargetId
      ? 'friends'
      : 'mail';
  const activeFriendTargetId = friendTargetId ?? inviteTargetId;
  const { mutate } = useResourceMutation();
  const { pushToast } = useInkUI();

  const setActiveTab = useCallback(
    (tab: 'mail' | 'friends') => {
      setSearchParams((previous) => {
        const next = new URLSearchParams(previous);
        if (tab === 'friends') {
          next.set('tab', 'friends');
        } else {
          next.delete('tab');
        }
        return next;
      });
    },
    [setSearchParams],
  );

  const clearInviteParam = useCallback(() => {
    setSearchParams((prev) => {
      const next = new URLSearchParams(prev);
      next.delete('addFriend');
      return next;
    });
  }, [setSearchParams]);

  const fetchFriends = useCallback(
    async (options: { showLoading?: boolean } = {}) => {
      try {
        if (options.showLoading) {
          setFriendsLoading(true);
        }
        const res = await fetch('/api/friends');
        const data = await res.json();
        if (!res.ok) {
          throw new Error(data.error || '获取好友名录失败');
        }
        const nextFriends = (data.friends || []) as FriendCultivatorSummary[];
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
    },
    [pushToast],
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
      .then(async (response) => {
        const data = await response.json();
        if (!response.ok) {
          throw new Error(data.error || '获取好友名录失败');
        }
        const nextFriends = (data.friends || []) as FriendCultivatorSummary[];
        setFriends(nextFriends);
        setRecipientId((current) => current || nextFriends[0]?.id || '');
      })
      .catch((loadError) => {
        pushToast({
          message:
            loadError instanceof Error
              ? loadError.message
              : '获取好友名录失败',
          tone: 'warning',
        });
      })
      .finally(() => setFriendsLoading(false));
  }, [pushToast]);

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

  const getInviteLink = useCallback(() => {
    if (!cultivator) return null;
    return `${window.location.origin}/game/mail?tab=friends&addFriend=${cultivator.id}`;
  }, [cultivator]);

  const copyInviteLink = useCallback(
    async (link: string) => {
      try {
        await navigator.clipboard.writeText(link);
        pushToast({ message: '好友邀请链接已复制', tone: 'success' });
      } catch {
        setManualShareLink(link);
        pushToast({ message: '复制失败，请手动复制邀请链接', tone: 'warning' });
      }
    },
    [pushToast],
  );

  const handleCopyInviteLink = async () => {
    const link = getInviteLink();
    if (!link) return;
    await copyInviteLink(link);
  };

  const handleShareInvite = async () => {
    const link = getInviteLink();
    if (!link) return;

    if (!navigator.share) {
      await copyInviteLink(link);
      return;
    }

    try {
      await navigator.share({
        title: '万界道友',
        text: '来万界道友与我结缘，一同踏上修仙之路。',
        url: link,
      });
    } catch (shareError) {
      if (shareError instanceof DOMException && shareError.name === 'AbortError') {
        return;
      }
      pushToast({ message: '分享失败，请改用复制链接', tone: 'warning' });
    }
  };

  const handleSearchFriends = async () => {
    const name = friendSearchName.trim();
    if (!name) {
      pushToast({ message: '请输入完整道友名称', tone: 'warning' });
      return;
    }

    try {
      setFriendSearching(true);
      setFriendSearchAttempted(true);
      const response = await fetch(
        `/api/friends/search?name=${encodeURIComponent(name)}`,
      );
      const data = (await response.json()) as FriendSearchResponse & {
        error?: string;
      };
      if (!response.ok) {
        throw new Error(data.error || '搜索道友失败');
      }
      setFriendSearchResults(data.results);
    } catch (searchError) {
      setFriendSearchResults([]);
      pushToast({
        message:
          searchError instanceof Error ? searchError.message : '搜索道友失败',
        tone: 'warning',
      });
    } finally {
      setFriendSearching(false);
    }
  };

  const handleFriendAdded = async (friend: FriendCultivatorSummary) => {
    setFriendSearchResults((previous) =>
      previous.map((result) =>
        result.id === friend.id
          ? { ...result, relationship: 'friend', isFriend: true }
          : result,
      ),
    );
    await fetchFriends();
    setFriendTargetId(null);
    clearInviteParam();
  };

  const handleOpenAttachmentPicker = () => {
    setShowAttachmentPicker(true);
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
      setFriendSearchResults((previous) =>
        previous.map((result) =>
          result.id === friendId
            ? { ...result, relationship: 'none', isFriend: false }
            : result,
        ),
      );
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

  const handleSendToFriend = (friendId: string) => {
    setRecipientId(friendId);
    setShowSendModal(true);
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

    const quantity = Math.min(
      MAX_PLAYER_ITEM_QUANTITY,
      Math.max(1, Number(attachmentQuantity) || 1),
    );
    const attachment = selectedAttachment
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
  const currentAttachmentItems = useMemo(() => {
    const items =
      activeAttachmentType === 'material'
        ? (materialInventory.items ?? []).map((item) => ({
            ...item,
            itemType: 'material' as const,
          }))
        : activeAttachmentType === 'artifact'
          ? (artifactInventory.items ?? []).map((item) => ({
              ...item,
              itemType: 'artifact' as const,
            }))
          : (consumableInventory.items ?? []).map((item) => ({
              ...item,
              itemType: 'consumable' as const,
            }));
    return items
      .map(toAttachmentOption)
      .filter((item): item is AttachmentOption => Boolean(item));
  }, [
    activeAttachmentType,
    artifactInventory.items,
    consumableInventory.items,
    materialInventory.items,
  ]);
  const currentAttachmentPagination = activeAttachmentInventory.pagination ?? {
    ...defaultAttachmentPagination,
    page: activeAttachmentInventory.page,
  };
  const attachmentLoading = activeAttachmentInventory.loading;
  const attachmentError = activeAttachmentInventory.error;

  return (
    <GameSceneFrame
      title="【道友传音】"
      description="收拢往来玉简与好友名录。可先处理来函，也可寻访道友、分享结缘玉简。"
      aside={
        activeTab === 'mail' ? (
          <>
            <GameSceneAsideSection title="收件摘要">
              <div className="space-y-2 text-sm leading-7">
                <p>当前已载：{mails.length} 封</p>
                <p>未读：{unreadCount} 封</p>
                <p>待领附件：{pendingAttachments} 封</p>
              </div>
            </GameSceneAsideSection>
            <GameSceneAsideSection
              title="操作说明"
              className="text-sm leading-7"
              help={{
                title: '收件玉简操作说明',
                content: (
                  <div className="space-y-2 text-sm leading-7">
                    <p>点击玉简可展开全文，未读会即时回写。</p>
                    <p>奖励类来函支持就地领取，不必离开当前场景。</p>
                  </div>
                ),
              }}
            />
          </>
        ) : (
          <>
            <GameSceneAsideSection title="名录摘要">
              <div className="space-y-2 text-sm leading-7">
                <p>已收录道友：{friends.length} 位</p>
                <p>可按完整道号搜索，也可分享邀请链接。</p>
              </div>
            </GameSceneAsideSection>
            <GameSceneAsideSection
              title="结缘说明"
              className="text-sm leading-7"
              help={{
                title: '好友名录操作说明',
                content: (
                  <div className="space-y-2 text-sm leading-7">
                    <p>加入名录后，双方即可互相发送传音。</p>
                    <p>同名道友可通过境界、称号与道号标识区分。</p>
                  </div>
                ),
              }}
            />
          </>
        )
      }
    >
      <div className="space-y-5">
        <InkTabs
          items={MAIL_PAGE_TABS}
          activeValue={activeTab}
          onChange={(value) =>
            setActiveTab(value === 'friends' ? 'friends' : 'mail')
          }
        />

        {activeTab === 'mail' ? (
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
                disabled={batchReading || mails.length === 0}
                pending={batchClaiming}
                pendingLabel="领取中……"
              >
                一键领取
              </InkButton>
              <InkButton
                onClick={handleReadAll}
                disabled={batchClaiming || mails.length === 0}
                pending={batchReading}
                pendingLabel="处理中……"
              >
                全部已读
              </InkButton>
            </div>
            {loading ? (
              <GameLoadingState message="正在接收灵讯……" variant="inline" />
            ) : (
              <div className="space-y-4">
                <MailList mails={mails} onSelect={handleSelectMail} />
                {hasMore ? (
                  <div className="flex justify-center pt-2">
                    <InkButton
                      onClick={handleLoadMore}
                      pending={loadingMore}
                      pendingLabel="接收中……"
                    >
                      加载更多
                    </InkButton>
                  </div>
                ) : null}
              </div>
            )}
          </div>
        ) : (
          <div className="space-y-6">
            <section className="border-ink/15 space-y-3 border-b border-dashed pb-5">
              <div>
                <h2 className="text-base font-semibold">邀请道友</h2>
                <p className="text-ink-secondary mt-1 text-sm leading-6">
                  将结缘玉简分享给朋友，对方打开后即可将你加入名录。
                </p>
              </div>
              <div className="flex flex-wrap gap-2">
                <InkButton
                  variant="primary"
                  onClick={() => void handleShareInvite()}
                  disabled={!cultivator}
                >
                  分享邀请
                </InkButton>
                <InkButton
                  onClick={() => void handleCopyInviteLink()}
                  disabled={!cultivator}
                >
                  复制链接
                </InkButton>
              </div>
            </section>

            <section className="border-ink/15 space-y-3 border-b border-dashed pb-5">
              <div>
                <h2 className="text-base font-semibold">寻访道友</h2>
                <p className="text-ink-secondary mt-1 text-sm">
                  请输入完整道号；同名结果会全部列出。
                </p>
              </div>
              <div className="flex flex-col gap-2 sm:flex-row sm:items-end">
                <div className="min-w-0 flex-1">
                  <InkInput
                    label="完整道号"
                    placeholder="输入道友完整名称"
                    value={friendSearchName}
                    onChange={(value) => {
                      setFriendSearchName(value);
                      setFriendSearchAttempted(false);
                    }}
                    onKeyDown={(event) => {
                      if (event.key === 'Enter') {
                        event.preventDefault();
                        void handleSearchFriends();
                      }
                    }}
                  />
                </div>
                <InkButton
                  variant="primary"
                  onClick={() => void handleSearchFriends()}
                  pending={friendSearching}
                  pendingLabel="寻访中……"
                >
                  搜索
                </InkButton>
              </div>
              {friendSearchResults.length > 0 ? (
                <InkList>
                  {friendSearchResults.map((result) => (
                    <div
                      key={result.id}
                      className="border-ink/10 flex flex-col gap-3 border-b border-dashed px-1 py-3 sm:flex-row sm:items-center sm:justify-between"
                    >
                      <div className="min-w-0 text-sm">
                        <p className="font-medium">{result.name}</p>
                        <p className="text-ink-secondary mt-1">
                          {result.realm} {result.realmStage}
                          {result.title ? ` · ${result.title}` : ''}
                        </p>
                        <p className="font-mono text-xs opacity-55">
                          道号标识：{result.id.slice(0, 8)}
                        </p>
                      </div>
                      <InkButton
                        variant={result.isFriend ? 'secondary' : 'primary'}
                        disabled={result.isFriend}
                        onClick={() => setFriendTargetId(result.id)}
                      >
                        {result.isFriend ? '已在名录中' : '查看并收录'}
                      </InkButton>
                    </div>
                  ))}
                </InkList>
              ) : friendSearchAttempted && !friendSearching ? (
                <InkNotice tone="muted">未寻到该道号的活跃道友。</InkNotice>
              ) : null}
            </section>

            <section className="space-y-3">
              <p className="text-ink-secondary text-sm">
                名录中共 {friends.length} / {MAX_FRIENDS_PER_CULTIVATOR} 位道友
              </p>
              {friendsLoading ? (
                <GameLoadingState message="正在翻检名录……" variant="inline" />
              ) : friends.length === 0 ? (
                <InkNotice>
                  尚未收录道友。可在上方搜索完整道号，或分享邀请链接与朋友结缘。
                </InkNotice>
              ) : (
                <InkList>
                  {friends.map((friend) => (
                    <div
                      key={friend.id}
                      className="border-ink/10 flex flex-col gap-3 border-b border-dashed px-1 py-3 sm:flex-row sm:items-center sm:justify-between"
                    >
                      <div className="min-w-0 text-sm">
                        <p className="truncate font-medium">{friend.name}</p>
                        <p className="text-ink-secondary mt-1">
                          {friend.realm} {friend.realmStage}
                          {friend.title ? ` · ${friend.title}` : ''}
                        </p>
                      </div>
                      <div className="flex shrink-0 flex-wrap gap-2">
                        <InkButton
                          variant="primary"
                          onClick={() => handleSendToFriend(friend.id)}
                        >
                          传音
                        </InkButton>
                        <InkButton
                          variant="secondary"
                          onClick={() => void handleRemoveFriend(friend.id)}
                        >
                          移除
                        </InkButton>
                      </div>
                    </div>
                  ))}
                </InkList>
              )}
            </section>
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
                {friend.name} · {friend.realm}
                {friend.realmStage}
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
              min={1}
              max={Math.min(
                selectedAttachment.quantity,
                MAX_PLAYER_ITEM_QUANTITY,
              )}
              value={attachmentQuantity}
              onChange={setAttachmentQuantity}
              hint={`最多 ${Math.min(
                selectedAttachment.quantity,
                MAX_PLAYER_ITEM_QUANTITY,
              )}`}
            />
          ) : null}
          <div className="flex justify-end gap-2">
            <InkButton onClick={() => setShowSendModal(false)}>取消</InkButton>
            <InkButton
              variant="primary"
              onClick={handleSendMail}
              disabled={friends.length === 0}
              pending={sending}
              pendingLabel="发送中……"
            >
              发出
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
            }}
          />
          {attachmentError ? (
            <InkNotice tone="danger">{attachmentError}</InkNotice>
          ) : null}
          {attachmentLoading ? (
            <GameLoadingState message="正在翻检储物袋……" variant="inline" />
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
                onClick={activeAttachmentInventory.goPrevPage}
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
                onClick={activeAttachmentInventory.goNextPage}
              >
                下一页
              </InkButton>
            </div>
          ) : null}
        </div>
      </InkModal>
      <FriendTargetModal
        targetId={activeFriendTargetId}
        onClose={() => {
          setFriendTargetId(null);
          clearInviteParam();
        }}
        onAdded={handleFriendAdded}
      />
      <InkModal
        isOpen={Boolean(manualShareLink)}
        onClose={() => setManualShareLink(null)}
        title="手动复制邀请链接"
      >
        <div className="space-y-4">
          <InkNotice tone="muted">
            当前浏览器未允许自动复制，请选中下方链接后手动复制。
          </InkNotice>
          <input
            readOnly
            value={manualShareLink ?? ''}
            onFocus={(event) => event.currentTarget.select()}
            className="border-ink/20 bg-paper-2 text-ink w-full border border-dashed px-3 py-2 font-mono text-sm"
            aria-label="好友邀请链接"
          />
          <div className="flex justify-end">
            <InkButton onClick={() => setManualShareLink(null)}>关闭</InkButton>
          </div>
        </div>
      </InkModal>
    </GameSceneFrame>
  );
}
