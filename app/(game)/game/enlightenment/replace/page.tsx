'use client';

import { getCreationProductTypeFromCraftType } from '@/engine/creation-v2/config/CreationCraftPolicy';
import { InkPageShell, InkSection } from '@/components/layout';
import { useInkUI } from '@/components/providers/InkUIProvider';
import { InkActionGroup, InkBadge, InkButton, InkNotice } from '@/components/ui';
import { useCultivator } from '@/lib/contexts/CultivatorContext';
import { useRouter, useSearchParams } from 'next/navigation';
import { Suspense, useCallback, useEffect, useState } from 'react';

type AffixSummary = {
  id: string;
  name: string;
  category: string;
  isPerfect: boolean;
  rollEfficiency: number;
};

type V2Product = {
  id: string;
  productType: string;
  name: string;
  quality: string | null;
  element: string | null;
  score: number;
  affixes: AffixSummary[];
};

type PendingItem = {
  productType: string;
  previewName: string;
  previewQuality: string | null;
  previewElement: string | null;
};

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
      className={`border rounded-lg p-3 space-y-2 transition-colors cursor-pointer ${isSelected ? 'border-ink/50 bg-ink/5' : 'border-ink/10'}`}
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
              {a.isPerfect && <span className="text-amber-500">（完美）</span>}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

function ReplaceContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const craftType = searchParams.get('type');
  const { cultivator, refreshCultivator } = useCultivator();
  const { pushToast, openDialog } = useInkUI();

  const [loading, setLoading] = useState(false);
  const [initializing, setInitializing] = useState(true);
  const [pendingItem, setPendingItem] = useState<PendingItem | null>(null);
  const [existingItems, setExistingItems] = useState<V2Product[]>([]);
  const [selectedOldId, setSelectedOldId] = useState<string | null>(null);
  const [acceptNew, setAcceptNew] = useState(true);

  const productType = craftType
    ? getCreationProductTypeFromCraftType(craftType)
    : undefined;
  const isSkill = productType === 'skill';

  const fetchData = useCallback(async () => {
    if (!craftType || !productType) return;
    try {
      const [pendingRes, existingRes] = await Promise.all([
        fetch(`/api/craft/pending?type=${craftType}`),
        fetch(`/api/v2/products?type=${productType}`),
      ]);
      const [pendingData, existingData] = await Promise.all([
        pendingRes.json(),
        existingRes.json(),
      ]);

      if (pendingData.success && pendingData.hasPending) {
        setPendingItem(pendingData.item);
      } else {
        router.back();
        return;
      }

      if (existingData.success) {
        setExistingItems(existingData.data ?? []);
      }
    } catch (e) {
      console.error('获取数据失败:', e);
    } finally {
      setInitializing(false);
    }
  }, [craftType, productType, router]);

  useEffect(() => {
    if (cultivator) {
      fetchData();
    }
  }, [cultivator, fetchData]);

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
          router.push(isSkill ? '/game/skills' : '/game/techniques');
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
  if (!pendingItem) return <InkNotice>无可领悟之法</InkNotice>;

  return (
    <InkPageShell
      title={isSkill ? '神通突围' : '功法破障'}
      subtitle="万法随心，取舍有道"
      backHref="/game/enlightenment"
    >
      <div className="space-y-6 pb-12">
        <InkNotice>
          请选择需要<b>舍弃的旧法门</b>，以承接新领悟。
          <br />
          一旦确认，被舍弃的法门将从道身消散。
        </InkNotice>

        <InkSection title={`【新领悟】`}>
          <div className="border border-amber-400/50 bg-amber-50/30 rounded-lg p-3 space-y-2">
            <span className="font-medium text-sm">{pendingItem.previewName}</span>
            <div className="flex flex-wrap gap-1 mt-1">
              {pendingItem.previewQuality && (
                <InkBadge tier={pendingItem.previewQuality as never}>
                  {pendingItem.previewQuality}
                </InkBadge>
              )}
              {pendingItem.previewElement && (
                <InkBadge tone="default">{pendingItem.previewElement}</InkBadge>
              )}
              <InkBadge tone="default">待纳入道基</InkBadge>
            </div>
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

        <InkActionGroup>
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
      </div>
    </InkPageShell>
  );
}

export default function ReplacePage() {
  return (
    <Suspense fallback={<InkNotice>感知天机中...</InkNotice>}>
      <ReplaceContent />
    </Suspense>
  );
}
