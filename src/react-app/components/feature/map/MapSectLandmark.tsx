import { cn } from '@shared/lib/cn';
import { memo } from 'react';

export interface MapSectLandmarkProps {
  id: string;
  name: string;
  x: number;
  y: number;
  emphasized?: boolean;
  selected?: boolean;
  onClick?: (id: string) => void;
}

function MapSectLandmarkComponent({
  id,
  name,
  x,
  y,
  emphasized = false,
  selected = false,
  onClick,
}: MapSectLandmarkProps) {
  return (
    <button
      type="button"
      aria-pressed={selected}
      aria-label={`宗门地标：${name}`}
      className={cn(
        'absolute z-20 -translate-x-1/2 -translate-y-1/2 cursor-pointer transition duration-300',
        selected
          ? 'z-30 scale-125'
          : emphasized
            ? 'scale-110 hover:scale-125'
            : 'hover:scale-110',
      )}
      style={{ left: `${x}%`, top: `${y}%` }}
      onClick={(event) => {
        event.stopPropagation();
        onClick?.(id);
      }}
    >
      <span
        className={cn(
          'border-bgpaper bg-crimson relative block size-5 rotate-45 border-2 shadow-[0_0_0_2px_rgba(129,29,29,0.28)]',
          emphasized && 'shadow-[0_0_0_4px_rgba(129,29,29,0.24)]',
        )}
      >
        <span className="bg-bgpaper absolute inset-[5px] block rounded-full" />
      </span>
      <span
        className={cn(
          'bg-background text-crimson absolute top-7 left-1/2 -translate-x-1/2 border px-2 py-0.5 text-xs font-bold whitespace-nowrap shadow-sm',
          selected || emphasized ? 'border-crimson/45' : 'border-ink/10',
        )}
      >
        {name}
      </span>
    </button>
  );
}

export const MapSectLandmark = memo(MapSectLandmarkComponent);
