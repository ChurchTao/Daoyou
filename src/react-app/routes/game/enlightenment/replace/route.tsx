import { getCreationProductTypeFromCraftType } from '@shared/engine/creation-v2/config/CreationCraftPolicy';
import type { CreationProductResultRecord } from '@app/components/feature/creation';
import {
  AbilityDetailModal,
  AbilityListCard,
  toProductDisplayModel,
  type ProductDisplayModel,
} from '@app/components/feature/products';
import {
  GameSceneAsideSection,
  GameSceneFrame,
  GameSceneLoading,
  GameSceneSection,
} from '@app/components/game-shell';
import {
  InkActionGroup,
  InkButton,
  InkNotice,
} from '@app/components/ui';
import { useInkUI } from '@app/components/providers/InkUIProvider';
import { usePlayerStateView } from '@app/lib/player-state/selectors';
import { getCreationProductTypeLabel } from '@shared/lib/gameConceptDisplay';
import { usePlayerStateActions } from '@app/lib/player-state/store';
import { Suspense, useEffect, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router';

type V2Product = ProductDisplayModel & { id: string };
type PendingItem = CreationProductResultRecord;

function ReplaceContent() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const craftType = searchParams.get('type');
  const {
    cultivator,
    isLoading: cultivatorLoading,
  } = usePlayerStateView();
  const { mutate } = usePlayerStateActions();
  const { pushToast, openDialog } = useInkUI();

  const [loading, setLoading] = useState(false);
  const [initializing, setInitializing] = useState(true);
  const [pendingItem, setPendingItem] = useState<PendingItem | null>(null);
  const [existingItems, setExistingItems] = useState<V2Product[]>([]);
  const [selectedOldId, setSelectedOldId] = useState<string | null>(null);
  const [detailProduct, setDetailProduct] = useState<ProductDisplayModel | null>(
    null,
  );

  const productType = craftType
    ? getCreationProductTypeFromCraftType(craftType)
    : undefined;
  const isSkill = productType === 'skill';
  const abilityLabel = productType
    ? getCreationProductTypeLabel(productType)
    : getCreationProductTypeLabel('gongfa');
  const pendingDisplayModel = pendingItem ? toProductDisplayModel(pendingItem) : null;

  useEffect(() => {
    if (cultivatorLoading || !cultivator || !craftType || !productType) {
      return;
    }

    let cancelled = false;

    const loadData = async () => {
      setInitializing(true);
      setSelectedOldId(null);

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
          setPendingItem(null);
        }

        if (existingData.success) {
          const items: V2Product[] = (existingData.data ?? []).map(
            (item: Record<string, unknown>) => ({
              id: item.id as string,
              ...toProductDisplayModel(item),
            }),
          );
          setExistingItems(items);
        } else {
          setExistingItems([]);
        }
      } catch (e) {
        if (!cancelled) {
          console.error('获取数据失败:', e);
          setPendingItem(null);
          setExistingItems([]);
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
  }, [craftType, cultivator, cultivatorLoading, productType]);

  const handleConfirm = async (isAbandon: boolean) => {
    if (!isAbandon && !selectedOldId) {
      pushToast({ message: '请选择需要舍弃的旧法门', tone: 'warning' });
      return;
    }

    setLoading(true);
    try {
      const request = fetch('/api/craft/confirm', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            craftType,
            replaceId: isAbandon ? null : selectedOldId,
            abandon: isAbandon,
          }),
        });
      const data = isAbandon
        ? await (async () => {
            const res = await request;
            const payload = await res.json();
            if (!res.ok) throw new Error(payload.error || '确认失败');
            return payload as { message?: string };
          })()
        : await mutate<{ message: string; item: CreationProductResultRecord }>(
            request,
          );

      openDialog({
        title: isAbandon ? '尘缘尽散' : '领悟成功',
        content: <p>{data.message}</p>,
        onConfirm: () => {
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

  if (cultivatorLoading || initializing) {
    return <GameSceneLoading message="感知天机中..." />;
  }

  if (!cultivator) {
    return (
      <GameSceneFrame variant="lite">
        <InkNotice>当前没有活跃角色，暂无法处理参悟取舍。</InkNotice>
      </GameSceneFrame>
    );
  }

  if (!craftType || !productType) {
    return (
      <GameSceneFrame variant="lite">
        <InkNotice>当前参悟类型无效，无法进入取舍流程。</InkNotice>
      </GameSceneFrame>
    );
  }

  if (!pendingItem) {
    return (
      <GameSceneFrame variant="lite">
        <InkNotice>当前没有待处理的新法门。</InkNotice>
      </GameSceneFrame>
    );
  }

  return (
    <GameSceneFrame
      variant="workflow"
      aside={
        <>
          <GameSceneAsideSection title="取舍摘要">
            <div className="space-y-2 text-sm leading-7">
              <p>待纳入：{pendingItem.name}</p>
              <p>现有法门：{existingItems.length} 门</p>
              <p>已选舍弃：{selectedOldId ? '1 门' : '尚未选择'}</p>
            </div>
          </GameSceneAsideSection>
          <GameSceneAsideSection
            title="决断提醒"
            className="text-sm leading-7"
            help={{
              title: '法门取舍决断提醒',
              content: (
                <div className="space-y-2 text-sm leading-7">
                  <p>确认替换后，旧法会永久消散；放弃则本次灵感归空。</p>
                </div>
              ),
            }}
          />
        </>
      }
    >
      <div className="space-y-6 pb-12">
        <GameSceneSection title="待纳入新法">
          {pendingDisplayModel ? (
            <AbilityListCard
              product={pendingDisplayModel}
              variant="pending"
              actions={
                <div className="flex gap-2">
                  <InkButton
                    variant="secondary"
                    onClick={() => setDetailProduct(pendingDisplayModel)}
                  >
                    详情
                  </InkButton>
                </div>
              }
            />
          ) : (
            <InkNotice>当前新法门详情暂不可见。</InkNotice>
          )}
        </GameSceneSection>

        <GameSceneSection title={`选择舍弃的现有${abilityLabel}`}>
          {existingItems.length === 0 ? (
            <InkNotice>暂无已有法门</InkNotice>
          ) : (
            <div className="space-y-3">
              {existingItems.map((item) => (
                <AbilityListCard
                  key={item.id}
                  product={item}
                  selected={selectedOldId === item.id}
                  onSelect={() =>
                    setSelectedOldId(selectedOldId === item.id ? null : item.id)
                  }
                  actions={
                    <div className="flex flex-wrap items-center gap-2">
                      <InkButton
                        variant="secondary"
                        onClick={() => setDetailProduct(item)}
                      >
                        详情
                      </InkButton>
                    </div>
                  }
                />
              ))}
            </div>
          )}
        </GameSceneSection>

        <InkActionGroup align="center">
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

        <AbilityDetailModal
          isOpen={detailProduct !== null}
          onClose={() => setDetailProduct(null)}
          product={detailProduct}
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
