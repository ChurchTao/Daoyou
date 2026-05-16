import { getCreationProductTypeFromCraftType } from '@shared/engine/creation-v2/config/CreationCraftPolicy';
import {
  CreationProductResultModal, type CreationProductResultRecord, } from '@app/components/feature/creation';
import { GameSceneAsideSection, GameSceneFrame, GameSceneLoading } from '@app/components/game-shell';
import { InkSection } from '@app/components/layout';
import {
  toProductDisplayModel, type ProductDisplayModel, } from '@app/components/feature/products';
import { useInkUI } from '@app/components/providers/InkUIProvider';
import { InkActionGroup, InkBadge, InkButton, InkNotice } from '@app/components/ui';
import { useCultivator } from '@app/lib/contexts/CultivatorContext';
import { Suspense, useEffect, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router';


type V2Product = ProductDisplayModel & { id: string };
type PendingItem = CreationProductResultRecord & { snapshot: string };

function V2ProductCard({
  product,
  isSelected,
  onToggle,
  actionLabel,
}: {
  product: V2Product;
  isSelected: boolean;
  onToggle: () => void;
  actionLabel: [string, string];
}) {
  return (
    <div
      className={`border p-3 space-y-2 transition-colors cursor-pointer ${isSelected ? 'border-ink/50 bg-ink/5' : 'border-ink/10'}`}
      onClick={onToggle}
    >
      <div className="flex items-center justify-between">
        <span className="font-medium text-sm">{product.name}</span>
        <InkButton
          variant={isSelected ? 'primary' : 'secondary'}
          onClick={onToggle}
        >
          {isSelected ? actionLabel[0] : actionLabel[1]}
        </InkButton>
      </div>
      <div className="flex flex-wrap gap-1">
        {product.quality && <InkBadge tier={product.quality as never} />}
        {product.element && (
          <InkBadge tone="default">{product.element}</InkBadge>
        )}
        <InkBadge tone="default">{`评分 ${product.score}`}</InkBadge>
      </div>
      {product.affixes.length > 0 && (
        <ul className="text-ink-secondary text-xs space-y-0.5">
          {product.affixes.map((a) => (
            <li key={a.id} className="flex items-center gap-1">
              <span>{a.isPerfect ? '✦' : '◆'}</span>
              <span>{a.name}</span>
              {a.isPerfect && <span className="text-wood">（完美）</span>}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

function ReplaceContent() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const craftType = searchParams.get('type');
  const { cultivator, refreshCultivator } = useCultivator();
  const { pushToast, openDialog } = useInkUI();

  const [loading, setLoading] = useState(false);
  const [initializing, setInitializing] = useState(true);
  const [pendingItem, setPendingItem] = useState<PendingItem | null>(null);
  const [existingItems, setExistingItems] = useState<V2Product[]>([]);
  const [selectedOldId, setSelectedOldId] = useState<string | null>(null);
  const [isPendingModalOpen, setIsPendingModalOpen] = useState(false);

  const productType = craftType
    ? getCreationProductTypeFromCraftType(craftType)
    : undefined;
  const isSkill = productType === 'skill';

  useEffect(() => {
    if (!cultivator || !craftType || !productType) {
      return;
    }

    let cancelled = false;

    const loadData = async () => {
      try {
        const [pendingRes, existingRes] = await Promise.all([
          fetch(`/api/craft/pending?type=${craftType}`),
          fetch(`/api/v2/products?type=${productType}`),
        ]);
        const [pendingData, existingData] = await Promise.all([
          pendingRes.json(),
          existingRes.json(),
        ]);

        if (cancelled) return;

        if (pendingData.success && pendingData.hasPending) {
          setPendingItem(pendingData.item);
        } else {
          navigate(-1);
          return;
        }

        if (existingData.success) {
          const items: V2Product[] = (existingData.data ?? []).map(
            (item: Record<string, unknown>) => ({
              id: item.id as string,
              ...toProductDisplayModel(item),
            }),
          );
          setExistingItems(items);
        }
      } catch (e) {
        if (!cancelled) {
          console.error('获取数据失败:', e);
        }
      } finally {
        if (!cancelled) {
          setInitializing(false);
        }
      }
    };

    void loadData();

    return () => {
      cancelled = true;
    };
  }, [craftType, cultivator, navigate, productType]);

  const handleConfirm = async (isAbandon: boolean) => {
    if (!isAbandon && !selectedOldId) {
      pushToast({ message: '请选择需要舍弃的旧法门', tone: 'warning' });
      return;
    }

    setLoading(true);
    try {
      const res = await fetch('/api/craft/confirm', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          craftType,
          replaceId: isAbandon ? null : selectedOldId,
          abandon: isAbandon,
        }),
      });
      const data = await res.json();

      if (!res.ok) throw new Error(data.error || '确认失败');

      openDialog({
        title: isAbandon ? '尘缘尽散' : '领悟成功',
        content: <p>{data.message}</p>,
        onConfirm: async () => {
          await refreshCultivator();
          navigate(isSkill ? '/game/skills' : '/game/techniques');
        },
        confirmLabel: '善哉',
      });
    } catch (error: unknown) {
      const msg = error instanceof Error ? error.message : '操作失败';
      pushToast({ message: msg, tone: 'danger' });
    } finally {
      setLoading(false);
    }
  };

  if (initializing || !cultivator) return null;
  if (!pendingItem) {
    return (
      <GameSceneFrame
        variant="lite"
        title={isSkill ? '神通突围' : '功法破障'}
        description="当前没有待处理的新法门。"
      >
        <InkNotice>无可领悟之法</InkNotice>
      </GameSceneFrame>
    );
  }

  return (
    <GameSceneFrame
      variant="workflow"
      title={isSkill ? '神通突围' : '功法破障'}
      description="万法随心，取舍有道。新法门与旧道基的取舍被压成单一工作流页，避免跳出主游戏壳。"
      aside={
        <>
          <GameSceneAsideSection title="取舍摘要">
            <div className="space-y-2 text-sm leading-7">
              <p>待纳入：{pendingItem.name}</p>
              <p>现有法门：{existingItems.length} 门</p>
              <p>已选舍弃：{selectedOldId ? '1 门' : '尚未选择'}</p>
            </div>
          </GameSceneAsideSection>
          <GameSceneAsideSection title="决断提醒" className="text-sm leading-7">
            <p>确认替换后，旧法会永久消散；放弃则本次灵感归空。</p>
          </GameSceneAsideSection>
        </>
      }
      actionBar={
        <InkActionGroup>
          <InkButton href={isSkill ? '/game/skills' : '/game/techniques'}>
            查看现有法门
          </InkButton>
          <InkButton
            variant="outline"
            onClick={() => {
              openDialog({
                title: '确认放弃',
                content: (
                  <p>
                    道友当真要放弃此次造化之机？
                    <br />
                    一旦放弃，灵感将消散归于虚无。
                  </p>
                ),
                onConfirm: () => handleConfirm(true),
                confirmLabel: '确认放弃',
                cancelLabel: '再想想',
              });
            }}
            disabled={loading}
          >
            放弃领悟
          </InkButton>
          <InkButton
            variant="primary"
            onClick={() => handleConfirm(false)}
            disabled={loading || !selectedOldId}
          >
            {loading ? '演化中...' : '确认替换'}
          </InkButton>
        </InkActionGroup>
      }
    >
      <div className="space-y-6 pb-12">
        <InkNotice>
          请选择需要<b>舍弃的旧法门</b>，以承接新领悟。
          <br />
          一旦确认，被舍弃的法门将从道身消散。
        </InkNotice>

        <InkSection title={`【新领悟】`}>
          <div className="border-wood/35 bg-bgpaper border border-dashed p-3 space-y-2">
            <span className="font-medium text-sm">{pendingItem.name}</span>
            <div className="mt-1 flex flex-wrap gap-1">
              {pendingItem.quality && (
                <InkBadge tier={pendingItem.quality as never}>
                  {pendingItem.quality}
                </InkBadge>
              )}
              {pendingItem.element && (
                <InkBadge tone="default">{pendingItem.element}</InkBadge>
              )}
              <InkBadge tone="default">待纳入道基</InkBadge>
            </div>
            <InkActionGroup align="right">
              <InkButton
                variant="secondary"
                onClick={() => setIsPendingModalOpen(true)}
              >
                查看详情
              </InkButton>
            </InkActionGroup>
          </div>
        </InkSection>

        <InkSection title={`【现有${isSkill ? '神通' : '功法'}】（选择以舍弃）`}>
          {existingItems.length === 0 ? (
            <InkNotice>暂无已有法门</InkNotice>
          ) : (
            <div className="space-y-3">
              {existingItems.map((item) => (
                <V2ProductCard
                  key={item.id}
                  product={item}
                  isSelected={selectedOldId === item.id}
                  onToggle={() =>
                    setSelectedOldId(selectedOldId === item.id ? null : item.id)
                  }
                  actionLabel={['将舍弃', '固守']}
                />
              ))}
            </div>
          )}
        </InkSection>

        <CreationProductResultModal
          isOpen={isPendingModalOpen}
          onClose={() => setIsPendingModalOpen(false)}
          product={pendingItem}
        />
      </div>
    </GameSceneFrame>
  );
}

export default function ReplacePage() {
  return (
    <Suspense fallback={<GameSceneLoading message="感知天机中..." />}>
      <ReplaceContent />
    </Suspense>
  );
}
