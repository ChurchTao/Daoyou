import { GameLoadingState } from '@app/components/game-shell';
import {
  InkBadge,
  InkButton,
  InkNotice,
  inkFieldVariants,
} from '@app/components/ui';
import { useMaterialInventoryResource } from '@app/lib/resources/inventory';
import { getMaterialTypeInfo } from '@shared/lib/gameConceptDisplay';
import {
  MATERIAL_TYPE_VALUES,
  QUALITY_VALUES,
  type MaterialType,
  type Quality,
} from '@shared/types/constants';
import type { Material } from '@shared/types/cultivator';
import { useDeferredValue, useMemo, useState } from 'react';

function isMystery(material: Material): boolean {
  return Boolean(
    material.details &&
    typeof material.details === 'object' &&
    'mystery' in material.details,
  );
}

export function AlchemyMaterialShelf({
  cultivatorId,
  onCarry,
}: {
  cultivatorId?: string;
  onCarry(material: Material): void;
}) {
  const [type, setType] = useState<MaterialType | 'all'>('all');
  const [rank, setRank] = useState<Quality | 'all'>('all');
  const [search, setSearch] = useState('');
  const [detail, setDetail] = useState<Material | null>(null);
  const deferredSearch = useDeferredValue(search.trim().toLocaleLowerCase());
  const inventory = useMaterialInventoryResource({
    pageSize: 16,
    enabled: Boolean(cultivatorId),
    materialTypes:
      type === 'all' ? ['herb', 'ore', 'monster', 'tcdb', 'aux'] : [type],
    materialRanks: rank === 'all' ? [] : [rank],
    materialSortBy: 'quantity',
    materialSortOrder: 'desc',
  });
  const materials = useMemo(
    () =>
      (inventory.items ?? []).filter((material) =>
        deferredSearch
          ? `${material.name} ${material.description ?? ''}`
              .toLocaleLowerCase()
              .includes(deferredSearch)
          : true,
      ),
    [deferredSearch, inventory.items],
  );
  return (
    <div className="space-y-5">
      <div className="grid gap-3 sm:grid-cols-[minmax(0,1fr)_10rem_10rem_auto]">
        <input
          className={inkFieldVariants()}
          value={search}
          placeholder="搜索当前页药材"
          onChange={(event) => setSearch(event.target.value)}
        />
        <select
          className={inkFieldVariants()}
          value={type}
          onChange={(event) =>
            setType(event.target.value as MaterialType | 'all')
          }
        >
          <option value="all">全部种类</option>
          {MATERIAL_TYPE_VALUES.filter((value) =>
            ['herb', 'ore', 'monster', 'tcdb', 'aux'].includes(value),
          ).map((value) => (
            <option key={value} value={value}>
              {getMaterialTypeInfo(value).label}
            </option>
          ))}
        </select>
        <select
          className={inkFieldVariants()}
          value={rank}
          onChange={(event) => setRank(event.target.value as Quality | 'all')}
        >
          <option value="all">全部品质</option>
          {QUALITY_VALUES.map((value) => (
            <option key={value} value={value}>
              {value}
            </option>
          ))}
        </select>
        <InkButton
          variant="secondary"
          pending={inventory.isRefreshing}
          onClick={() => void inventory.reload()}
        >
          刷新药柜
        </InkButton>
      </div>

      {inventory.loading && !inventory.data ? (
        <GameLoadingState variant="inline" message="药柜木签正在逐一亮起……" />
      ) : null}
      {inventory.error ? (
        <InkNotice tone="warning">{inventory.error}</InkNotice>
      ) : null}

      {detail ? (
        <section className="border-ink/15 bg-ink/[0.025] border p-5">
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div>
              <div className="flex flex-wrap items-center gap-2">
                <h3 className="text-lg">{detail.name}</h3>
                <InkBadge tier={detail.rank}>{detail.rank}</InkBadge>
              </div>
              <p className="text-ink-secondary mt-2 text-sm">
                {getMaterialTypeInfo(detail.type).label} ·{' '}
                {detail.element ?? '无属'} · 库存 {detail.quantity}
              </p>
              <p className="text-ink-secondary mt-3 max-w-2xl text-sm leading-7">
                {detail.description || '药性尚未留下更多记述。'}
              </p>
            </div>
            <div className="flex gap-2">
              <InkButton variant="secondary" onClick={() => setDetail(null)}>
                收起详情
              </InkButton>
              <InkButton
                variant="primary"
                disabled={isMystery(detail) || !detail.id}
                onClick={() => onCarry(detail)}
              >
                添加到丹炉
              </InkButton>
            </div>
          </div>
        </section>
      ) : null}

      {materials.length ? (
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {materials.map((material) => {
            const mystery = isMystery(material);
            const info = getMaterialTypeInfo(material.type);
            return (
              <article
                key={material.id ?? material.name}
                className="border-ink/15 flex min-h-40 flex-col border p-4"
              >
                <button
                  type="button"
                  className="flex flex-1 gap-3 text-left"
                  onClick={() => setDetail(material)}
                >
                  <span className="border-ink/10 grid size-10 shrink-0 place-items-center border text-xl">
                    {info.icon}
                  </span>
                  <span className="min-w-0">
                    <span className="flex flex-wrap items-center gap-2">
                      <strong className="font-medium">{material.name}</strong>
                      <InkBadge tier={material.rank} compact>
                        {material.rank}
                      </InkBadge>
                    </span>
                    <span className="text-ink-secondary mt-2 line-clamp-2 block text-xs leading-5">
                      {mystery
                        ? '封签晦暗，需先鉴定方可入药。'
                        : material.description ||
                          `${material.element ?? '无属'}药性。`}
                    </span>
                  </span>
                </button>
                <div className="border-ink/10 mt-4 flex items-center justify-between border-t pt-3">
                  <span className="text-sm">库存 ×{material.quantity}</span>
                  <InkButton
                    variant="secondary"
                    disabled={mystery || !material.id}
                    onClick={() => onCarry(material)}
                  >
                    添加到丹炉
                  </InkButton>
                </div>
              </article>
            );
          })}
        </div>
      ) : !inventory.loading ? (
        <InkNotice tone="info">当前药屉中没有符合条件的灵材。</InkNotice>
      ) : null}

      <div className="flex items-center justify-between">
        <InkButton
          variant="secondary"
          disabled={
            !inventory.pagination ||
            inventory.pagination.page <= 1 ||
            inventory.loading
          }
          onClick={() => void inventory.goPrevPage()}
        >
          上一页
        </InkButton>
        <span className="text-ink-secondary text-xs">
          第 {inventory.pagination?.page ?? 1} /{' '}
          {Math.max(1, inventory.pagination?.totalPages ?? 1)} 页
        </span>
        <InkButton
          variant="secondary"
          disabled={!inventory.pagination?.hasMore || inventory.loading}
          onClick={() => void inventory.goNextPage()}
        >
          下一页
        </InkButton>
      </div>
    </div>
  );
}
