'use client';

import {
  InkBadge,
  InkButton,
  InkList,
  InkListItem,
  InkNotice,
} from '@/components/ui';
import type { Material } from '@/types/cultivator';
import { getMaterialTypeInfo } from '@/types/dictionaries';

interface MaterialsTabProps {
  materials: Material[];
  isLoading?: boolean;
  onShowDetails: (item: Material) => void;
  onDiscard: (item: Material) => void;
}

/**
 * 材料 Tab 组件
 */
export function MaterialsTab({
  materials,
  isLoading = false,
  onShowDetails,
  onDiscard,
}: MaterialsTabProps) {
  if (isLoading) {
    return <InkNotice>正在检索材料记录，请稍候……</InkNotice>;
  }

  if (!materials || materials.length === 0) {
    return <InkNotice>暂无修炼材料。</InkNotice>;
  }

  return (
    <InkList>
      {materials.map((item, idx) => {
        const typeInfo = getMaterialTypeInfo(item.type);
        return (
          <InkListItem
            key={item.id || idx}
            layout="col"
            title={
              <>
                {typeInfo.icon} {item.name}
                <InkBadge tier={item.rank} className="ml-2">
                  {typeInfo.label}
                </InkBadge>
                <span className="text-ink-secondary ml-2 text-sm">
                  x{item.quantity}
                </span>
              </>
            }
            meta={`属性：${item.element}`}
            description={item.description || '平平无奇的材料'}
            actions={
              <div className="flex gap-2">
                <InkButton
                  variant="secondary"
                  onClick={() => onShowDetails(item)}
                >
                  详情
                </InkButton>
                <InkButton variant="primary" onClick={() => onDiscard(item)}>
                  丢弃
                </InkButton>
              </div>
            }
          />
        );
      })}
    </InkList>
  );
}
