import { getCreationProductTypeFromCraftType } from '@shared/engine/creation-v2/config/CreationCraftPolicy';
import {
  PENDING_CREATION_CRAFT_TYPES,
  getPendingCreationConfig,
  getPendingCreationReplaceHref,
  isPendingCreationCraftType,
  resolvePendingCreationRoute,
  type CreationProductResultRecord,
  type PendingCreationCraftType,
  usePendingCreations,
} from '@app/components/feature/creation';
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
import { Suspense, useEffect, useMemo, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router';

type V2Product = ProductDisplayModel & { id: string };
type PendingItem = CreationProductResultRecord;

function ReplaceContent() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const rawCraftType = searchParams.get('type');
  const activeCraftType: PendingCreationCraftType | null =
    isPendingCreationCraftType(rawCraftType) ? rawCraftType : null;
  const {
    cultivator,
    isLoading: cultivatorLoading,
  } = usePlayerStateView();
  const { mutate } = usePlayerStateActions();
  const { pushToast, openDialog } = useInkUI();

  const [loading, setLoading] = useState(false);
  const [initializing, setInitializing] = useState(false);
  const [existingItems, setExistingItems] = useState<V2Product[]>([]);
  const [selectedOldId, setSelectedOldId] = useState<string | null>(null);
  const [detailProduct, setDetailProduct] = useState<ProductDisplayModel | null>(
    null,
  );

  const pendingCreations = usePendingCreations({
    craftTypes: PENDING_CREATION_CRAFT_TYPES,
    enabled: Boolean(cultivator),
  });
  const routeResolution = useMemo(
    () =>
      resolvePendingCreationRoute({
        requestedType: rawCraftType,
        pendingTypes: pendingCreations.pendingTypes,
      }),
    [pendingCreations.pendingTypes, rawCraftType],
  );
  const pendingItem: PendingItem | null = activeCraftType
    ? (pendingCreations.items[activeCraftType] ?? null)
    : null;
  const productType = activeCraftType
    ? getCreationProductTypeFromCraftType(activeCraftType)
    : undefined;
  const abilityLabel = productType
    ? getCreationProductTypeLabel(productType)
    : getCreationProductTypeLabel('gongfa');
  const pendingDisplayModel = pendingItem ? toProductDisplayModel(pendingItem) : null;

  useEffect(() => {
    if (
      cultivatorLoading ||
      !cultivator ||
      pendingCreations.isLoading ||
      routeResolution.mode !== 'single'
    ) {
      return;
    }

    navigate(getPendingCreationReplaceHref(routeResolution.craftType), {
      replace: true,
    });
  }, [
    cultivator,
    cultivatorLoading,
    navigate,
    pendingCreations.isLoading,
    routeResolution,
  ]);

  useEffect(() => {
    if (cultivatorLoading || !cultivator) {
      return;
    }

    if (!activeCraftType || !productType) {
      return;
    }

    let cancelled = false;

    const loadData = async () => {
      setInitializing(true);
      setSelectedOldId(null);

      try {
        const existingRes = await fetch(
          `/api/v2/products?type=${productType}&page=1&pageSize=100`,
        );
        const existingData = await existingRes.json();

        if (cancelled) return;

        if (existingData.success) {
          const items: V2Product[] = (existingData.data?.items ?? []).map(
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
  }, [activeCraftType, cultivator, cultivatorLoading, productType]);

  const handleConfirm = async (isAbandon: boolean) => {
    if (!isAbandon && !selectedOldId) {
      pushToast({ message: '请选择需要舍弃的旧法门', tone: 'warning' });
      return;
    }

    if (!activeCraftType) {
      pushToast({ message: '当前参悟类型无效，无法确认取舍', tone: 'danger' });
      return;
    }

    setLoading(true);
    try {
      const request = fetch('/api/craft/confirm', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            craftType: activeCraftType,
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
          navigate(getPendingCreationConfig(activeCraftType).ownerHref);
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

  if (
    cultivatorLoading ||
    (Boolean(cultivator) && (pendingCreations.isLoading || initializing))
  ) {
    return <GameSceneLoading message="感知天机中..." />;
  }

  if (!cultivator) {
    return (
      <GameSceneFrame variant="lite">
        <InkNotice>当前没有活跃角色，暂无法处理参悟取舍。</InkNotice>
      </GameSceneFrame>
    );
  }

  if (routeResolution.mode === 'invalid_type') {
    return (
      <GameSceneFrame variant="lite">
        <InkNotice>当前参悟类型无效，无法进入取舍流程。</InkNotice>
        <InkActionGroup align="right">
          <InkButton href="/game/enlightenment" variant="secondary">
            返回悟道室
          </InkButton>
        </InkActionGroup>
      </GameSceneFrame>
    );
  }

  if (routeResolution.mode === 'single') {
    return <GameSceneLoading message="转入取舍流程中..." />;
  }

  if (routeResolution.mode === 'multiple') {
    return (
      <GameSceneFrame variant="lite">
        <div className="space-y-4">
          <InkNotice tone="warning">
            当前有多门待纳入道基的新法门，请选择一项处理。
          </InkNotice>
          <InkActionGroup align="right">
            {routeResolution.pendingTypes.map((craftType) => {
              const config = getPendingCreationConfig(craftType);
              return (
                <InkButton
                  key={craftType}
                  href={config.replaceHref}
                  variant="secondary"
                >
                  处理{config.label}
                </InkButton>
              );
            })}
          </InkActionGroup>
        </div>
      </GameSceneFrame>
    );
  }

  if (routeResolution.mode === 'empty' || !activeCraftType || !productType) {
    return (
      <GameSceneFrame variant="lite">
        <div className="space-y-4">
          <InkNotice>当前没有待处理的新法门。</InkNotice>
          <InkActionGroup align="right">
            <InkButton href="/game/enlightenment" variant="secondary">
              返回悟道室
            </InkButton>
          </InkActionGroup>
        </div>
      </GameSceneFrame>
    );
  }

  if (!pendingItem) {
    const config = getPendingCreationConfig(activeCraftType);
    return (
      <GameSceneFrame variant="lite">
        <div className="space-y-4">
          <InkNotice>当前没有待处理的新{config.label}，可能已处理或已过期。</InkNotice>
          <InkActionGroup align="right">
            <InkButton href="/game/enlightenment" variant="secondary">
              返回悟道室
            </InkButton>
            <InkButton href={config.ownerHref} variant="secondary">
              查看{config.ownerLabel}
            </InkButton>
          </InkActionGroup>
        </div>
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
