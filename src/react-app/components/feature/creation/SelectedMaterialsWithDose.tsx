import { InkBadge, InkButton } from '@app/components/ui';
import type { FormulaMaterialJudgment } from '@shared/types/consumable';
import { getMaterialTypeInfo } from '@shared/lib/gameConceptDisplay';
import type { Material } from '@shared/types/cultivator';

export interface SelectedMaterialsWithDoseProps {
  selectedIds: string[];
  materialMap: Record<string, Material>;
  doseMap: Record<string, number>;
  minDose: number;
  maxDose: number;
  disabled?: boolean;
  judgmentMap?: Record<string, FormulaMaterialJudgment>;
  sortByJudgment?: boolean;
  onRemove: (id: string) => void;
  onDoseChange: (id: string, dose: number) => void;
}

function getJudgmentOrder(
  verdict: FormulaMaterialJudgment['verdict'] | undefined,
): number {
  switch (verdict) {
    case 'core':
      return 0;
    case 'usable':
      return 1;
    case 'conflict':
      return 2;
    default:
      return 3;
  }
}

function getJudgmentBadgeTone(
  verdict: FormulaMaterialJudgment['verdict'],
): 'accent' | 'default' | 'danger' {
  switch (verdict) {
    case 'core':
      return 'accent';
    case 'usable':
      return 'default';
    case 'conflict':
      return 'danger';
  }
}

function getJudgmentLabel(verdict: FormulaMaterialJudgment['verdict']): string {
  switch (verdict) {
    case 'core':
      return '契合';
    case 'usable':
      return '可用';
    case 'conflict':
      return '偏路';
  }
}

/**
 * 展示已选材料列表，并暴露“本次投入数量”步进器。
 *
 * dose 会被夹紧到 [minDose, min(maxDose, material.quantity)]，
 * 超出库存时会自动回落，保证提交前就是合法值。
 */
export function SelectedMaterialsWithDose({
  selectedIds,
  materialMap,
  doseMap,
  minDose,
  maxDose,
  disabled,
  judgmentMap,
  sortByJudgment = false,
  onRemove,
  onDoseChange,
}: SelectedMaterialsWithDoseProps) {
  if (selectedIds.length === 0) {
    return (
      <p className="text-ink-secondary text-xs">
        尚未投入材料，选中后会在此处固定显示并允许调节投入数量。
      </p>
    );
  }

  const displayIds = sortByJudgment
    ? [...selectedIds].sort((left, right) => {
        const leftJudgment = judgmentMap?.[left];
        const rightJudgment = judgmentMap?.[right];
        const verdictDelta =
          getJudgmentOrder(leftJudgment?.verdict) -
          getJudgmentOrder(rightJudgment?.verdict);
        if (verdictDelta !== 0) {
          return verdictDelta;
        }
        return left.localeCompare(right);
      })
    : selectedIds;

  return (
    <div className="space-y-2">
      {displayIds.map((id) => {
        const material = materialMap[id];
        if (!material) {
          return (
            <div
              key={id}
              className="border-ink/10 bg-bgpaper/55 flex items-center justify-between border border-dashed p-2"
            >
              <span className="text-ink-secondary text-xs">
                材料信息加载中…
              </span>
              <InkButton
                variant="secondary"
                onClick={() => onRemove(id)}
                disabled={disabled}
              >
                取消
              </InkButton>
            </div>
          );
        }

        const stock = material.quantity ?? 0;
        const effectiveMax = Math.min(maxDose, Math.max(stock, minDose));
        const currentDose = Math.min(
          effectiveMax,
          Math.max(minDose, doseMap[id] ?? minDose),
        );
        const typeInfo = getMaterialTypeInfo(material.type);
        const judgment = judgmentMap?.[id];

        return (
          <div
            key={id}
            className="border-ink/10 bg-bgpaper/55 border border-dashed p-2"
          >
            <div className="flex items-start justify-between gap-2">
              <div className="min-w-0">
                <div className="flex flex-wrap items-center gap-2">
                  <p className="text-sm font-semibold">
                    {typeInfo.icon} {material.name}
                  </p>
                  {judgment ? (
                    <InkBadge tone={getJudgmentBadgeTone(judgment.verdict)}>
                      {getJudgmentLabel(judgment.verdict)}
                    </InkBadge>
                  ) : null}
                </div>
                <p className="text-ink-secondary text-xs">
                  {typeInfo.label} · {material.rank} ·{' '}
                  {material.element || '无属性'} · 库存 {stock}
                </p>
                {judgment ? (
                  <p className="text-ink-secondary mt-1 text-xs leading-6">
                    {judgment.reason}
                  </p>
                ) : null}
              </div>
              <InkButton
                variant="secondary"
                onClick={() => onRemove(id)}
                disabled={disabled}
              >
                取消
              </InkButton>
            </div>

            <div className="mt-2 flex items-center justify-between gap-2">
              <span className="text-ink-secondary text-xs">
                本次投入数量
              </span>
              <div className="flex items-center gap-2">
                <InkButton
                  variant="secondary"
                  className="px-2"
                  disabled={disabled || currentDose <= minDose}
                  onClick={() => onDoseChange(id, currentDose - 1)}
                >
                  −
                </InkButton>
                <span className="w-6 text-center text-sm font-semibold">
                  {currentDose}
                </span>
                <InkButton
                  variant="secondary"
                  className="px-2"
                  disabled={disabled || currentDose >= effectiveMax}
                  onClick={() => onDoseChange(id, currentDose + 1)}
                >
                  ＋
                </InkButton>
                <span className="text-ink-secondary text-[0.7rem]">
                  / 上限 {effectiveMax}
                </span>
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );
}
