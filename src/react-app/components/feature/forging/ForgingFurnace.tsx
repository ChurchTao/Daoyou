import { InkButton } from '@app/components/ui/InkButton';
import { cn } from '@shared/lib/cn';
import { ItemSlot } from '../items/ItemSlot';
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
}: {
  session: ForgingSession;
  onOpenBag: (filter: 'blueprint' | 'material') => void;
  revealed: boolean;
  onReveal: () => void;
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
        const action = () =>
          index === 0
            ? onOpenBag('blueprint')
            : item
              ? session.remove(index - 1)
              : onOpenBag('material');
        return (
          <div
            key={index}
            className={cn(
              'absolute w-[19%] -translate-x-1/2 -translate-y-1/2',
              position,
            )}
          >
            <ItemSlot
              item={item ? { ...item, quantity: 1 } : undefined}
              emptyLabel={
                index === 0
                  ? '道装图纸'
                  : unused
                    ? session.cost
                      ? '无需材料'
                      : '待选图纸'
                    : '投入灵材'
              }
              disabled={session.locked || (index > 0 && unused)}
              emptyIcon={index > 0 && unused ? '—' : '＋'}
              className={cn(
                'w-full',
                index > 0 && unused
                  ? 'border-ink/15 bg-ink/5 hover:border-ink/15 border-dashed bg-[repeating-linear-gradient(135deg,transparent,transparent_6px,rgba(70,60,45,0.06)_6px,rgba(70,60,45,0.06)_7px)]'
                  : !session.locked && 'border-crimson/50 hover:bg-crimson/5',
              )}
              onQuickAction={action}
            >
              {item
                ? (close) => (
                    <InkButton
                      disabled={session.locked}
                      onClick={() => {
                        close();
                        action();
                      }}
                    >
                      {index === 0 ? '更换图纸' : '移出'}
                    </InkButton>
                  )
                : undefined}
            </ItemSlot>
          </div>
        );
      })}
      {session.result ? (
        <div className="absolute top-[53%] left-1/2 z-10 w-[19%] -translate-x-1/2 -translate-y-1/2 text-center">
          <div
            onAnimationEnd={(event) => {
              if (event.target === event.currentTarget && !revealed) onReveal();
            }}
            className={cn(
              'w-full',
              !revealed &&
                'animate-[forge-reveal_1100ms_ease-out_both] motion-reduce:[animation-duration:1ms]',
            )}
          >
            <ItemSlot
              item={{
                definitionId: 'equipment.v6',
                name: session.result.equipment.name,
                quantity: 1,
                instanceData: session.result.equipment,
              }}
              disabled={!revealed}
              className="w-full shadow-[0_0_24px_rgba(178,80,30,0.3)]"
            />
          </div>
        </div>
      ) : null}
    </div>
  );
}
