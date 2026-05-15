import { cn } from '@shared/lib/cn';
import { cva, type VariantProps } from 'class-variance-authority';
import { memo } from 'react';

/**
 * MapNode 变体定义
 */
const mapNodeVariants = cva(
  'absolute transform -translate-x-1/2 -translate-y-1/2 transition-colors duration-200 cursor-pointer',
  {
    variants: {
      selected: {
        true: 'z-30',
        false: 'z-20',
      },
    },
    defaultVariants: {
      selected: false,
    },
  },
);

const markerVariants = cva('h-4 w-4 border-2', {
  variants: {
    selected: {
      true: 'bg-crimson border-bgpaper',
      false: 'border-ink bg-background hover:border-crimson',
    },
  },
  defaultVariants: {
    selected: false,
  },
});

const labelVariants = cva(
  'absolute top-6 left-1/2 -translate-x-1/2 whitespace-nowrap border px-2 py-0.5 text-xs font-bold',
  {
    variants: {
      selected: {
        true: 'border-crimson bg-bgpaper text-crimson',
        false: 'border-ink/10 bg-background text-ink',
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
          marketEnabled && 'border-teal',
        )}
      />
      {marketEnabled && (
        <div className="text-teal border-teal bg-bgpaper absolute -top-2 -right-2 border border-dashed px-1 text-[9px] leading-4">
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
