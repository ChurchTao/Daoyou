import { GameLoadingState } from '@app/components/game-shell/GameLoadingState';
import { InkBadge, InkButton } from '@app/components/ui';
import { getMaterialTypeInfo } from '@shared/lib/gameConceptDisplay';
import type { Material } from '@shared/types/cultivator';

interface FurnaceMaterialDraftListProps {
  selectedIds: string[];
  materialMap: Record<string, Material>;
  doseMap: Record<string, number>;
  minDose: number;
  maxDose: number;
  disabled?: boolean;
  onRemove(id: string): void;
  onDoseChange(id: string, dose: number): void;
}

export function FurnaceMaterialDraftList({
  selectedIds,
  materialMap,
  doseMap,
  minDose,
  maxDose,
  disabled,
  onRemove,
  onDoseChange,
}: FurnaceMaterialDraftListProps) {
  if (selectedIds.length === 0) {
    return (
      <div className="border-ink/15 text-ink-secondary border border-dashed px-4 py-7 text-center text-sm">
        炉膛尚空，请先从灵材匣中挑选本炉药材。
      </div>
    );
  }

  return (
    <div className="divide-ink/10 border-ink/15 divide-y border-y">
      {selectedIds.map((id) => {
        const material = materialMap[id];
        if (!material) {
          return (
            <div key={id} className="flex min-h-16 items-center gap-3 py-2">
              <GameLoadingState
                message="正在辨认灵材……"
                variant="inline"
                className="min-h-0 flex-1 py-0"
              />
              <InkButton
                variant="secondary"
                disabled={disabled}
                onClick={() => onRemove(id)}
              >
                移除
              </InkButton>
            </div>
          );
        }

        const stock = Math.max(minDose, material.quantity ?? 0);
        const effectiveMax = Math.min(maxDose, stock);
        const currentDose = clampDose(
          doseMap[id] ?? minDose,
          minDose,
          effectiveMax,
        );
        const typeInfo = getMaterialTypeInfo(material.type);

        return (
          <article
            key={id}
            className="grid min-h-16 gap-x-4 gap-y-2 py-3 sm:grid-cols-[minmax(0,1fr)_auto] sm:items-center"
          >
            <div className="min-w-0">
              <div className="flex min-w-0 items-center gap-2">
                <strong className="truncate text-base">
                  {typeInfo.icon} {material.name}
                </strong>
                <InkBadge
                  tier={material.rank}
                  compact
                  hideTierText
                  className="shrink-0 px-0"
                >
                  {material.rank}
                </InkBadge>
                <button
                  type="button"
                  disabled={disabled}
                  onClick={() => onRemove(id)}
                  className="text-ink-secondary hover:text-crimson ml-auto min-h-9 shrink-0 px-1 text-xs transition-colors disabled:opacity-35 sm:hidden"
                >
                  移除
                </button>
              </div>
              <p className="text-ink-secondary mt-1 truncate text-xs">
                {typeInfo.label} · {material.element || '无属'} · 余 {stock} 份
              </p>
            </div>

            <div className="grid min-w-0 grid-cols-[auto_auto_1fr] items-center gap-2 sm:flex sm:justify-end">
              <span className="text-ink-secondary text-xs">入炉份量</span>
              <div className="border-ink/20 grid h-10 grid-cols-[2.5rem_3.5rem_2.5rem] divide-x divide-[rgba(58,50,43,0.18)] border">
                <DoseButton
                  label={`${material.name}减少一份`}
                  disabled={disabled || currentDose <= minDose}
                  onClick={() => onDoseChange(id, currentDose - 1)}
                >
                  −
                </DoseButton>
                <label className="bg-wood/[0.035] flex items-center justify-center">
                  <input
                    type="number"
                    inputMode="numeric"
                    aria-label={`${material.name}入炉份量`}
                    min={minDose}
                    max={effectiveMax}
                    value={currentDose}
                    disabled={disabled}
                    onFocus={(event) => event.currentTarget.select()}
                    onChange={(event) => {
                      const nextDose = Number(event.target.value);
                      if (Number.isFinite(nextDose)) {
                        onDoseChange(
                          id,
                          clampDose(nextDose, minDose, effectiveMax),
                        );
                      }
                    }}
                    className="focus-visible:outline-crimson w-7 bg-transparent text-right text-sm font-semibold focus-visible:outline-2"
                  />
                  <span className="text-ink-secondary ml-1 text-xs">份</span>
                </label>
                <DoseButton
                  label={`${material.name}增加一份`}
                  disabled={disabled || currentDose >= effectiveMax}
                  onClick={() => onDoseChange(id, currentDose + 1)}
                >
                  ＋
                </DoseButton>
              </div>

              <button
                type="button"
                disabled={disabled || currentDose >= effectiveMax}
                onClick={() => onDoseChange(id, effectiveMax)}
                className="text-crimson hover:bg-crimson/5 min-h-10 justify-self-end px-2 text-xs transition-colors disabled:cursor-not-allowed disabled:opacity-35"
              >
                全部投入
              </button>
              <button
                type="button"
                disabled={disabled}
                onClick={() => onRemove(id)}
                className="text-ink-secondary hover:text-crimson hidden min-h-10 shrink-0 px-2 text-xs transition-colors disabled:opacity-35 sm:block"
              >
                移除
              </button>
            </div>
          </article>
        );
      })}
    </div>
  );
}

function DoseButton({
  label,
  disabled,
  onClick,
  children,
}: {
  label: string;
  disabled?: boolean;
  onClick(): void;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      aria-label={label}
      disabled={disabled}
      onClick={onClick}
      className="hover:bg-crimson/5 hover:text-crimson grid min-h-10 place-items-center text-base transition-colors disabled:cursor-not-allowed disabled:opacity-25"
    >
      {children}
    </button>
  );
}

function clampDose(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, Math.floor(value)));
}
