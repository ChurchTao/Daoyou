'use client';

import { InkBadge, InkButton, InkNotice } from '@/components/ui';
import { usePaginatedInventoryMaterials } from '@/lib/hooks/usePaginatedInventoryMaterials';
import type { MaterialType } from '@/types/constants';
import { getMaterialTypeInfo } from '@/types/dictionaries';
import { useEffect, useRef } from 'react';

interface MaterialSelectorProps {
  cultivatorId?: string;
  selectedMaterialIds: string[];
  onToggleMaterial: (id: string) => void;
  isSubmitting: boolean;
  includeMaterialTypes?: MaterialType[];
  excludeMaterialTypes?: MaterialType[];
  pageSize?: number;
  refreshKey?: number;
  loadingText: string;
  emptyNoticeText: string;
  totalText: (total: number) => string;
}

export function MaterialSelector({
  cultivatorId,
  selectedMaterialIds,
  onToggleMaterial,
  isSubmitting,
  includeMaterialTypes,
  excludeMaterialTypes,
  pageSize = 20,
  refreshKey,
  loadingText,
  emptyNoticeText,
  totalText,
}: MaterialSelectorProps) {
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
    includeMaterialTypes,
    excludeMaterialTypes,
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
                    onToggleMaterial(material.id)
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
    </>
  );
}
