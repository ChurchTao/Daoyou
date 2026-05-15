import { cn } from '@shared/lib/cn';
import { cva, type VariantProps } from 'class-variance-authority';

/**
 * MapSatellite 变体定义
 */
const mapSatelliteVariants = cva(
  'absolute transform -translate-x-1/2 -translate-y-1/2 transition-colors duration-200 cursor-pointer',
  {
    variants: {
      selected: {
        true: 'z-30',
        false: 'z-10',
      },
    },
    defaultVariants: {
      selected: false,
    },
  },
);

const satelliteMarkerVariants = cva('h-3 w-3 rotate-45 border', {
  variants: {
    selected: {
      true: 'bg-crimson border-bgpaper',
      false: 'bg-ink/60 border-bgpaper hover:border-crimson',
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
  realmRequirement: string;
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
  realmRequirement,
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
        <div className="text-crimson border-crimson bg-bgpaper absolute top-4 left-1/2 z-40 -translate-x-1/2 border border-dashed px-1 text-[10px] whitespace-nowrap">
          {name} · {realmRequirement}
        </div>
      )}
    </div>
  );
}
