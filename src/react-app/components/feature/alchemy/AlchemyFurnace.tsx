import { GameIcon } from '@app/components/ui/GameIcon';
import { InkButton } from '@app/components/ui/InkButton';
import { consumableFactsOf } from '@shared/items/definitions/consumables';
import { cn } from '@shared/lib/cn';
import { FurnaceGatherEffect } from '../craft/FurnaceGatherEffect';
import { ItemSlot } from '../items/ItemSlot';
import {
  ALCHEMY_MAX_DOSE,
  useAlchemyCraftSession,
} from './alchemyCraftContext';

const ringPositions = (count: number): [number, number][] =>
  Array.from({ length: count }, (_, index) => {
    const angle = (index * 2 * Math.PI) / count - Math.PI / 2;
    return [50 + 40 * Math.cos(angle), 50 + 40 * Math.sin(angle)];
  });
const improvisedPositions = ringPositions(6);
const formulaPositions = ringPositions(7);

export function AlchemyFurnace({
  onOpenBag,
  onOpenFormula,
}: {
  onOpenBag(): void;
  onOpenFormula(): void;
}) {
  const session = useAlchemyCraftSession();
  const primary =
    session.phase === 'result'
      ? session.result.craftedConsumables[0]
      : undefined;
  const materialPositions =
    session.mode === 'formula'
      ? formulaPositions.slice(1)
      : improvisedPositions;
  const locked = session.phase === 'firing' || session.phase === 'result';
  return (
    <div className="relative mx-auto w-full max-w-lg">
      {session.mode === 'formula' ? (
        <div className="absolute top-[10%] left-1/2 z-10 w-[19%] -translate-x-1/2 -translate-y-1/2">
          <button
            type="button"
            disabled={locked}
            onClick={onOpenFormula}
            aria-label={
              session.formula ? `更换丹方：${session.formula.name}` : '选择丹方'
            }
            className="bg-paper border-ink/30 hover:bg-crimson/5 @container relative block aspect-square min-h-0 w-full overflow-hidden border text-xs disabled:opacity-60"
          >
            <span
              aria-hidden="true"
              className={cn(
                'pointer-events-none absolute grid place-items-center leading-none',
                session.formula
                  ? 'inset-x-0 top-[10%] bottom-[24%] text-[clamp(1.5rem,48cqw,2.75rem)]'
                  : 'text-ink/25 inset-0 text-xl',
              )}
            >
              {session.formula ? '📜' : '＋'}
            </span>
            <span className="absolute inset-x-0.5 bottom-[8%] truncate text-center text-[clamp(0.625rem,17cqw,0.75rem)] leading-tight">
              {session.formula?.name ?? '选择丹方'}
            </span>
          </button>
        </div>
      ) : null}
      <div className="relative aspect-square w-full" aria-label="六味炼丹炉阵">
        <div
          aria-hidden="true"
          className="border-ink/10 absolute inset-[10%] rounded-full border"
        />
        {session.phase === 'firing' ? (
          <FurnaceGatherEffect
            slots={materialPositions.map(
              (_, index) => !!session.materials.ids[index],
            )}
            positions={materialPositions}
          />
        ) : null}
        <div
          data-guide="alchemy.hearth"
          className="pointer-events-none absolute top-[16%] left-[19%] h-[70%] w-[62%]"
        >
          <GameIcon
            purpose="artwork"
            value="icon:xuanfire-furnace"
            label="青绿水墨丹炉，温火轻烟凝聚药蕴"
            className={cn(
              'size-full',
              primary && 'drop-shadow-[0_0_12px_rgba(178,80,30,0.25)]',
              session.phase === 'firing' &&
                'drop-shadow-[0_0_18px_rgba(178,80,30,0.45)] motion-safe:animate-pulse',
            )}
          />
        </div>
        {materialPositions.map(([x, y], index) => {
          const id = session.materials.ids[index];
          const material = session.materials.map[id];
          return (
            <div
              key={index}
              className="absolute w-[19%] -translate-x-1/2 -translate-y-1/2"
              style={{ left: `${x}%`, top: `${y}%` }}
            >
              <ItemSlot
                disabled={locked}
                emptyLabel="投入灵材"
                emptyIcon="＋"
                className={cn(
                  'block w-full',
                  !locked && 'border-crimson/50 hover:bg-crimson/5',
                )}
                item={
                  material
                    ? {
                        definitionId: 'material.v1',
                        name: material.name,
                        quantity: session.materials.doses[id] ?? 1,
                        instanceData: {
                          name: material.name,
                          type: material.type,
                          rank: material.rank,
                          element: material.element ?? null,
                          description: material.description ?? '',
                        },
                      }
                    : undefined
                }
                onQuickAction={
                  material ? () => session.removeMaterial(id) : onOpenBag
                }
                quickOnTouch
              >
                {material
                  ? (close) => (
                      <div className="space-y-3">
                        <label className="flex items-center gap-3">
                          入炉份量
                          <input
                            aria-label={`${material.name}入炉份量`}
                            type="number"
                            min={1}
                            max={Math.min(
                              material.quantity ?? 1,
                              ALCHEMY_MAX_DOSE,
                            )}
                            value={session.materials.doses[id] ?? 1}
                            disabled={locked}
                            onChange={(e) => {
                              if (e.target.value)
                                session.setMaterialDose(
                                  id,
                                  Number(e.target.value),
                                );
                            }}
                            className="border-ink/20 w-20 border bg-transparent p-2 font-mono"
                          />
                        </label>
                        {session.analysis.value?.materialJudgments
                          .filter((j) => j.materialId === id)
                          .map((j) => (
                            <p
                              key={j.materialId}
                              className="text-ink-secondary"
                            >
                              {j.reason}
                            </p>
                          ))}
                        <InkButton
                          disabled={locked}
                          onClick={() => {
                            session.removeMaterial(id);
                            close();
                          }}
                        >
                          移出
                        </InkButton>
                      </div>
                    )
                  : undefined}
              </ItemSlot>
            </div>
          );
        })}
        {primary ? (
          <div
            key={primary.id ?? primary.name}
            aria-label="本炉主丹"
            className="absolute top-[53%] left-1/2 z-10 w-[19%] -translate-x-1/2 -translate-y-1/2 text-center"
          >
            <div className="w-full animate-[forge-reveal_1100ms_ease-out_both] motion-reduce:[animation-duration:1ms]">
              <ItemSlot
                className="w-full shadow-[0_0_24px_rgba(178,80,30,0.3)]"
                badge="主丹"
                item={{
                  definitionId: 'consumable.v1',
                  name: primary.name,
                  quantity: primary.quantity,
                  instanceData: consumableFactsOf(primary),
                }}
              />
            </div>
          </div>
        ) : null}
      </div>
    </div>
  );
}
