import { cn } from '@app/lib/cn';

export type WandererMapPoint = { id: string; x: number; y: number };

export function WandererSigil({ className }: { className?: string }) {
  return (
    <span
      aria-hidden
      className={cn(
        'font-heading text-ink inline-flex items-center justify-center leading-none',
        className,
      )}
    >
      商
    </span>
  );
}

export function WandererMarker({
  point,
  onSelect,
}: {
  point: WandererMapPoint | null;
  onSelect: () => void;
}) {
  if (!point) return null;
  return (
    <button
      type="button"
      aria-label="云游商人"
      onClick={onSelect}
      style={{ left: point.x, top: point.y }}
      className="bg-paper/95 border-crimson/40 absolute z-10 flex -translate-x-1/2 -translate-y-full flex-col items-center rounded border px-2 py-1 shadow-sm"
    >
      <WandererSigil className="text-5xl" />
      <span className="text-crimson text-xs whitespace-nowrap">云游商人</span>
    </button>
  );
}
