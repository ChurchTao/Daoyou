'use client';

import { InkModal } from '@/components/layout';
import { useInkUI } from '@/components/providers/InkUIProvider';
import { InkBadge } from '@/components/ui/InkBadge';
import { InkButton } from '@/components/ui/InkButton';
import { InkInput } from '@/components/ui/InkInput';
import { InkList, InkListItem } from '@/components/ui/InkList';
import { InkNotice } from '@/components/ui/InkNotice';
import { InkTabs } from '@/components/ui/InkTabs';
import type { Artifact, Consumable, Material } from '@/types/cultivator';
import {
  CONSUMABLE_TYPE_DISPLAY_MAP,
  getEquipmentSlotInfo,
  getMaterialTypeInfo,
} from '@/types/dictionaries';
import type { WorldChatMessageDTO } from '@/types/world-chat';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { WorldChatMessageItem } from './WorldChatMessageItem';

const PAGE_SIZE = 20;
const POLL_INTERVAL_MS = 15 * 1000;
const MAX_LENGTH = 100;
const SHOWCASE_PAGE_SIZE = 20;

type ShowcaseTab = 'artifacts' | 'materials' | 'consumables';

type ShowcaseItemByTab = {
  artifacts: Artifact;
  materials: Material;
  consumables: Consumable;
};

interface InventoryApiPayload<T> {
  success: boolean;
  data?: {
    items?: T[];
  };
  error?: string;
}

function countChars(input: string): number {
  return Array.from(input).length;
}

function mergeById(
  base: WorldChatMessageDTO[],
  incoming: WorldChatMessageDTO[],
): WorldChatMessageDTO[] {
  const seen = new Set<string>();
  const merged = [...incoming, ...base].filter((item) => {
    if (seen.has(item.id)) return false;
    seen.add(item.id);
    return true;
  });
  return merged.sort((a, b) => +new Date(b.createdAt) - +new Date(a.createdAt));
}

function tabToMessageItemType(
  tab: ShowcaseTab,
): 'artifact' | 'material' | 'consumable' {
  if (tab === 'artifacts') return 'artifact';
  if (tab === 'materials') return 'material';
  return 'consumable';
}

export function WorldChatPanel() {
  const { pushToast } = useInkUI();
  const [messages, setMessages] = useState<WorldChatMessageDTO[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [hasMore, setHasMore] = useState(false);
  const [page, setPage] = useState(1);
  const [posting, setPosting] = useState(false);
  const [input, setInput] = useState('');
  const [showcaseOpen, setShowcaseOpen] = useState(false);
  const [showcaseText, setShowcaseText] = useState('');
  const [showcaseTab, setShowcaseTab] = useState<ShowcaseTab>('artifacts');
  const [showcaseLoading, setShowcaseLoading] = useState(false);
  const [showcaseItems, setShowcaseItems] = useState<{
    artifacts: Artifact[];
    materials: Material[];
    consumables: Consumable[];
  }>({
    artifacts: [],
    materials: [],
    consumables: [],
  });
  const [showcaseLoaded, setShowcaseLoaded] = useState<
    Record<ShowcaseTab, boolean>
  >({
    artifacts: false,
    materials: false,
    consumables: false,
  });
  const messageListRef = useRef<HTMLDivElement | null>(null);
  const shouldStickBottomRef = useRef(true);
  const skipNextAutoScrollRef = useRef(false);

  const charCount = useMemo(() => countChars(input), [input]);
  const displayMessages = useMemo(() => [...messages].reverse(), [messages]);

  const fetchPage = useCallback(
    async (targetPage: number, append: boolean) => {
      try {
        if (append) {
          setLoadingMore(true);
        } else {
          setLoading(true);
        }

        const res = await fetch(
          `/api/world-chat/messages?page=${targetPage}&pageSize=${PAGE_SIZE}`,
          { cache: 'no-store' },
        );
        const data = await res.json();
        if (!res.ok || !data.success) {
          throw new Error(data.error || '获取世界传音失败');
        }

        const nextMessages = (data.data || []) as WorldChatMessageDTO[];
        skipNextAutoScrollRef.current = append;
        setMessages((prev) =>
          append ? [...prev, ...nextMessages] : nextMessages,
        );
        setHasMore(Boolean(data.pagination?.hasMore));
        setPage(targetPage);
      } catch (error) {
        pushToast({
          message: error instanceof Error ? error.message : '获取世界传音失败',
          tone: 'danger',
        });
      } finally {
        if (append) {
          setLoadingMore(false);
        } else {
          setLoading(false);
        }
      }
    },
    [pushToast],
  );

  const fetchShowcaseItems = useCallback(
    async (tab: ShowcaseTab) => {
      setShowcaseLoading(true);
      try {
        const res = await fetch(
          `/api/cultivator/inventory?type=${tab}&page=1&pageSize=${SHOWCASE_PAGE_SIZE}`,
          { cache: 'no-store' },
        );
        const data = (await res.json()) as InventoryApiPayload<
          ShowcaseItemByTab[ShowcaseTab]
        >;
        if (!res.ok || !data.success) {
          throw new Error(data.error || '读取储物袋失败');
        }

        setShowcaseItems((prev) => ({
          ...prev,
          [tab]: (data.data?.items || []) as ShowcaseItemByTab[typeof tab][],
        }));
        setShowcaseLoaded((prev) => ({ ...prev, [tab]: true }));
      } catch (error) {
        pushToast({
          message: error instanceof Error ? error.message : '读取储物袋失败',
          tone: 'danger',
        });
      } finally {
        setShowcaseLoading(false);
      }
    },
    [pushToast],
  );

  useEffect(() => {
    fetchPage(1, false);
  }, [fetchPage]);

  useEffect(() => {
    const timer = setInterval(async () => {
      try {
        const res = await fetch('/api/world-chat/messages?page=1&pageSize=20', {
          cache: 'no-store',
        });
        const data = await res.json();
        if (!res.ok || !data.success) return;
        const latest = (data.data || []) as WorldChatMessageDTO[];
        setMessages((prev) => mergeById(prev, latest));
      } catch (error) {
        console.error('轮询世界传音失败:', error);
      }
    }, POLL_INTERVAL_MS);

    return () => clearInterval(timer);
  }, []);

  useEffect(() => {
    if (!showcaseOpen || showcaseLoaded[showcaseTab]) return;
    void fetchShowcaseItems(showcaseTab);
  }, [fetchShowcaseItems, showcaseLoaded, showcaseOpen, showcaseTab]);

  useEffect(() => {
    if (skipNextAutoScrollRef.current) {
      skipNextAutoScrollRef.current = false;
      return;
    }
    if (!shouldStickBottomRef.current) return;
    const el = messageListRef.current;
    if (!el) return;
    el.scrollTop = el.scrollHeight;
  }, [messages]);

  const handleLoadMore = async () => {
    if (!hasMore || loadingMore) return;
    await fetchPage(page + 1, true);
  };

  const handleSend = async () => {
    const text = input.trim();
    const length = countChars(text);
    if (length < 1 || length > MAX_LENGTH) {
      pushToast({ message: '消息长度需在 1-100 字之间', tone: 'warning' });
      return;
    }

    try {
      setPosting(true);
      const res = await fetch('/api/world-chat/messages', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          messageType: 'text',
          textContent: text,
          payload: { text },
        }),
      });
      const data = await res.json();
      if (!res.ok || !data.success) {
        throw new Error(data.error || '发送失败');
      }

      const created = data.data as WorldChatMessageDTO;
      setInput('');
      setMessages((prev) => mergeById(prev, [created]));
      pushToast({ message: '已发出传音', tone: 'success' });
    } catch (error) {
      pushToast({
        message: error instanceof Error ? error.message : '发送失败',
        tone: 'danger',
      });
    } finally {
      setPosting(false);
    }
  };

  const handleSendShowcase = async (
    tab: ShowcaseTab,
    item: ShowcaseItemByTab[ShowcaseTab],
  ) => {
    if (!item.id) {
      pushToast({ message: '道具缺少唯一标识，无法展示', tone: 'warning' });
      return;
    }

    try {
      setPosting(true);
      const res = await fetch('/api/world-chat/messages', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          messageType: 'item_showcase',
          itemType: tabToMessageItemType(tab),
          itemId: item.id,
          textContent: showcaseText.trim() || undefined,
        }),
      });
      const data = await res.json();
      if (!res.ok || !data.success) {
        throw new Error(data.error || '发送失败');
      }

      const created = data.data as WorldChatMessageDTO;
      setMessages((prev) => mergeById(prev, [created]));
      setShowcaseOpen(false);
      setShowcaseText('');
      pushToast({ message: '已展示道具', tone: 'success' });
    } catch (error) {
      pushToast({
        message: error instanceof Error ? error.message : '发送失败',
        tone: 'danger',
      });
    } finally {
      setPosting(false);
    }
  };

  const renderShowcaseMeta = (
    tab: ShowcaseTab,
    item: ShowcaseItemByTab[ShowcaseTab],
  ) => {
    if (tab === 'artifacts') {
      const artifact = item as Artifact;
      const slotInfo = getEquipmentSlotInfo(artifact.slot);
      return (
        <div className="flex flex-wrap gap-1">
          {artifact.quality && (
            <InkBadge tier={artifact.quality}>法宝</InkBadge>
          )}
          <InkBadge tone="default">{slotInfo.label}</InkBadge>
          <InkBadge tone="default">{artifact.element}</InkBadge>
        </div>
      );
    }

    if (tab === 'materials') {
      const material = item as Material;
      const typeInfo = getMaterialTypeInfo(material.type);
      return (
        <div className="flex flex-wrap gap-1">
          <InkBadge tier={material.rank}>{typeInfo.label}</InkBadge>
          {material.element && (
            <InkBadge tone="default">{material.element}</InkBadge>
          )}
          <InkBadge tone="default">{`数量×${material.quantity}`}</InkBadge>
        </div>
      );
    }

    const consumable = item as Consumable;
    const typeInfo = CONSUMABLE_TYPE_DISPLAY_MAP[consumable.type];
    return (
      <div className="flex flex-wrap gap-1">
        {consumable.quality && (
          <InkBadge tier={consumable.quality}>{typeInfo.label}</InkBadge>
        )}
        <InkBadge tone="default">{`数量×${consumable.quantity}`}</InkBadge>
      </div>
    );
  };

  const currentShowcaseItems = showcaseItems[
    showcaseTab
  ] as ShowcaseItemByTab[ShowcaseTab][];

  return (
    <>
      <div className="space-y-4">
        <div
          ref={messageListRef}
          className="h-80 overflow-y-auto pr-1"
          onScroll={(event) => {
            const el = event.currentTarget;
            const distanceToBottom =
              el.scrollHeight - el.scrollTop - el.clientHeight;
            shouldStickBottomRef.current = distanceToBottom < 48;
          }}
        >
          {loading ? (
            <InkNotice>世界传音加载中……</InkNotice>
          ) : messages.length === 0 ? (
            <InkNotice>暂时无人发言，快来抢占第一条。</InkNotice>
          ) : (
            <div>
              {hasMore && (
                <div className="mb-2 flex justify-center">
                  <InkButton onClick={handleLoadMore} disabled={loadingMore}>
                    {loadingMore ? '加载中...' : '加载更早消息'}
                  </InkButton>
                </div>
              )}
              {displayMessages.map((message) => (
                <WorldChatMessageItem key={message.id} message={message} />
              ))}
            </div>
          )}
        </div>

        <div className="space-y-2 pt-3">
          <InkInput
            label="发送世界消息"
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
              disabled={posting || charCount < 1}
            >
              {posting ? '传音中...' : '发送'}
            </InkButton>
          </div>
        </div>
      </div>

      <InkModal
        isOpen={showcaseOpen}
        onClose={() => setShowcaseOpen(false)}
        title="展示储物袋道具"
        className="max-w-xl"
      >
        <div className="space-y-3">
          <InkTabs
            activeValue={showcaseTab}
            onChange={(value) => setShowcaseTab(value as ShowcaseTab)}
            items={[
              { label: '法宝', value: 'artifacts' },
              { label: '材料', value: 'materials' },
              { label: '消耗品', value: 'consumables' },
            ]}
          />
          <InkInput
            label="附言（可选）"
            value={showcaseText}
            multiline
            rows={2}
            placeholder="例如：此宝与我有缘，诸位道友请鉴赏。"
            onChange={(next) => {
              const limited = Array.from(next).slice(0, MAX_LENGTH).join('');
              setShowcaseText(limited);
            }}
            hint={`${countChars(showcaseText)}/${MAX_LENGTH}`}
            disabled={posting}
          />

          {showcaseLoading ? (
            <InkNotice>读取储物袋中……</InkNotice>
          ) : currentShowcaseItems.length === 0 ? (
            <InkNotice>当前分类暂无可展示道具</InkNotice>
          ) : (
            <div className="max-h-[44vh] overflow-y-auto pr-1">
              <InkList dense>
                {currentShowcaseItems.map((item) => (
                  <InkListItem
                    key={item.id || `${showcaseTab}-${item.name}`}
                    title={item.name}
                    meta={renderShowcaseMeta(showcaseTab, item)}
                    actions={
                      <InkButton
                        onClick={() => handleSendShowcase(showcaseTab, item)}
                        disabled={posting}
                      >
                        展示
                      </InkButton>
                    }
                  />
                ))}
              </InkList>
            </div>
          )}
        </div>
      </InkModal>
    </>
  );
}
