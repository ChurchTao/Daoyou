'use client';

import {
  InkBadge,
  InkButton,
  InkList,
  InkListItem,
  InkNotice,
} from '@/components/ui';
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
import { useState } from 'react';
import type { MaterialFilters } from '../hooks/useInventoryViewModel';

interface MaterialsTabProps {
  materials: Material[];
  filters: MaterialFilters;
  isLoading?: boolean;
  onRankFilterChange: (rank: Quality | 'all') => void;
  onTypeFilterChange: (type: MaterialType | 'all') => void;
  onElementFilterChange: (element: ElementType | 'all') => void;
  onSortChange: (
    sortBy: MaterialFilters['sortBy'],
    sortOrder: MaterialFilters['sortOrder'],
  ) => void;
  onResetFilters: () => void;
  onShowDetails: (item: Material) => void;
  pendingId?: string | null;
  onIdentify: (item: Material) => void;
  onDiscard: (item: Material) => void;
}

/**
 * 材料 Tab 组件
 */
export function MaterialsTab({
  materials,
  filters,
  isLoading = false,
  onRankFilterChange,
  onTypeFilterChange,
  onElementFilterChange,
  onSortChange,
  onResetFilters,
  onShowDetails,
  pendingId,
  onIdentify,
  onDiscard,
}: MaterialsTabProps) {
  const [isFilterOpen, setIsFilterOpen] = useState(false);

  return (
    <div className="space-y-3">
      <div className="bg-ink/5 border-ink/10 border p-2">
        <div className="flex items-center justify-between">
          <span className="text-ink-secondary text-sm leading-6">
            筛选与排序
          </span>
          <InkButton
            variant="secondary"
            className="text-sm leading-6"
            onClick={() => setIsFilterOpen((prev) => !prev)}
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
                  value={filters.rank}
                  onChange={(event) =>
                    onRankFilterChange(event.target.value as Quality | 'all')
                  }
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
                  value={filters.type}
                  onChange={(event) =>
                    onTypeFilterChange(
                      event.target.value as MaterialType | 'all',
                    )
                  }
                >
                  <option value="all">全部种类</option>
                  {MATERIAL_TYPE_VALUES.map((type) => (
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
                  value={filters.element}
                  onChange={(event) =>
                    onElementFilterChange(
                      event.target.value as ElementType | 'all',
                    )
                  }
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
                  value={`${filters.sortBy}:${filters.sortOrder}`}
                  onChange={(event) => {
                    const [sortBy, sortOrder] = event.target.value.split(':');
                    onSortChange(
                      sortBy as MaterialFilters['sortBy'],
                      sortOrder as MaterialFilters['sortOrder'],
                    );
                  }}
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
              <InkButton variant="secondary" onClick={onResetFilters}>
                重置筛选
              </InkButton>
            </div>
          </div>
        )}
      </div>

      {isLoading ? (
        <InkNotice>正在检索材料记录，请稍候……</InkNotice>
      ) : !materials || materials.length === 0 ? (
        <InkNotice>暂无符合筛选条件的修炼材料。</InkNotice>
      ) : (
        <InkList>
          {materials.map((item, idx) => {
            const typeInfo = getMaterialTypeInfo(item.type);
            const isMystery = Boolean(
              item.details &&
              typeof item.details === 'object' &&
              'mystery' in item.details,
            );
            return (
              <InkListItem
                key={item.id || idx}
                layout="col"
                title={
                  <>
                    <span className="inline-flex items-center">
                      {isMystery && (
                        <span className="text-tier-di border-tier-di bg-tier-di/5 mr-1 inline-flex h-4 w-4 items-center justify-center rounded-xs border px-px text-xs">
                          疑
                        </span>
                      )}
                      {typeInfo.icon} {item.name}
                    </span>
                    <InkBadge tier={item.rank} className="ml-2">
                      {typeInfo.label}
                    </InkBadge>
                    {isMystery && (
                      <InkBadge tone="warning" className="ml-2">
                        待鉴定
                      </InkBadge>
                    )}
                    <span className="text-ink-secondary ml-2 text-sm">
                      x{item.quantity}
                    </span>
                  </>
                }
                meta={`属性：${item.element || '无属性'}`}
                description={item.description || '平平无奇的材料'}
                actions={
                  <div className="flex gap-2">
                    <InkButton
                      variant="secondary"
                      onClick={() => onShowDetails(item)}
                    >
                      详情
                    </InkButton>
                    {isMystery && (
                      <InkButton
                        variant="primary"
                        disabled={pendingId === item.id}
                        onClick={() => onIdentify(item)}
                      >
                        {pendingId === item.id ? '鉴定中…' : '鉴定'}
                      </InkButton>
                    )}
                    <InkButton
                      variant="secondary"
                      onClick={() => onDiscard(item)}
                    >
                      丢弃
                    </InkButton>
                  </div>
                }
              />
            );
          })}
        </InkList>
      )}
      <div className="bg-ink/5 border-ink/10 flex items-center justify-between border p-2">
        <span className="text-ink-secondary text-sm">
          材料收购功能已迁至坊市鉴宝司，需由鉴定师主持交易。
        </span>
        <InkButton href="/game/market/recycle" variant="primary">
          前往鉴宝司
        </InkButton>
      </div>
    </div>
  );
}
