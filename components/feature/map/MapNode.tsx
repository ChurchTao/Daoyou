'use client';

import { memo } from 'react';
import { cn } from '@/lib/cn';
import { cva, type VariantProps } from 'class-variance-authority';

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
  x: number;
  y: number;
  onClick?: (id: string) => void;
}

/**
 * 地图主节点组件
 */
function MapNodeComponent({
  id,
  name,
  x,
  y,
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
      <div className={cn(markerVariants({ selected }))} />
      {/* Label */}
      <div className={cn(labelVariants({ selected }))}>{displayName}</div>
    </div>
  );
}

// 使用 React.memo 优化，仅在 props 变化时重新渲染
export const MapNode = memo(MapNodeComponent);
