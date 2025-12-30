'use client';

import { cn } from '@/lib/cn';
import { cva, type VariantProps } from 'class-variance-authority';

/**
 * MapSatellite 变体定义
 */
const mapSatelliteVariants = cva(
  'absolute transform -translate-x-1/2 -translate-y-1/2 transition-all duration-300 cursor-pointer',
  {
    variants: {
      selected: {
        true: 'z-30 scale-125',
        false: 'z-10 hover:scale-110',
      },
    },
    defaultVariants: {
      selected: false,
    },
  },
);

const satelliteMarkerVariants = cva('w-3 h-3 rotate-45 border shadow-sm', {
  variants: {
    selected: {
      true: 'bg-crimson border-paper ring-2 ring-crimson/20',
      false: 'bg-ink/60 border-paper hover:bg-crimson/60',
    },
  },
  defaultVariants: {
    selected: false,
  },
});

export interface MapSatelliteProps extends VariantProps<
  typeof mapSatelliteVariants
> {
  id: string;
  name: string;
  x: number;
  y: number;
  onClick?: (id: string) => void;
}

/**
 * 地图卫星节点组件
 */
export function MapSatellite({
  id,
  name,
  x,
  y,
  selected = false,
  onClick,
}: MapSatelliteProps) {
  const handleClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    onClick?.(id);
  };

  return (
    <div
      className={cn(mapSatelliteVariants({ selected }))}
      style={{ left: `${x}%`, top: `${y}%` }}
      onClick={handleClick}
    >
      {/* Satellite Icon */}
      <div className={cn(satelliteMarkerVariants({ selected }))} />

      {/* Label appears on select */}
      {selected && (
        <div className="absolute top-4 left-1/2 -translate-x-1/2 whitespace-nowrap text-[10px] bg-crimson text-paper px-1 rounded z-40">
          {name}
        </div>
      )}
    </div>
  );
}
