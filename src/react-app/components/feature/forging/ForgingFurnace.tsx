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
  revealed,
  onReveal,
  onInspect,
}: {
  session: ForgingSession;
  onOpenBag: (filter: 'blueprint' | 'material') => void;
  revealed: boolean;
  onReveal: () => void;
  onInspect: () => void;
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
      {session.pending ? (
        <div
          aria-hidden="true"
          className="pointer-events-none absolute inset-0 z-10 motion-reduce:hidden"
        >
          {[
            [50, 10],
            [84, 29],
            [84, 70],
            [50, 90],
            [16, 70],
            [16, 29],
          ].map(([x, y], index) =>
            (
              index === 0 ? session.blueprint : session.materialIds[index - 1]
            ) ? (
              <div
                key={index}
                className="absolute inset-0 motion-safe:animate-[forge-gather_800ms_ease-in_both]"
                style={{ transformOrigin: '50% 53%' }}
              >
                <span
                  className="absolute h-4 w-4 -translate-x-1/2 -translate-y-1/2 rounded-full bg-amber-200 shadow-[0_0_18px_7px_rgba(217,146,62,0.65)]"
                  style={{ left: `${x}%`, top: `${y}%` }}
                />
              </div>
            ) : null,
          )}
          <div className="absolute top-[53%] left-1/2 h-[30%] w-[30%] -translate-x-1/2 -translate-y-1/2 rounded-full bg-[radial-gradient(ellipse,rgba(255,210,120,0.85),rgba(210,95,30,0.4)_40%,transparent_70%)] motion-safe:animate-[forge-fire_1600ms_ease-in-out_infinite_alternate]" />
        </div>
      ) : null}
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
      {session.result ? (
        <div className="absolute top-[53%] left-1/2 z-10 w-[36%] -translate-x-1/2 -translate-y-1/2 text-center">
          <button
            type="button"
            aria-label={`查看${session.result.equipment.name}`}
            disabled={!revealed}
            onClick={onInspect}
            onAnimationEnd={(event) => {
              if (event.target === event.currentTarget && !revealed) onReveal();
            }}
            className={cn(
              'bg-paper border-crimson/60 text-crimson hover:border-crimson mx-auto flex aspect-square w-[58%] cursor-pointer items-center justify-center border text-3xl shadow-[0_0_24px_rgba(178,80,30,0.3)] transition-colors focus-visible:outline-2 focus-visible:outline-offset-4 disabled:cursor-default',
              !revealed &&
                'animate-[forge-reveal_1100ms_ease-out_both] motion-reduce:[animation-duration:1ms]',
            )}
          >
            ◇
          </button>
          <p
            className={cn(
              'bg-paper/90 text-crimson mt-2 px-1 py-1 text-sm',
              !revealed && 'opacity-0',
            )}
          >
            {session.result.equipment.name}
          </p>
        </div>
      ) : null}
    </div>
  );
}
