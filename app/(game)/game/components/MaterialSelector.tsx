'use client';

import { InkBadge, InkButton, InkNotice } from '@/components/ui';
import { usePaginatedInventoryMaterials } from '@/lib/hooks/usePaginatedInventoryMaterials';
import {
  ELEMENT_VALUES,
  MATERIAL_TYPE_VALUES,
  QUALITY_VALUES,
  type ElementType,
  type MaterialType,
  type Quality,
} from '@/types/constants';
import type { Material } from '@/types/cultivator';
import { getMaterialTypeInfo } from '@/types/dictionaries';
import { useEffect, useMemo, useRef, useState } from 'react';

interface MaterialSelectorProps {
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
  const [elementFilter, setElementFilter] = useState<ElementType | 'all'>('all');
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
        <div className="bg-ink/5 border-ink/10 mb-2 border p-2">
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
                    className="border-ink/20 mt-1 w-full border bg-transparent px-2 py-1 text-sm"
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
                    className="border-ink/20 mt-1 w-full border bg-transparent px-2 py-1 text-sm"
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
                    className="border-ink/20 mt-1 w-full border bg-transparent px-2 py-1 text-sm"
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
                    className="border-ink/20 mt-1 w-full border bg-transparent px-2 py-1 text-sm"
                    value={`${sortBy}:${sortOrder}`}
                    onChange={(e) => {
                      const [nextSortBy, nextSortOrder] = e.target.value.split(':');
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
              <div className="flex justify-end">
                <InkButton
                  variant="secondary"
                  onClick={() => {
                    setRankFilter('all');
                    setTypeFilter('all');
                    setElementFilter('all');
                    setSortBy('createdAt');
                    setSortOrder('desc');
                  }}
                  disabled={isLoading || isRefreshing}
                >
                  重置筛选
                </InkButton>
              </div>
            </div>
          )}
        </div>
      )}

      {isLoading && !isInitialized ? (
        <div className="bg-ink/5 border-ink/10 max-h-60 overflow-y-auto rounded-lg border p-2">
          <div className="space-y-2">
            {[1, 2, 3].map((idx) => (
              <div
                key={idx}
                className="border-ink/10 bg-paper/55 animate-pulse rounded-md border p-3"
              >
                <div className="mb-2 h-5 w-1/2 rounded bg-black/10" />
                <div className="h-4 w-5/6 rounded bg-black/10" />
              </div>
            ))}
          </div>
        </div>
      ) : error ? (
        <InkNotice>材料加载失败：{error}</InkNotice>
      ) : materials.length > 0 ? (
        <div className="bg-ink/5 border-ink/10 max-h-60 overflow-y-auto rounded-lg border p-2">
          <div className="space-y-2">
            {materials.map((material) => {
              const typeInfo = getMaterialTypeInfo(material.type);
              const isSelected = selectedMaterialIds.includes(material.id!);

              return (
                <div
                  key={material.id}
                  onClick={() =>
                    !isSubmitting &&
                    material.id &&
                    onToggleMaterial(material.id, material)
                  }
                  className={`cursor-pointer rounded-lg border p-3 transition-colors ${
                    isSelected
                      ? 'border-ink/35 bg-ink/12'
                      : 'border-ink/10 bg-paper/55 hover:bg-paper/70 hover:border-ink/20'
                  }`}
                >
                  <div className="flex items-start gap-3">
                    <input
                      type="checkbox"
                      checked={isSelected}
                      readOnly
                      className="accent-ink-primary mt-1"
                    />

                    <div className="min-w-0 flex-1">
                      <div className="mb-1 flex flex-wrap items-center gap-x-2 gap-y-1">
                        <span className="text-ink leading-tight font-bold wrap-break-word">
                          {typeInfo.icon} {material.name}
                        </span>
                        <InkBadge tier={material.rank}>
                          {`${typeInfo.label} · ${material.element}`}
                        </InkBadge>
                      </div>
                      <p className="text-ink-secondary text-xs leading-relaxed wrap-break-word">
                        持有数量：{material.quantity}
                      </p>
                      <p className="text-ink-secondary text-xs leading-relaxed wrap-break-word">
                        {material.description || '无描述'}
                      </p>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      ) : (
        <InkNotice>{emptyNoticeText}</InkNotice>
      )}

      {pagination.totalPages > 1 && (
        <div className="mt-2 flex items-center justify-center gap-3">
          <InkButton
            disabled={isLoading || isRefreshing || pagination.page <= 1}
            onClick={() => void goPrevPage()}
          >
            上一页
          </InkButton>
          <span className="text-ink-secondary text-xs">
            {pagination.page} / {pagination.totalPages}
          </span>
          <InkButton
            disabled={
              isLoading ||
              isRefreshing ||
              pagination.page >= pagination.totalPages
            }
            onClick={() => void goNextPage()}
          >
            下一页
          </InkButton>
        </div>
      )}

      {showSelectedMaterialsPanel && (
        <div className="bg-ink/5 border-ink/10 mt-3 rounded-lg border p-2">
          <div className="mb-2 flex items-center justify-between">
            <span className="text-sm font-semibold">已选材料</span>
            <span className="text-ink-secondary text-xs">
              {selectedMaterialIds.length} 种
            </span>
          </div>
          {selectedMaterialIds.length === 0 ? (
            <p className="text-ink-secondary text-xs">
              尚未投入材料，选中后会在此处固定显示。
            </p>
          ) : (
            <div className="space-y-2">
              {selectedMaterialIds.map((id) => {
                const material =
                  selectedMaterialMap?.[id] ||
                  materials.find((candidate) => candidate.id === id);
                if (!material) {
                  return (
                    <div
                      key={id}
                      className="border-ink/10 bg-paper/55 flex items-center justify-between rounded-md border p-2"
                    >
                      <span className="text-ink-secondary text-xs">
                        材料信息加载中…
                      </span>
                      <InkButton
                        variant="secondary"
                        onClick={() => onToggleMaterial(id)}
                        disabled={isSubmitting}
                      >
                        取消
                      </InkButton>
                    </div>
                  );
                }
                const typeInfo = getMaterialTypeInfo(material.type);
                return (
                  <div
                    key={id}
                    className="border-ink/10 bg-paper/55 rounded-md border p-2"
                  >
                    <div className="flex items-center justify-between gap-2">
                      <div className="min-w-0">
                        <p className="text-sm font-semibold">
                          {typeInfo.icon} {material.name}
                        </p>
                        <p className="text-ink-secondary text-xs">
                          {typeInfo.label} · {material.rank} ·{' '}
                          {material.element || '无属性'} · 数量 {material.quantity}
                        </p>
                      </div>
                      <InkButton
                        variant="secondary"
                        onClick={() => onToggleMaterial(id)}
                        disabled={isSubmitting}
                      >
                        取消
                      </InkButton>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}
    </>
  );
}
