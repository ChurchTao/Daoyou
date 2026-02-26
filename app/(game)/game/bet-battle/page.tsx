'use client';

import { ItemDetailModal } from '@/app/(game)/game/inventory/components/ItemDetailModal';
import { formatProbeResultContent } from '@/components/func/ProbeResult';
import { InkPageShell, InkSection } from '@/components/layout';
import { InkModal } from '@/components/layout/InkModal';
import { useInkUI } from '@/components/providers/InkUIProvider';
import {
  InkActionGroup,
  InkBadge,
  InkButton,
  InkDialog,
  InkInput,
  InkList,
  InkNotice,
  InkTabs,
  type InkDialogState,
} from '@/components/ui';
import { EffectCard } from '@/components/ui/EffectCard';
import { tierColorMap, type Tier } from '@/components/ui/InkBadge';
import { useCultivator } from '@/lib/contexts/CultivatorContext';
import { REALM_VALUES, type RealmType } from '@/types/constants';
import type { Artifact, Consumable, Material } from '@/types/cultivator';
import {
  CONSUMABLE_TYPE_DISPLAY_MAP,
  getEquipmentSlotInfo,
  getMaterialTypeInfo,
} from '@/types/dictionaries';
import { usePathname } from 'next/navigation';
import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from 'react';

type BetStakeItemType = 'material' | 'artifact' | 'consumable';

type BetStakeSnapshotItem = {
  itemType: BetStakeItemType;
  itemId: string;
  name: string;
  quantity: number;
  quality: string;
  data: Material | Artifact | Consumable;
};

type BetStakeSnapshot = {
  stakeType: 'spirit_stones' | 'item';
  spiritStones: number;
  item: BetStakeSnapshotItem | null;
};

type BetBattleListing = {
  id: string;
  creatorId: string;
  creatorName: string;
  creatorRealm?: string;
  creatorRealmStage?: string;
  taunt?: string | null;
  status: 'pending' | 'matched' | 'cancelled' | 'expired' | 'settled';
  minRealm: RealmType;
  maxRealm: RealmType;
  creatorStakeSnapshot: BetStakeSnapshot;
  challengerId: string | null;
  challengerName: string | null;
  challengerStakeSnapshot: BetStakeSnapshot | null;
  winnerCultivatorId: string | null;
  battleRecordId: string | null;
  expiresAt: string;
  createdAt: string;
};

type InventoryItem =
  | (Material & { itemType: 'material' })
  | (Artifact & { itemType: 'artifact' })
  | (Consumable & { itemType: 'consumable' });

type SelectedStake = {
  itemType: BetStakeItemType;
  itemId: string;
  name: string;
  quality: string;
  maxQuantity: number;
  quantity: number;
};

const PAGE_LIMIT = 20;
const INVENTORY_PAGE_SIZE = 20;

type ItemType = 'material' | 'artifact' | 'consumable';
type InventoryApiType = 'materials' | 'artifacts' | 'consumables';

interface InventoryPagination {
  page: number;
  pageSize: number;
  total: number;
  totalPages: number;
  hasMore: boolean;
}

interface InventoryApiPayload {
  success: boolean;
  data?: {
    items?: Array<Material | Artifact | Consumable>;
    pagination?: InventoryPagination;
  };
  error?: string;
}

const defaultInventoryPagination: InventoryPagination = {
  page: 1,
  pageSize: INVENTORY_PAGE_SIZE,
  total: 0,
  totalPages: 0,
  hasMore: false,
};

const itemTypeToApiTypeMap: Record<ItemType, InventoryApiType> = {
  material: 'materials',
  artifact: 'artifacts',
  consumable: 'consumables',
};

function getQuality(item: InventoryItem): string {
  if (item.itemType === 'material') return item.rank;
  return item.quality || '凡品';
}

function getMaxQuantity(item: InventoryItem): number {
  return item.itemType === 'artifact' ? 1 : item.quantity;
}

function formatRemainTime(expiresAt: string): string {
  const diff = new Date(expiresAt).getTime() - Date.now();
  if (diff <= 0) return '已过期';
  const h = Math.floor(diff / 1000 / 60 / 60);
  const m = Math.floor((diff / 1000 / 60) % 60);
  return `${h}时${m}分`;
}

function countChars(input: string): number {
  return Array.from(input).length;
}

function formatStake(stake: BetStakeSnapshot): string {
  if (stake.stakeType === 'spirit_stones') {
    return `灵石 ${stake.spiritStones}`;
  }
  if (!stake.item) return '无';
  return `${stake.item.name} x${stake.item.quantity} (${stake.item.quality})`;
}

function normalizeStakeSnapshot(raw: unknown): BetStakeSnapshot {
  const value = raw as
    | BetStakeSnapshot
    | { spiritStones?: number; items?: BetStakeSnapshotItem[] };

  if ('stakeType' in value) {
    return {
      stakeType: value.stakeType,
      spiritStones: value.spiritStones || 0,
      item: value.item || null,
    };
  }

  const spirit = value.spiritStones || 0;
  if (spirit > 0) {
    return {
      stakeType: 'spirit_stones',
      spiritStones: spirit,
      item: null,
    };
  }

  return {
    stakeType: 'item',
    spiritStones: 0,
    item: value.items?.[0] || null,
  };
}

function getInventoryCardProps(item: InventoryItem) {
  if (item.itemType === 'material') {
    const typeInfo = getMaterialTypeInfo(item.type);
    return {
      icon: typeInfo.icon,
      quality: item.rank,
      badgeExtra: (
        <>
          <InkBadge tone="default">{typeInfo.label}</InkBadge>
          {item.element && <InkBadge tone="default">{item.element}</InkBadge>}
          <span className="text-ink-secondary text-sm">x{item.quantity}</span>
        </>
      ),
      effects: undefined,
      meta: null,
      description: item.description || '平平无奇的材料',
    };
  }

  if (item.itemType === 'artifact') {
    const slot = getEquipmentSlotInfo(item.slot);
    return {
      icon: slot.icon,
      quality: item.quality,
      badgeExtra: (
        <>
          <InkBadge tone="default">{item.element}</InkBadge>
          <InkBadge tone="default">{slot.label}</InkBadge>
          <span className="text-ink-secondary text-sm">x1</span>
        </>
      ),
      effects: item.effects,
      meta: item.required_realm ? (
        <span className="text-ink-secondary text-xs">
          境界要求：{item.required_realm}
        </span>
      ) : null,
      description: item.description,
    };
  }

  const typeInfo = CONSUMABLE_TYPE_DISPLAY_MAP[item.type];
  return {
    icon: typeInfo.icon,
    quality: item.quality,
    badgeExtra: (
      <>
        <InkBadge tone="default">{item.type}</InkBadge>
        <span className="text-ink-secondary text-sm">x{item.quantity}</span>
      </>
    ),
    effects: item.effects,
    meta: null,
    description: item.description,
  };
}

function getStatusMeta(status: BetBattleListing['status']) {
  switch (status) {
    case 'pending':
      return { label: '待应战', tone: 'accent' as const };
    case 'settled':
      return { label: '已结算', tone: 'default' as const };
    case 'cancelled':
      return { label: '已取消', tone: 'warning' as const };
    case 'expired':
      return { label: '已过期', tone: 'warning' as const };
    case 'matched':
      return { label: '进行中', tone: 'accent' as const };
    default:
      return { label: status, tone: 'default' as const };
  }
}

function useInventorySelector() {
  const [activeType, setActiveType] = useState<ItemType>('material');
  const [isItemsLoading, setIsItemsLoading] = useState(false);
  const [listError, setListError] = useState('');
  const [itemsByType, setItemsByType] = useState<
    Record<ItemType, InventoryItem[]>
  >({
    material: [],
    artifact: [],
    consumable: [],
  });
  const [paginationByType, setPaginationByType] = useState<
    Record<ItemType, InventoryPagination>
  >({
    material: defaultInventoryPagination,
    artifact: defaultInventoryPagination,
    consumable: defaultInventoryPagination,
  });
  const [loadedByType, setLoadedByType] = useState<Record<ItemType, boolean>>({
    material: false,
    artifact: false,
    consumable: false,
  });
  const requestIdRef = useRef(0);

  const fetchItemPage = useCallback(
    async (itemType: ItemType, page: number) => {
      const requestId = ++requestIdRef.current;
      setIsItemsLoading(true);
      setListError('');

      try {
        const apiType = itemTypeToApiTypeMap[itemType];
        const res = await fetch(
          `/api/cultivator/inventory?type=${apiType}&page=${Math.max(1, page)}&pageSize=${INVENTORY_PAGE_SIZE}`,
        );
        const result = (await res.json()) as InventoryApiPayload;
        if (!res.ok || !result.success) {
          throw new Error(result.error || '读取背包失败');
        }

        if (requestId !== requestIdRef.current) return;

        const mappedItems = (result.data?.items || []).map((item) => ({
          ...item,
          itemType,
        })) as InventoryItem[];

        setItemsByType((prev) => ({ ...prev, [itemType]: mappedItems }));
        setPaginationByType((prev) => ({
          ...prev,
          [itemType]: result.data?.pagination || {
            ...defaultInventoryPagination,
            pageSize: INVENTORY_PAGE_SIZE,
          },
        }));
        setLoadedByType((prev) => ({ ...prev, [itemType]: true }));
      } catch (error) {
        if (requestId !== requestIdRef.current) return;
        setListError(error instanceof Error ? error.message : '读取背包失败');
      } finally {
        if (requestId !== requestIdRef.current) return;
        setIsItemsLoading(false);
      }
    },
    [],
  );

  useEffect(() => {
    if (loadedByType[activeType]) return;
    void fetchItemPage(activeType, 1);
  }, [activeType, fetchItemPage, loadedByType]);

  return {
    activeType,
    setActiveType,
    isItemsLoading,
    listError,
    setListError,
    itemsByType,
    paginationByType,
    fetchItemPage,
  };
}

export default function BetBattlePage() {
  const pathname = usePathname();
  const { cultivator, refresh } = useCultivator();
  const { pushToast } = useInkUI();

  const [activeTab, setActiveTab] = useState<'hall' | 'mine'>('hall');
  const [hallListings, setHallListings] = useState<BetBattleListing[]>([]);
  const [myListings, setMyListings] = useState<BetBattleListing[]>([]);
  const [loadingHall, setLoadingHall] = useState(true);
  const [loadingMine, setLoadingMine] = useState(true);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [challengeTarget, setChallengeTarget] =
    useState<BetBattleListing | null>(null);
  const [pendingActionId, setPendingActionId] = useState<string | null>(null);
  const [probingId, setProbingId] = useState<string | null>(null);
  const [dialog, setDialog] = useState<InkDialogState | null>(null);
  const [selectedStakeDetail, setSelectedStakeDetail] = useState<
    Material | Artifact | Consumable | null
  >(null);

  const loadHall = async () => {
    setLoadingHall(true);
    try {
      const res = await fetch(
        `/api/bet-battles/listings?page=1&limit=${PAGE_LIMIT}`,
      );
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || '获取赌战列表失败');
      const normalized = ((data.listings || []) as BetBattleListing[]).map(
        (item) => ({
          ...item,
          creatorStakeSnapshot: normalizeStakeSnapshot(
            item.creatorStakeSnapshot,
          ),
          challengerStakeSnapshot: item.challengerStakeSnapshot
            ? normalizeStakeSnapshot(item.challengerStakeSnapshot)
            : null,
        }),
      );
      setHallListings(normalized);
    } catch (error) {
      pushToast({
        message: error instanceof Error ? error.message : '获取赌战列表失败',
        tone: 'danger',
      });
    } finally {
      setLoadingHall(false);
    }
  };

  const loadMine = async () => {
    if (!cultivator) return;
    setLoadingMine(true);
    try {
      const res = await fetch(`/api/bet-battles/my?page=1&limit=${PAGE_LIMIT}`);
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || '获取我的赌战失败');
      const normalized = ((data.listings || []) as BetBattleListing[]).map(
        (item) => ({
          ...item,
          creatorStakeSnapshot: normalizeStakeSnapshot(
            item.creatorStakeSnapshot,
          ),
          challengerStakeSnapshot: item.challengerStakeSnapshot
            ? normalizeStakeSnapshot(item.challengerStakeSnapshot)
            : null,
        }),
      );
      setMyListings(normalized);
    } catch (error) {
      pushToast({
        message: error instanceof Error ? error.message : '获取我的赌战失败',
        tone: 'danger',
      });
    } finally {
      setLoadingMine(false);
    }
  };

  useEffect(() => {
    void loadHall();
    if (cultivator) {
      void loadMine();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [cultivator?.id]);

  const canCreateMore = useMemo(() => {
    if (!cultivator) return false;
    return !myListings.some(
      (l) => l.creatorId === cultivator.id && l.status === 'pending',
    );
  }, [cultivator, myListings]);

  const handleCancel = async (battleId: string) => {
    setPendingActionId(battleId);
    try {
      const res = await fetch(`/api/bet-battles/${battleId}/cancel`, {
        method: 'POST',
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || '取消失败');
      pushToast({ message: data.message || '已取消', tone: 'success' });
      await Promise.all([loadHall(), loadMine(), refresh()]);
    } catch (error) {
      pushToast({
        message: error instanceof Error ? error.message : '取消失败',
        tone: 'danger',
      });
    } finally {
      setPendingActionId(null);
    }
  };

  const handleProbe = async (targetId: string) => {
    if (!cultivator?.id) return;
    setProbingId(targetId);
    try {
      const response = await fetch('/api/rankings/probe', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ targetId }),
      });
      const result = await response.json();
      if (!response.ok || !result.success) {
        throw new Error(result.error || '神识查探失败');
      }
      setDialog({
        id: 'bet-battle-probe',
        content: formatProbeResultContent(result.data),
        confirmLabel: '关闭',
      });
    } catch (error) {
      pushToast({
        message: error instanceof Error ? error.message : '神识查探失败',
        tone: 'danger',
      });
    } finally {
      setProbingId(null);
    }
  };

  const renderItem = (item: BetBattleListing, mine = false) => {
    const isCreator = item.creatorId === cultivator?.id;
    const canChallenge =
      !!cultivator &&
      !isCreator &&
      item.status === 'pending' &&
      new Date(item.expiresAt).getTime() > Date.now();
    const statusMeta = getStatusMeta(item.status);
    const remainText = formatRemainTime(item.expiresAt);
    const isEndingSoon =
      item.status === 'pending' &&
      remainText !== '已过期' &&
      remainText.startsWith('0时');

    const stake = item.creatorStakeSnapshot;
    let stakeSummary: ReactNode = '无';

    if (stake.stakeType === 'spirit_stones') {
      stakeSummary = `灵石 ${stake.spiritStones}`;
    } else if (stake.item) {
      const stakeItem = stake.item;
      const stakeItemTierClass =
        tierColorMap[stakeItem.quality as Tier] || 'text-ink';
      stakeSummary = (
        <>
          <button
            type="button"
            className={`${stakeItemTierClass} cursor-pointer hover:opacity-80`}
            onClick={() =>
              setSelectedStakeDetail(
                stakeItem.data as Material | Artifact | Consumable,
              )
            }
          >
            [{stakeItem.name}]
          </button>
          <span className="text-ink-secondary ml-1">x{stakeItem.quantity}</span>
        </>
      );
    }

    return (
      <div key={item.id} className="border-ink/20 border-b border-dashed py-3">
        <div className="text-ink-secondary space-y-2 text-xs">
          <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-sm">
            <span className="text-ink font-semibold">
              发起人: {item.creatorName}
              {isCreator ? ' (我)' : ''}
            </span>
            {item.creatorRealm && (
              <InkBadge tier={item.creatorRealm as Tier}>
                {item.creatorRealmStage}
              </InkBadge>
            )}
            <InkBadge tone={statusMeta.tone}>{statusMeta.label}</InkBadge>
          </div>
          <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
            <span className="text-ink font-medium">押注物品:</span>
            <span>{stakeSummary}</span>
          </div>
          <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
            <span className="text-ink font-medium">狠话:</span>
            <span className="text-ink-secondary">
              「{item.taunt?.trim() || '暂无'}」
            </span>
          </div>
          <div className="flex flex-wrap items-center justify-between gap-x-3 gap-y-1">
            <span>
              规则: 限制境界 {item.minRealm}-{item.maxRealm}
            </span>
            <span
              className={`whitespace-nowrap ${isEndingSoon ? 'font-semibold text-red-700' : ''}`}
            >
              {item.status === 'pending' ? `剩余: ${remainText}` : remainText}
            </span>
          </div>
          <div className="flex w-full justify-end gap-2 pt-1">
            {!isCreator && (
              <InkButton
                variant="secondary"
                onClick={() => void handleProbe(item.creatorId)}
                disabled={probingId === item.creatorId}
              >
                {probingId === item.creatorId ? '查探中…' : '神识查探'}
              </InkButton>
            )}
            {canChallenge && (
              <InkButton
                variant="primary"
                onClick={() => setChallengeTarget(item)}
                disabled={pendingActionId === item.id}
              >
                应战
              </InkButton>
            )}
            {mine &&
              isCreator &&
              item.status === 'pending' &&
              new Date(item.expiresAt).getTime() > Date.now() && (
                <InkButton
                  variant="secondary"
                  onClick={() => void handleCancel(item.id)}
                  disabled={pendingActionId === item.id}
                >
                  {pendingActionId === item.id ? '处理中' : '取消'}
                </InkButton>
              )}
          </div>
        </div>
      </div>
    );
  };

  return (
    <InkPageShell
      title="【赌战台】"
      subtitle={cultivator ? `灵石：${cultivator.spirit_stones}` : '路人止步'}
      backHref="/game"
      currentPath={pathname}
      footer={
        <InkActionGroup>
          <InkButton href="/game/mail">查看邮件</InkButton>
          <InkButton
            variant="primary"
            onClick={() => setShowCreateModal(true)}
            disabled={!cultivator || !canCreateMore}
          >
            发起赌战
          </InkButton>
        </InkActionGroup>
      }
    >
      <InkTabs
        items={[
          { label: '赌战大厅', value: 'hall' },
          { label: '我的赌战', value: 'mine' },
        ]}
        activeValue={activeTab}
        onChange={(value) => setActiveTab(value as 'hall' | 'mine')}
      />

      {activeTab === 'hall' ? (
        <InkSection title="">
          {loadingHall ? (
            <div className="py-10 text-center">正在加载赌战列表...</div>
          ) : hallListings.length === 0 ? (
            <InkNotice>暂无进行中的赌战</InkNotice>
          ) : (
            <InkList>{hallListings.map((item) => renderItem(item))}</InkList>
          )}
        </InkSection>
      ) : (
        <InkSection title="">
          {loadingMine ? (
            <div className="py-10 text-center">正在加载我的赌战...</div>
          ) : myListings.length === 0 ? (
            <InkNotice>你还没有参与过赌战</InkNotice>
          ) : (
            <InkList>
              {myListings.map((item) => renderItem(item, true))}
            </InkList>
          )}
        </InkSection>
      )}

      {showCreateModal && cultivator && (
        <BetBattleCreateModal
          onClose={() => setShowCreateModal(false)}
          onSuccess={async () => {
            setShowCreateModal(false);
            await Promise.all([loadHall(), loadMine(), refresh()]);
          }}
        />
      )}

      {challengeTarget && cultivator && (
        <BetBattleChallengeModal
          battle={challengeTarget}
          onClose={() => setChallengeTarget(null)}
          onSuccess={async () => {
            setChallengeTarget(null);
            await Promise.all([loadHall(), loadMine(), refresh()]);
          }}
        />
      )}

      <InkDialog dialog={dialog} onClose={() => setDialog(null)} />

      <ItemDetailModal
        isOpen={!!selectedStakeDetail}
        onClose={() => setSelectedStakeDetail(null)}
        item={selectedStakeDetail}
      />
    </InkPageShell>
  );
}

function BetBattleCreateModal({
  onClose,
  onSuccess,
}: {
  onClose: () => void;
  onSuccess: () => Promise<void>;
}) {
  const { pushToast } = useInkUI();
  const [selectedStakeType, setSelectedStakeType] = useState<
    'spirit_stones' | 'material' | 'artifact' | 'consumable'
  >('spirit_stones');
  const [selectedItem, setSelectedItem] = useState<SelectedStake | null>(null);
  const [spiritStones, setSpiritStones] = useState('');
  const [taunt, setTaunt] = useState('');
  const [minRealm, setMinRealm] = useState<RealmType>('炼气');
  const [maxRealm, setMaxRealm] = useState<RealmType>('渡劫');
  const [step, setStep] = useState<1 | 2>(1);
  const [submitting, setSubmitting] = useState(false);
  const {
    activeType,
    setActiveType,
    isItemsLoading,
    listError,
    setListError,
    itemsByType,
    paginationByType,
    fetchItemPage,
  } = useInventorySelector();

  const currentItems = itemsByType[activeType];
  const currentPagination = paginationByType[activeType];
  const spiritStoneValue = Math.max(0, Number(spiritStones) || 0);
  const canProceedToRuleStep =
    selectedStakeType === 'spirit_stones'
      ? spiritStoneValue > 0
      : !!selectedItem;

  useEffect(() => {
    if (selectedStakeType === 'spirit_stones') return;
    setActiveType(selectedStakeType);
  }, [selectedStakeType, setActiveType]);

  const handleSelectItem = (item: InventoryItem) => {
    const itemId = item.id;
    if (!itemId) return;
    setSelectedItem({
      itemType: item.itemType,
      itemId,
      name: item.name,
      quality: getQuality(item),
      maxQuantity: getMaxQuantity(item),
      quantity: 1,
    });
  };

  const updateQuantity = (value: string) => {
    const qty = Math.max(1, Number(value) || 1);
    setSelectedItem((prev) =>
      prev ? { ...prev, quantity: Math.min(qty, prev.maxQuantity) } : prev,
    );
  };

  const handleSubmit = async () => {
    const isStoneMode = selectedStakeType === 'spirit_stones';
    const normalizedTaunt = taunt.trim();

    if (isStoneMode && spiritStoneValue <= 0) {
      pushToast({ message: '灵石押注需大于0', tone: 'warning' });
      return;
    }

    if (!isStoneMode && !selectedItem) {
      pushToast({ message: '请选择一个押注道具', tone: 'warning' });
      return;
    }

    setSubmitting(true);
    try {
      const res = await fetch('/api/bet-battles/create', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          minRealm,
          maxRealm,
          taunt: normalizedTaunt || undefined,
          stakeType: isStoneMode ? 'spirit_stones' : 'item',
          spiritStones: isStoneMode ? spiritStoneValue : 0,
          stakeItem:
            !isStoneMode && selectedItem
              ? {
                  itemType: selectedItem.itemType,
                  itemId: selectedItem.itemId,
                  quantity: selectedItem.quantity,
                }
              : null,
        }),
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || '发起赌战失败');

      pushToast({ message: data.message || '赌战发起成功', tone: 'success' });
      await onSuccess();
    } catch (error) {
      pushToast({
        message: error instanceof Error ? error.message : '发起赌战失败',
        tone: 'danger',
      });
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <InkModal
      isOpen={true}
      onClose={onClose}
      title={step === 1 ? '发起赌战（选择押注）' : '发起赌战（设置规则）'}
      footer={
        <div className="mt-4 flex gap-2">
          {step === 2 && (
            <InkButton variant="secondary" onClick={() => setStep(1)}>
              上一步
            </InkButton>
          )}
          {step === 1 ? (
            <InkButton
              variant="primary"
              onClick={() => {
                if (!canProceedToRuleStep) {
                  pushToast({
                    message:
                      selectedStakeType === 'spirit_stones'
                        ? '灵石押注需大于0'
                        : '请先选择押注道具',
                    tone: 'warning',
                  });
                  return;
                }
                setStep(2);
              }}
              disabled={!canProceedToRuleStep}
            >
              下一步
            </InkButton>
          ) : (
            <InkButton
              variant="primary"
              onClick={() => void handleSubmit()}
              disabled={submitting}
            >
              {submitting ? '提交中' : '确认发起'}
            </InkButton>
          )}
          <InkButton variant="ghost" onClick={onClose}>
            关闭
          </InkButton>
        </div>
      }
    >
      {step === 1 ? (
        <div className="space-y-3">
          <InkTabs
            items={[
              { label: '灵石', value: 'spirit_stones' },
              { label: '材料', value: 'material' },
              { label: '法宝', value: 'artifact' },
              { label: '消耗品', value: 'consumable' },
            ]}
            activeValue={selectedStakeType}
            onChange={(value) => {
              setSelectedStakeType(
                value as
                  | 'spirit_stones'
                  | 'material'
                  | 'artifact'
                  | 'consumable',
              );
              setListError('');
              setSelectedItem(null);
            }}
          />

          {selectedStakeType === 'spirit_stones' ? (
            <InkInput
              label="灵石押注"
              value={spiritStones}
              onChange={(value) => setSpiritStones(value)}
              placeholder="输入灵石数量"
            />
          ) : (
            <>
              {isItemsLoading && currentItems.length === 0 ? (
                <div className="py-8 text-center">正在读取背包物品...</div>
              ) : listError ? (
                <InkNotice>{listError}</InkNotice>
              ) : currentItems.length === 0 ? (
                <InkNotice>该分类暂无可押注物品</InkNotice>
              ) : (
                <InkList>
                  {currentItems.map((item) => {
                    if (!item.id) return null;
                    const card = getInventoryCardProps(item);
                    const checked = selectedItem?.itemId === item.id;
                    return (
                      <EffectCard
                        key={`${item.itemType}-${item.id}`}
                        layout="col"
                        icon={card.icon}
                        name={item.name}
                        quality={card.quality}
                        badgeExtra={card.badgeExtra}
                        effects={card.effects}
                        meta={card.meta}
                        description={card.description}
                        highlight={checked}
                        actions={
                          <div className="flex gap-2">
                            <InkButton
                              variant={checked ? 'primary' : 'secondary'}
                              onClick={() => handleSelectItem(item)}
                            >
                              {checked ? '已选择' : '选择'}
                            </InkButton>
                          </div>
                        }
                      />
                    );
                  })}
                </InkList>
              )}

              {currentPagination.totalPages > 1 && (
                <div className="mt-2 flex items-center justify-center gap-4">
                  <InkButton
                    variant="secondary"
                    disabled={currentPagination.page <= 1 || isItemsLoading}
                    onClick={() =>
                      void fetchItemPage(activeType, currentPagination.page - 1)
                    }
                  >
                    上一页
                  </InkButton>
                  <span className="text-ink-secondary text-sm">
                    {currentPagination.page} / {currentPagination.totalPages}
                  </span>
                  <InkButton
                    variant="secondary"
                    disabled={
                      currentPagination.page >= currentPagination.totalPages ||
                      isItemsLoading
                    }
                    onClick={() =>
                      void fetchItemPage(activeType, currentPagination.page + 1)
                    }
                  >
                    下一页
                  </InkButton>
                </div>
              )}

              {selectedItem && (
                <div className="border-ink/10 rounded border p-2">
                  <div className="text-sm">
                    当前押注：{selectedItem.name}（{selectedItem.quality}）
                  </div>
                  <div className="mt-2 flex items-center gap-2">
                    <span className="text-ink-secondary text-sm">数量</span>
                    <input
                      className="w-20 border border-black/20 px-1 py-0.5 text-sm"
                      value={String(selectedItem.quantity)}
                      onChange={(e) => updateQuantity(e.target.value)}
                      disabled={selectedItem.itemType === 'artifact'}
                    />
                    <span className="text-ink-secondary text-xs">
                      最大 {selectedItem.maxQuantity}
                    </span>
                  </div>
                </div>
              )}
            </>
          )}
        </div>
      ) : (
        <div className="space-y-3">
          <label className="text-sm">
            最低境界
            <select
              className="mt-1 w-full border border-black/20 px-2 py-1"
              value={minRealm}
              onChange={(e) => setMinRealm(e.target.value as RealmType)}
            >
              {REALM_VALUES.map((realm) => (
                <option key={realm} value={realm}>
                  {realm}
                </option>
              ))}
            </select>
          </label>
          <label className="text-sm">
            最高境界
            <select
              className="mt-1 w-full border border-black/20 px-2 py-1"
              value={maxRealm}
              onChange={(e) => setMaxRealm(e.target.value as RealmType)}
            >
              {REALM_VALUES.map((realm) => (
                <option key={realm} value={realm}>
                  {realm}
                </option>
              ))}
            </select>
          </label>
          <InkInput
            label="狠话（可选，20字以内）"
            value={taunt}
            placeholder="例如：同境之内，谁敢接我战帖？"
            onChange={(value) => {
              const limited = Array.from(value).slice(0, 20).join('');
              setTaunt(limited);
            }}
            hint={`${countChars(taunt)}/20`}
          />

          <InkNotice>
            当前押注：
            <br />
            {selectedStakeType === 'spirit_stones'
              ? `灵石：${Math.max(0, Number(spiritStones) || 0)}`
              : selectedItem
                ? `${selectedItem.name} x${selectedItem.quantity}(${selectedItem.quality})`
                : '未选择道具'}
            <br />
            狠话：{taunt.trim() || '无'}
          </InkNotice>
        </div>
      )}
    </InkModal>
  );
}

function BetBattleChallengeModal({
  battle,
  onClose,
  onSuccess,
}: {
  battle: BetBattleListing;
  onClose: () => void;
  onSuccess: () => Promise<void>;
}) {
  const { pushToast } = useInkUI();
  const creatorStake = battle.creatorStakeSnapshot;
  const [selectedItem, setSelectedItem] = useState<SelectedStake | null>(null);
  const [spiritStones, setSpiritStones] = useState(
    String(creatorStake.spiritStones),
  );
  const [submitting, setSubmitting] = useState(false);
  const {
    activeType,
    setActiveType,
    isItemsLoading,
    listError,
    setListError,
    itemsByType,
    paginationByType,
    fetchItemPage,
  } = useInventorySelector();

  const requiredItem = creatorStake.item;

  useEffect(() => {
    if (creatorStake.stakeType === 'item' && requiredItem) {
      setActiveType(requiredItem.itemType);
    }
  }, [creatorStake.stakeType, requiredItem, setActiveType]);

  const availableCandidates = useMemo(() => {
    if (creatorStake.stakeType !== 'item' || !requiredItem) return [];
    return itemsByType[activeType].filter((item) => {
      const maxQuantity = getMaxQuantity(item);
      const quality = getQuality(item);
      return (
        requiredItem.itemType === item.itemType &&
        requiredItem.quality === quality &&
        maxQuantity >= requiredItem.quantity
      );
    });
  }, [activeType, creatorStake.stakeType, itemsByType, requiredItem]);

  const currentPagination = paginationByType[activeType];

  const selectCandidate = (item: InventoryItem, fixedQuantity: number) => {
    const itemId = item.id;
    if (!itemId) return;
    setSelectedItem({
      itemType: item.itemType,
      itemId,
      name: item.name,
      quality: getQuality(item),
      maxQuantity: getMaxQuantity(item),
      quantity: fixedQuantity,
    });
  };

  const handleSubmit = async () => {
    setSubmitting(true);
    try {
      const isStone = creatorStake.stakeType === 'spirit_stones';
      const res = await fetch(`/api/bet-battles/${battle.id}/challenge`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          stakeType: creatorStake.stakeType,
          spiritStones: isStone ? Math.max(0, Number(spiritStones) || 0) : 0,
          stakeItem:
            !isStone && selectedItem
              ? {
                  itemType: selectedItem.itemType,
                  itemId: selectedItem.itemId,
                  quantity: selectedItem.quantity,
                }
              : null,
        }),
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || '应战失败');

      pushToast({ message: data.message || '应战成功', tone: 'success' });
      await onSuccess();
    } catch (error) {
      pushToast({
        message: error instanceof Error ? error.message : '应战失败',
        tone: 'danger',
      });
    } finally {
      setSubmitting(false);
    }
  };

  const isProbablyMatched =
    creatorStake.stakeType === 'spirit_stones'
      ? Number(spiritStones) === creatorStake.spiritStones
      : !!selectedItem &&
        !!requiredItem &&
        selectedItem.itemType === requiredItem.itemType &&
        selectedItem.quality === requiredItem.quality &&
        selectedItem.quantity === requiredItem.quantity;

  return (
    <InkModal
      isOpen={true}
      onClose={onClose}
      title="应战赌战"
      footer={
        <div className="mt-4 flex gap-2">
          <InkButton
            variant="primary"
            onClick={() => void handleSubmit()}
            disabled={submitting}
          >
            {submitting ? '应战中' : '确认应战'}
          </InkButton>
          <InkButton variant="ghost" onClick={onClose}>
            关闭
          </InkButton>
        </div>
      }
    >
      <div className="space-y-3">
        <InkNotice>
          对方押注：
          <br />
          {formatStake(creatorStake)}
          <br />
          规则：同类型、同品质、同数量，且只能押注一项
        </InkNotice>

        {creatorStake.stakeType === 'spirit_stones' ? (
          <InkInput
            label="灵石押注（需与对方一致）"
            value={spiritStones}
            onChange={(value) => setSpiritStones(value)}
          />
        ) : (
          <>
            <InkTabs
              items={[
                { label: '材料', value: 'material' },
                { label: '法宝', value: 'artifact' },
                { label: '消耗品', value: 'consumable' },
              ]}
              activeValue={activeType}
              onChange={(value) => {
                setActiveType(value as ItemType);
                setListError('');
              }}
            />

            {isItemsLoading && availableCandidates.length === 0 ? (
              <div className="py-8 text-center">正在读取背包物品...</div>
            ) : listError ? (
              <InkNotice>{listError}</InkNotice>
            ) : (
              <InkList>
                {availableCandidates.length === 0 ? (
                  <InkNotice>当前分类无可用于应战的物品</InkNotice>
                ) : (
                  availableCandidates.map((item) => {
                    if (!requiredItem || !item.id) return null;
                    const checked = selectedItem?.itemId === item.id;
                    const card = getInventoryCardProps(item);
                    return (
                      <EffectCard
                        key={`${item.itemType}-${item.id}`}
                        layout="col"
                        icon={card.icon}
                        name={item.name}
                        quality={card.quality}
                        badgeExtra={card.badgeExtra}
                        effects={card.effects}
                        meta={card.meta}
                        description={card.description}
                        highlight={checked}
                        actions={
                          <InkButton
                            variant={checked ? 'primary' : 'secondary'}
                            onClick={() =>
                              selectCandidate(item, requiredItem.quantity)
                            }
                          >
                            {checked ? '已选择' : '选择'}
                          </InkButton>
                        }
                      />
                    );
                  })
                )}
              </InkList>
            )}
          </>
        )}

        {creatorStake.stakeType === 'item' &&
          currentPagination.totalPages > 1 && (
            <div className="mt-2 flex items-center justify-center gap-4">
              <InkButton
                variant="secondary"
                disabled={currentPagination.page <= 1 || isItemsLoading}
                onClick={() =>
                  void fetchItemPage(activeType, currentPagination.page - 1)
                }
              >
                上一页
              </InkButton>
              <span className="text-ink-secondary text-sm">
                {currentPagination.page} / {currentPagination.totalPages}
              </span>
              <InkButton
                variant="secondary"
                disabled={
                  currentPagination.page >= currentPagination.totalPages ||
                  isItemsLoading
                }
                onClick={() =>
                  void fetchItemPage(activeType, currentPagination.page + 1)
                }
              >
                下一页
              </InkButton>
            </div>
          )}

        <div className="text-sm">
          当前选择：
          {creatorStake.stakeType === 'spirit_stones'
            ? ` 灵石 ${Math.max(0, Number(spiritStones) || 0)}`
            : selectedItem
              ? ` ${selectedItem.name} x${selectedItem.quantity}`
              : ' 无'}
        </div>
        <div className="text-sm">
          匹配检查：{isProbablyMatched ? '看起来已匹配' : '请继续调整'}
        </div>
      </div>
    </InkModal>
  );
}
