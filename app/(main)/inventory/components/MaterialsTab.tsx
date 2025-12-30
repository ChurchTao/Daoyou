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
  onShowDetails: (item: Material) => void;
  onDiscard: (item: Material) => void;
}

/**
 * 材料 Tab 组件
 */
export function MaterialsTab({
  materials,
  onShowDetails,
  onDiscard,
}: MaterialsTabProps) {
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
                <span className="ml-2 text-sm text-ink-secondary">
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
