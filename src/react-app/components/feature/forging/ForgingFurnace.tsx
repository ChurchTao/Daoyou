import { cn } from '@shared/lib/cn';
import { ForgeItemSigil } from './ForgingInventory';
import type { ForgingSession } from './useForgingSession';

const positions = [
  'left-1/2 top-[10%]',
  'left-[84%] top-[29%]',
  'left-[84%] top-[70%]',
  'left-1/2 top-[90%]',
  'left-[16%] top-[70%]',
  'left-[16%] top-[29%]',
];
export function ForgingFurnace({
  session,
  onOpenBag,
}: {
  session: ForgingSession;
  onOpenBag: (filter: 'blueprint' | 'material') => void;
}) {
  return (
    <div
      className="relative mx-auto aspect-square w-full max-w-lg"
      aria-label="六格炼器炉阵"
    >
      <div
        aria-hidden="true"
        className="border-ink/10 absolute inset-[12%] rounded-full border"
      />
      <img
        src="/assets/forging/earthfire-furnace.webp"
        alt="墨铜炼器炉，朱色地火映亮炉膛"
        width={600}
        height={600}
        className={cn(
          'pointer-events-none absolute top-[16%] left-[19%] h-[70%] w-[62%] object-contain transition-[filter] duration-700 motion-reduce:transition-none',
          session.pending &&
            'drop-shadow-[0_0_18px_rgba(178,80,30,0.45)] motion-safe:animate-pulse',
          session.result && 'drop-shadow-[0_0_12px_rgba(178,80,30,0.25)]',
        )}
      />
      {positions.map((position, index) => {
        const id = index
          ? session.materialIds[index - 1]
          : session.blueprint?.id;
        const item = id ? session.byId.get(id) : undefined;
        const unused = index > (session.cost?.quantity ?? 0);
        return (
          <button
            key={index}
            type="button"
            disabled={session.locked || (index > 0 && unused)}
            aria-label={
              index === 0
                ? '选择或更换图纸'
                : unused
                  ? '本次无需材料'
                  : item
                    ? `移出${item.name}`
                    : `投入第${index}份材料`
            }
            onClick={() =>
              index === 0
                ? onOpenBag('blueprint')
                : item
                  ? session.remove(index - 1)
                  : onOpenBag('material')
            }
            className={cn(
              'bg-paper border-ink/20 hover:border-crimson/50 absolute flex aspect-square min-h-16 w-[19%] -translate-x-1/2 -translate-y-1/2 cursor-pointer flex-col items-center justify-center border px-1 py-1 text-xs transition-colors disabled:cursor-default motion-reduce:transition-none',
              position,
              unused && index > 0 && 'text-ink-secondary/50 border-dashed',
              item && 'border-crimson/30',
            )}
          >
            <span
              aria-hidden="true"
              className="text-ink-secondary shrink-0 text-lg leading-none"
            >
              {item ? (
                <ForgeItemSigil item={item} />
              ) : unused && index > 0 ? (
                '·'
              ) : (
                '＋'
              )}
            </span>
            <span className="line-clamp-2 shrink-0 leading-4">
              {index === 0
                ? (item?.name ?? '道装图纸')
                : unused
                  ? session.cost
                    ? '本次无需'
                    : '待定'
                  : (item?.name ?? '投入灵材')}
            </span>
          </button>
        );
      })}
    </div>
  );
}
