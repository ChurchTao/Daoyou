import { GameSceneFrame } from '@app/components/game-shell';
import { InkButton } from '@app/components/ui';
import { usePlayerSession } from '@app/lib/resources/player';
import type { LegacyProductType } from '@shared/legacy/products';
import { useEffect, useState } from 'react';
import { AbilityDetailModal } from './AbilityDetailModal';
import { AbilityListCard } from './AbilityListCard';
import {
  toProductDisplayModel,
  type ProductDisplayModel,
  type ProductRecordLike,
} from './abilityDisplay';

export function LegacyProductList({ type }: { type: LegacyProductType }) {
  const owner = usePlayerSession().data?.activeCultivator?.id;
  const [page, setPage] = useState(1);
  const [refresh, setRefresh] = useState(0);
  const key = `${owner}:${type}:${page}:${refresh}`;
  const [loaded, setLoaded] = useState<{
    key: string;
    items: (ProductDisplayModel & { id: string })[];
    hasMore: boolean;
    error?: string;
  }>();
  const [selected, setSelected] = useState<ProductDisplayModel | null>(null);
  const data = loaded?.key === key ? loaded : undefined;
  useEffect(() => {
    const controller = new AbortController();
    if (owner)
      void fetch(`/api/v2/products?type=${type}&page=${page}&pageSize=20`, {
        signal: controller.signal,
      })
        .then(async (response) => {
          const body = await response.json();
          if (!response.ok || !body.success)
            throw new Error(body.error ?? '历史物品读取失败');
          if (!controller.signal.aborted)
            setLoaded({
              key,
              items: body.data.items.map(
                (row: ProductRecordLike & { id: string }) => ({
                  ...toProductDisplayModel(row),
                  id: row.id,
                }),
              ),
              hasMore: body.data.pagination.hasMore,
            });
        })
        .catch((error) => {
          if (!controller.signal.aborted)
            setLoaded({ key, items: [], hasMore: false, error: error.message });
        });
    return () => controller.abort();
  }, [key, owner, type, page]);
  return (
    <GameSceneFrame variant="workflow">
      <div className="space-y-4 text-sm">
        <p className="text-ink-secondary">历史物品已停用，仅保留存档信息。</p>
        {data?.error ? (
          <p role="alert">
            {data.error}{' '}
            <InkButton onClick={() => setRefresh((n) => n + 1)}>重试</InkButton>
          </p>
        ) : !owner || !data ? (
          <p role="status">正在读取历史物品……</p>
        ) : data.items.length ? (
          data.items.map((item) => (
            <AbilityListCard
              key={item.id}
              product={item}
              actions={
                <InkButton onClick={() => setSelected(item)}>详情</InkButton>
              }
            />
          ))
        ) : (
          <p>暂无历史物品。</p>
        )}
        {data && !data.error ? (
          <div className="flex items-center justify-between">
            <InkButton
              disabled={page === 1}
              onClick={() => setPage((n) => n - 1)}
            >
              上一页
            </InkButton>
            <span className="font-mono">{page}</span>
            <InkButton
              disabled={!data.hasMore}
              onClick={() => setPage((n) => n + 1)}
            >
              下一页
            </InkButton>
          </div>
        ) : null}
        <AbilityDetailModal
          product={selected}
          isOpen={!!selected}
          onClose={() => setSelected(null)}
        />
      </div>
    </GameSceneFrame>
  );
}
