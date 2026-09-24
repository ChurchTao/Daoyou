import { InkButton } from '@app/components/ui';
import { useAlchemyCraftSession } from '../alchemyCraftContext';
import {
  describeAppearanceTendency,
  describeFormulaObservation,
} from '../alchemyPresentation';

export function FurnaceObservationStage() {
  const session = useAlchemyCraftSession();
  const analysis = session.analysis.value;
  const batch = analysis?.batchProfile;
  return (
    <div className="space-y-3 text-sm" aria-live="polite">
      <section
        aria-label="丹方预览"
        className="border-wood/25 relative overflow-hidden border-y bg-gradient-to-r from-amber-100/25 via-transparent to-amber-100/10 px-4 py-4"
      >
        <header className="text-wood mb-3 flex items-center gap-2 text-xs">
          <span aria-hidden="true">✦</span>
          <span className="tracking-widest">丹方预览</span>
          <span className="bg-wood/15 h-px flex-1" aria-hidden="true" />
        </header>
        <p className="text-ink-secondary border-wood/30 border-l-2 pl-3 leading-7">
          {describeFormulaObservation(analysis)}
        </p>
        {batch ? (
          <dl className="mt-4 flex flex-wrap gap-x-8 gap-y-3 text-xs">
            <div>
              <dt className="text-ink-secondary mb-1">成丹品阶</dt>
              <dd className="text-wood font-medium">
                {batch.primaryQualityRange.min === batch.primaryQualityRange.max
                  ? batch.primaryQualityRange.min
                  : `${batch.primaryQualityRange.min}—${batch.primaryQualityRange.max}`}
              </dd>
            </div>
            <div>
              <dt className="text-ink-secondary mb-1">预计成丹</dt>
              <dd>
                <span className="font-mono font-semibold">
                  {batch.totalQuantityRange.min === batch.totalQuantityRange.max
                    ? batch.totalQuantityRange.min
                    : `${batch.totalQuantityRange.min}—${batch.totalQuantityRange.max}`}
                </span>{' '}
                枚
              </dd>
            </div>
          </dl>
        ) : null}
      </section>
      <details className="text-ink-secondary text-xs">
        <summary className="cursor-pointer py-2">查看药性与品相</summary>
        <p className="py-2">
          {describeAppearanceTendency(batch?.appearanceHints)}
        </p>
        {analysis?.materialJudgments.map((j) => (
          <p key={j.materialId} className="py-1">
            {j.materialName}：{j.reason}
          </p>
        ))}
      </details>
      <footer className="border-ink/10 flex flex-wrap items-center justify-between gap-3 border-t pt-3">
        <span className="text-xs">
          {session.readiness.estimatedSpiritStones?.toLocaleString()} 灵石 ·{' '}
          {session.qiCost} 天地灵气
        </span>
        <div className="flex gap-3">
          <InkButton onClick={session.returnToPreparation}>重新备料</InkButton>
          <InkButton
            variant="primary"
            disabled={!session.readyForFormulaFire}
            onClick={session.requestFormulaFire}
          >
            开炉炼丹
          </InkButton>
        </div>
      </footer>
    </div>
  );
}
