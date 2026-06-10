import { InkModal } from '@app/components/layout';
import { useInkUI } from '@app/components/providers/InkUIProvider';
import { InkBadge } from '@app/components/ui/InkBadge';
import { InkButton } from '@app/components/ui/InkButton';
import { InkInput } from '@app/components/ui/InkInput';
import { InkList, InkListItem } from '@app/components/ui/InkList';
import { InkNotice } from '@app/components/ui/InkNotice';
import { InkTabs } from '@app/components/ui/InkTabs';
import type { Artifact, Consumable, Material } from '@shared/types/cultivator';
import {
  CONSUMABLE_TYPE_DISPLAY_MAP,
  getEquipmentSlotInfo,
  getMaterialTypeInfo,
  getResourceTypeLabel,
} from '@shared/lib/gameConceptDisplay';
import { useEffect, useMemo, useRef, useState } from 'react';
import { WorldChatMessageItem } from './WorldChatMessageItem';
import { useWorldChatFeedModel } from './useWorldChatFeedModel';

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

function tabToMessageItemType(
  tab: ShowcaseTab,
): 'artifact' | 'material' | 'consumable' {
  if (tab === 'artifacts') return 'artifact';
  if (tab === 'materials') return 'material';
  return 'consumable';
}

export function WorldChatChannel() {
  const { pushToast } = useInkUI();
  const {
    messages,
    loading,
    loadingMore,
    hasMore,
    posting,
    loadMore,
    sendTextMessage,
    sendShowcaseMessage,
  } = useWorldChatFeedModel();
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
  const showcaseLoadingRef = useRef(false);

  const charCount = useMemo(() => countChars(input), [input]);
  const displayMessages = useMemo(() => [...messages].reverse(), [messages]);
  const currentShowcaseItems = showcaseItems[
    showcaseTab
  ] as ShowcaseItemByTab[ShowcaseTab][];

  useEffect(() => {
    if (!showcaseOpen || showcaseLoaded[showcaseTab] || showcaseLoadingRef.current) {
      return;
    }

    let cancelled = false;
    showcaseLoadingRef.current = true;
    setShowcaseLoading(true);

    const loadShowcaseItems = async () => {
      try {
        const res = await fetch(
          `/api/cultivator/inventory?type=${showcaseTab}&page=1&pageSize=${SHOWCASE_PAGE_SIZE}`,
          { cache: 'no-store' },
        );
        const data = (await res.json()) as InventoryApiPayload<
          ShowcaseItemByTab[ShowcaseTab]
        >;
        if (!res.ok || !data.success) {
          throw new Error(data.error || '读取储物袋失败');
        }

        if (cancelled) return;

        setShowcaseItems((prev) => ({
          ...prev,
          [showcaseTab]: (data.data?.items || []) as ShowcaseItemByTab[typeof showcaseTab][],
        }));
        setShowcaseLoaded((prev) => ({ ...prev, [showcaseTab]: true }));
      } catch (error) {
        if (cancelled) return;
        pushToast({
          message: error instanceof Error ? error.message : '读取储物袋失败',
          tone: 'danger',
        });
      } finally {
        showcaseLoadingRef.current = false;
        if (!cancelled) {
          setShowcaseLoading(false);
        }
      }
    };

    void loadShowcaseItems();

    return () => {
      cancelled = true;
    };
  }, [pushToast, showcaseLoaded, showcaseOpen, showcaseTab]);

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

  const handleSendShowcase = async (
    tab: ShowcaseTab,
    item: ShowcaseItemByTab[ShowcaseTab],
  ) => {
    if (!item.id) {
      pushToast({ message: '道具缺少唯一标识，无法展示', tone: 'warning' });
      return;
    }

    const sent = await sendShowcaseMessage({
      itemType: tabToMessageItemType(tab),
      itemId: item.id,
      textContent: showcaseText.trim() || undefined,
    });

    if (sent) {
      setShowcaseOpen(false);
      setShowcaseText('');
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
          {artifact.quality ? (
            <InkBadge tier={artifact.quality}>法宝</InkBadge>
          ) : null}
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
          {material.element ? (
            <InkBadge tone="default">{material.element}</InkBadge>
          ) : null}
          <InkBadge tone="default">{`数量×${material.quantity}`}</InkBadge>
        </div>
      );
    }

    const consumable = item as Consumable;
    const typeInfo = CONSUMABLE_TYPE_DISPLAY_MAP[consumable.type];
    return (
      <div className="flex flex-wrap gap-1">
        {consumable.quality ? (
          <InkBadge tier={consumable.quality}>{typeInfo.label}</InkBadge>
        ) : null}
        <InkBadge tone="default">{`数量×${consumable.quantity}`}</InkBadge>
      </div>
    );
  };

  return (
    <>
      <div className="space-y-4">
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
            <InkNotice>加载中……</InkNotice>
          ) : messages.length === 0 ? (
            <InkNotice>暂无传音。</InkNotice>
          ) : (
            <div>
              {hasMore ? (
                <div className="mb-2 flex justify-center">
                  <InkButton onClick={handleLoadMore} disabled={loadingMore}>
                    {loadingMore ? '加载中...' : '加载更早消息'}
                  </InkButton>
                </div>
              ) : null}
              {displayMessages.map((message) => (
                <WorldChatMessageItem key={message.id} message={message} />
              ))}
            </div>
          )}
        </div>

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
              { label: getResourceTypeLabel('artifact'), value: 'artifacts' },
              { label: getResourceTypeLabel('material'), value: 'materials' },
              { label: getResourceTypeLabel('consumable'), value: 'consumables' },
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
