import { InkButton } from '@app/components/ui/InkButton';
import { consumableFactsOf } from '@shared/items/definitions/consumables';
import { cn } from '@shared/lib/cn';
import { FurnaceGatherEffect } from '../craft/FurnaceGatherEffect';
import { ItemSlot } from '../items/ItemSlot';
import {
  ALCHEMY_MAX_DOSE,
  useAlchemyCraftSession,
} from './alchemyCraftContext';

const positions = [
  'left-1/2 top-[10%]',
  'left-[84%] top-[29%]',
  'left-[84%] top-[70%]',
  'left-1/2 top-[90%]',
  'left-[16%] top-[70%]',
  'left-[16%] top-[29%]',
];
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
  const locked = session.phase === 'firing' || session.phase === 'result';
  return (
    <div
      className="relative mx-auto aspect-square w-full max-w-lg"
      aria-label={
        session.mode === 'formula' ? '丹方与五味炼丹炉阵' : '五味炼丹炉阵'
      }
    >
      <div
        aria-hidden="true"
        className="border-ink/10 absolute inset-[12%] rounded-full border"
      />
      {session.phase === 'firing' ? (
        <FurnaceGatherEffect
          slots={positions.map((_, index) =>
            index === 0
              ? session.mode === 'formula' && !!session.formula
              : !!session.materials.ids[index - 1],
          )}
        />
      ) : null}
      <img
        src="/assets/alchemy/xuanfire-furnace.png"
        alt="青玉铜丹炉，温火凝聚药蕴"
        width={1280}
        height={1280}
        className={cn(
          'pointer-events-none absolute top-[16%] left-[19%] h-[70%] w-[62%] object-contain',
          primary && 'drop-shadow-[0_0_12px_rgba(178,80,30,0.25)]',
          session.phase === 'firing' &&
            'drop-shadow-[0_0_18px_rgba(178,80,30,0.45)] motion-safe:animate-pulse',
        )}
      />
      {positions.map((position, index) => {
        if (index === 0)
          return session.mode === 'formula' ? (
            <div
              key="formula"
              className={cn(
                'absolute w-[19%] -translate-x-1/2 -translate-y-1/2',
                position,
              )}
            >
              <button
                type="button"
                disabled={locked}
                onClick={onOpenFormula}
                aria-label={
                  session.formula
                    ? `更换丹方：${session.formula.name}`
                    : '选择丹方'
                }
                className="bg-paper border-crimson/50 hover:bg-crimson/5 @container relative aspect-square min-h-0 w-full overflow-hidden border text-xs disabled:opacity-60"
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
                <span className="absolute inset-x-1 bottom-[8%] truncate text-center text-[clamp(0.625rem,17cqw,0.75rem)] leading-tight">
                  {session.formula?.name ?? '选择丹方'}
                </span>
              </button>
            </div>
          ) : null;
        const id = session.materials.ids[index - 1];
        const material = session.materials.map[id];
        return (
          <div
            key={index}
            className={cn(
              'absolute w-[19%] -translate-x-1/2 -translate-y-1/2',
              position,
            )}
          >
            <ItemSlot
              disabled={locked}
              emptyLabel="投入灵材"
              emptyIcon="＋"
              className={cn(
                'w-full',
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
              onQuickAction={material ? undefined : onOpenBag}
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
                          <p key={j.materialId} className="text-ink-secondary">
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
  );
}
