'use client';

import { cn } from '@/lib/cn';
import { cva, type VariantProps } from 'class-variance-authority';
import { memo } from 'react';

/**
 * MapNode 变体定义
 */
const mapNodeVariants = cva(
  'absolute transform -translate-x-1/2 -translate-y-1/2 transition-all duration-300 cursor-pointer',
  {
    variants: {
      selected: {
        true: 'z-30 scale-125',
        false: 'z-20 hover:scale-110',
      },
    },
    defaultVariants: {
      selected: false,
    },
  },
);

const markerVariants = cva('w-4 h-4 rounded-full border-2 shadow-lg', {
  variants: {
    selected: {
      true: 'bg-crimson border-paper ring-4 ring-crimson/20',
      false: 'border-ink hover:bg-crimson/50 bg-background',
    },
  },
  defaultVariants: {
    selected: false,
  },
});

const labelVariants = cva(
  'absolute top-6 left-1/2 -translate-x-1/2 whitespace-nowrap text-xs font-bold px-2 py-0.5 rounded',
  {
    variants: {
      selected: {
        true: 'bg-crimson text-paper',
        false: 'text-ink shadow-sm border border-ink/10 bg-background',
      },
    },
    defaultVariants: {
      selected: false,
    },
  },
);

export interface MapNodeProps extends VariantProps<typeof mapNodeVariants> {
  id: string;
  name: string;
  realmRequirement: string;
  x: number;
  y: number;
  marketEnabled?: boolean;
  onClick?: (id: string) => void;
}

/**
 * 地图主节点组件
 */
function MapNodeComponent({
  id,
  name,
  realmRequirement,
  x,
  y,
  marketEnabled = false,
  selected = false,
  onClick,
}: MapNodeProps) {
  const handleClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    onClick?.(id);
  };

  // 提取显示名称（取·后的部分）
  const displayName = name.split('·').pop() || name;

  return (
    <div
      id={`node-${id}`}
      className={cn(mapNodeVariants({ selected }))}
      style={{ left: `${x}%`, top: `${y}%` }}
      onClick={handleClick}
    >
      {/* Marker Icon */}
      <div
        className={cn(
          markerVariants({ selected }),
          marketEnabled && 'ring-2 ring-emerald-500/35',
        )}
      />
      {marketEnabled && (
        <div className="bg-emerald-600 text-paper absolute -top-2 -right-2 rounded px-1 text-[9px] leading-4 shadow">
          市
        </div>
      )}
      {/* Label */}
      <div className={cn(labelVariants({ selected }))}>
        {displayName} · {realmRequirement}
      </div>
    </div>
  );
}

// 使用 React.memo 优化，仅在 props 变化时重新渲染
export const MapNode = memo(MapNodeComponent);
