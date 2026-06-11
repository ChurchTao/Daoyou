import {
  InkBadge,
  InkButton,
  InkNotice,
  inkFieldVariants,
} from '@app/components/ui';
import { usePaginatedInventoryMaterials } from '@app/lib/hooks/usePaginatedInventoryMaterials';
import { cn } from '@shared/lib/cn';
import {
  ELEMENT_VALUES,
  MATERIAL_TYPE_VALUES,
  QUALITY_VALUES,
  type ElementType,
  type MaterialType,
  type Quality,
} from '@shared/types/constants';
import type { Material } from '@shared/types/cultivator';
import { getMaterialTypeInfo } from '@shared/lib/gameConceptDisplay';
import { useEffect, useMemo, useRef, useState } from 'react';

export interface MaterialSelectorProps {
  cultivatorId?: string;
  selectedMaterialIds: string[];
  onToggleMaterial: (id: string, material?: Material) => void;
  selectedMaterialMap?: Record<string, Material>;
  isSubmitting: boolean;
  includeMaterialTypes?: MaterialType[];
  excludeMaterialTypes?: MaterialType[];
  pageSize?: number;
  refreshKey?: number;
  enableFilterSort?: boolean;
  showSelectedMaterialsPanel?: boolean;
  loadingText: string;
  emptyNoticeText: string;
  totalText: (total: number) => string;
}

const compactSelectClassName = cn(inkFieldVariants({ size: 'sm' }), 'mt-1');

function isMysteryMaterial(material: Material): boolean {
  const details = material.details;
  return !!details && typeof details === 'object' && 'mystery' in details;
}

export function MaterialSelector({
  cultivatorId,
  selectedMaterialIds,
  onToggleMaterial,
  selectedMaterialMap,
  isSubmitting,
  includeMaterialTypes,
  excludeMaterialTypes,
  pageSize = 20,
  refreshKey,
  enableFilterSort = true,
  showSelectedMaterialsPanel = false,
  loadingText,
  emptyNoticeText,
  totalText,
}: MaterialSelectorProps) {
  const [rankFilter, setRankFilter] = useState<Quality | 'all'>('all');
  const [typeFilter, setTypeFilter] = useState<MaterialType | 'all'>('all');
  const [elementFilter, setElementFilter] = useState<ElementType | 'all'>(
    'all',
  );
  const [sortBy, setSortBy] = useState<
    'createdAt' | 'rank' | 'type' | 'element' | 'quantity' | 'name'
  >('createdAt');
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('desc');
  const [isFilterOpen, setIsFilterOpen] = useState(false);

  const allowedMaterialTypes = useMemo(() => {
    const includeSource =
      includeMaterialTypes && includeMaterialTypes.length > 0
        ? includeMaterialTypes
        : MATERIAL_TYPE_VALUES;
    const includeSet = new Set(includeSource);
    const excludeSet = new Set(excludeMaterialTypes || []);
    return MATERIAL_TYPE_VALUES.filter(
      (type) => includeSet.has(type) && !excludeSet.has(type),
    );
  }, [excludeMaterialTypes, includeMaterialTypes]);

  const effectiveIncludeTypes = useMemo(() => {
    if (typeFilter === 'all') {
      return includeMaterialTypes;
    }
    if (!allowedMaterialTypes.includes(typeFilter)) {
      return includeMaterialTypes;
    }
    return [typeFilter];
  }, [allowedMaterialTypes, includeMaterialTypes, typeFilter]);

  const {
    materials,
    pagination,
    isLoading,
    isRefreshing,
    isInitialized,
    error,
    refreshPage,
    goPrevPage,
    goNextPage,
  } = usePaginatedInventoryMaterials({
    cultivatorId,
    pageSize,
    includeMaterialTypes: effectiveIncludeTypes,
    excludeMaterialTypes,
    materialRanks: rankFilter === 'all' ? [] : [rankFilter],
    materialElements: elementFilter === 'all' ? [] : [elementFilter],
    materialSortBy: sortBy,
    materialSortOrder: sortOrder,
  });
  const lastRefreshKeyRef = useRef<number | undefined>(refreshKey);

  useEffect(() => {
    if (refreshKey === undefined) return;
    if (!isInitialized) return;
    if (lastRefreshKeyRef.current === refreshKey) return;
    lastRefreshKeyRef.current = refreshKey;
    void refreshPage();
  }, [isInitialized, refreshKey, refreshPage]);

  return (
    <>
      <div className="mb-2 flex items-center justify-between">
        <span className="text-ink-secondary text-xs">
          {isLoading && !isInitialized
            ? loadingText
            : totalText(pagination.total)}
        </span>
        <InkButton
          variant="secondary"
          className="text-sm"
          disabled={isLoading || isRefreshing}
          onClick={() => void refreshPage()}
        >
          {isRefreshing ? '刷新中…' : '手动刷新'}
        </InkButton>
      </div>

      {enableFilterSort && (
        <div className="px-2 py-1 bg-ink/5">
          <div className="flex items-center justify-between">
            <span className="text-ink-secondary text-sm leading-6">
              筛选与排序
            </span>
            <InkButton
              variant="secondary"
              className="text-sm leading-6"
              onClick={() => setIsFilterOpen((prev) => !prev)}
              disabled={isLoading || isRefreshing}
            >
              {isFilterOpen ? '收起筛选' : '展开筛选'}
            </InkButton>
          </div>

          {isFilterOpen && (
            <div className="mt-2 space-y-2">
              <div className="grid grid-cols-2 gap-2 md:grid-cols-4">
                <label className="text-ink-secondary text-xs">
                  品级
                  <select
                    className={compactSelectClassName}
                    value={rankFilter}
                    onChange={(e) =>
                      setRankFilter(e.target.value as Quality | 'all')
                    }
                    disabled={isLoading || isRefreshing}
                  >
                    <option value="all">全部品级</option>
                    {QUALITY_VALUES.map((rank) => (
                      <option key={rank} value={rank}>
                        {rank}
                      </option>
                    ))}
                  </select>
                </label>

                <label className="text-ink-secondary text-xs">
                  种类
                  <select
                    className={compactSelectClassName}
                    value={typeFilter}
                    onChange={(e) =>
                      setTypeFilter(e.target.value as MaterialType | 'all')
                    }
                    disabled={isLoading || isRefreshing}
                  >
                    <option value="all">全部种类</option>
                    {allowedMaterialTypes.map((type) => (
                      <option key={type} value={type}>
                        {getMaterialTypeInfo(type).label}
                      </option>
                    ))}
                  </select>
                </label>

                <label className="text-ink-secondary text-xs">
                  属性
                  <select
                    className={compactSelectClassName}
                    value={elementFilter}
                    onChange={(e) =>
                      setElementFilter(e.target.value as ElementType | 'all')
                    }
                    disabled={isLoading || isRefreshing}
                  >
                    <option value="all">全部属性</option>
                    {ELEMENT_VALUES.map((element) => (
                      <option key={element} value={element}>
                        {element}
                      </option>
                    ))}
                  </select>
                </label>

                <label className="text-ink-secondary text-xs">
                  排序
                  <select
                    className={compactSelectClassName}
                    value={`${sortBy}:${sortOrder}`}
                    onChange={(e) => {
                      const [nextSortBy, nextSortOrder] =
                        e.target.value.split(':');
                      setSortBy(
                        nextSortBy as
                          | 'createdAt'
                          | 'rank'
                          | 'type'
                          | 'element'
                          | 'quantity'
                          | 'name',
                      );
                      setSortOrder(nextSortOrder as 'asc' | 'desc');
                    }}
                    disabled={isLoading || isRefreshing}
                  >
                    <option value="createdAt:desc">最新获得</option>
                    <option value="createdAt:asc">最早获得</option>
                    <option value="rank:desc">品级从高到低</option>
                    <option value="rank:asc">品级从低到高</option>
                    <option value="quantity:desc">数量从多到少</option>
                    <option value="quantity:asc">数量从少到多</option>
                    <option value="name:asc">名称 A-Z</option>
                    <option value="name:desc">名称 Z-A</option>
                  </select>
                </label>
              </div>
            </div>
          )}
        </div>
      )}

      {error ? (
        <InkNotice tone="danger">{error}</InkNotice>
      ) : materials.length === 0 ? (
        <InkNotice>{emptyNoticeText}</InkNotice>
      ) : (
        <div className="space-y-2">
          {showSelectedMaterialsPanel && selectedMaterialIds.length > 0 ? (
            <div className="bg-ink/5 border-ink/10 border p-2">
              <div className="text-sm font-medium">已选材料</div>
              <div className="mt-2 flex flex-wrap gap-2">
                {selectedMaterialIds.map((id) => {
                  const material = selectedMaterialMap?.[id];
                  return (
                    <button
                      key={id}
                      type="button"
                      className="bg-paper border-ink/15 hover:border-crimson flex items-center gap-2 border px-2 py-1 text-xs transition"
                      onClick={() => onToggleMaterial(id, material)}
                      disabled={isSubmitting}
                    >
                      <span>{material?.name ?? '未知材料'}</span>
                      {material?.rank ? (
                        <InkBadge tier={material.rank as Quality} compact>
                          {getMaterialTypeInfo(material.type).label}
                        </InkBadge>
                      ) : null}
                    </button>
                  );
                })}
              </div>
            </div>
          ) : null}

          {materials.map((material, index) => {
            const materialId = material.id;
            const isSelected = materialId
              ? selectedMaterialIds.includes(materialId)
              : false;
            const typeInfo = getMaterialTypeInfo(material.type);
            const isMystery = isMysteryMaterial(material);
            return (
              <button
                key={materialId ?? `${material.name}-${index}`}
                type="button"
                className={cn(
                  'border-ink/10 hover:border-crimson flex w-full items-center justify-between gap-3 border px-3 py-2 text-left transition',
                  isSelected && 'border-crimson bg-crimson/5',
                  isMystery && 'cursor-not-allowed opacity-70 hover:border-ink/10',
                )}
                onClick={() => {
                  if (materialId && !isMystery) {
                    onToggleMaterial(materialId, material);
                  }
                }}
                disabled={isSubmitting || !materialId || isMystery}
              >
                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="font-medium">{`${typeInfo?.icon} ${material.name}`}</span>
                    {isMystery ? (
                      <InkBadge compact>待鉴定</InkBadge>
                    ) : null}
                    {material.rank ? (
                      <InkBadge tier={material.rank as Quality} compact>
                        {typeInfo?.label}
                      </InkBadge>
                    ) : null}
                    {material.element ? (
                      <span className="text-ink-secondary text-xs">
                        {material.element}
                      </span>
                    ) : null}
                  </div>
                  {material.description ? (
                    <div className="text-ink-secondary mt-1 text-xs leading-6">
                      {material.description}
                    </div>
                  ) : null}
                  {isMystery ? (
                    <div className="text-crimson mt-1 text-xs leading-6">
                      待鉴定材料无法投入造物，请先鉴定。
                    </div>
                  ) : null}
                </div>
                <div className="shrink-0 text-right">
                  <div className="font-medium">x{material.quantity}</div>
                  <div className="text-ink-secondary text-xs">
                    {isMystery ? '不可投入' : isSelected ? '已投入' : '可投入'}
                  </div>
                </div>
              </button>
            );
          })}
        </div>
      )}

      <div className="mt-3 flex items-center justify-between">
        <InkButton
          variant="secondary"
          onClick={() => void goPrevPage()}
          disabled={pagination.page <= 1 || isLoading || isRefreshing}
        >
          上一页
        </InkButton>
        <span className="text-ink-secondary text-xs">
          第 {pagination.page} / {Math.max(1, pagination.totalPages)} 页
        </span>
        <InkButton
          variant="secondary"
          onClick={() => void goNextPage()}
          disabled={
            pagination.totalPages <= 1 ||
            pagination.page >= pagination.totalPages ||
            isLoading ||
            isRefreshing
          }
        >
          下一页
        </InkButton>
      </div>
    </>
  );
}
