import { InkButton, InkNotice } from '@app/components/ui';
import { useAlchemyCraftSession } from '../alchemyCraftContext';
import {
  describeAppearanceTendency,
  describeBatchOmen,
  describeEssenceState,
  describeFireState,
  describeFormulaObservation,
} from '../alchemyPresentation';

export function FurnaceObservationStage() {
  const session = useAlchemyCraftSession();
  const batch = session.analysis.value?.batchProfile ?? null;
  const fire = describeFireState({
    preview: batch,
    blockingReason: session.readiness.validation?.blockingReason,
    canAfford: session.readiness.canAfford,
  });
  const essence = describeEssenceState(batch);
  const omen = describeBatchOmen(batch);
  return (
    <div className="space-y-5">
      <div className="border-ink/15 relative overflow-hidden border bg-[radial-gradient(circle_at_50%_75%,rgba(145,36,36,0.14),transparent_45%)] px-5 py-9 text-center">
        <div
          aria-hidden
          className="border-crimson/25 mx-auto grid size-32 place-items-center rounded-full border shadow-[inset_0_0_35px_rgba(145,36,36,0.12),0_0_40px_rgba(145,36,36,0.08)]"
        >
          <div className="border-crimson/40 text-crimson grid size-20 place-items-center rounded-full border border-dashed text-4xl">
            火
          </div>
        </div>
        <p className="text-crimson mt-5 text-xs tracking-[0.28em]">
          炼制预览
        </p>
        <h3 className="mt-2 text-xl">{fire.label}</h3>
        <p className="text-ink-secondary mx-auto mt-2 max-w-xl text-sm leading-7">
          {fire.description}
        </p>
      </div>

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <Omen title="药蕴" value={essence.label}>
          {essence.description}
        </Omen>
        <Omen
          title="主丹征兆"
          value={
            batch
              ? `${batch.primaryQualityRange.min}—${batch.primaryQualityRange.max}`
              : '未显'
          }
        >
          {omen.primary}
        </Omen>
        <Omen
          title="同炉副丹"
          value={
            batch && batch.possibleQualities.length > 1
              ? '已有分流'
              : '尚未分流'
          }
        >
          {omen.secondary}
        </Omen>
        <Omen title="品相倾向" value={batch ? '丹纹初现' : '未显'}>
          {describeAppearanceTendency(batch?.appearanceHints)}
        </Omen>
      </div>

      {describeFormulaObservation(session.analysis.value) ? (
        <InkNotice
          tone={session.analysis.value?.fitBand === 'poor' ? 'warning' : 'info'}
        >
          {describeFormulaObservation(session.analysis.value)}
        </InkNotice>
      ) : null}
      {session.analysis.value?.materialJudgments.length ? (
        <section className="border-ink/15 border p-5">
          <p className="text-ink-secondary text-xs tracking-[0.18em]">
            材料判断
          </p>
          <div className="divide-ink/10 mt-3 divide-y">
            {session.analysis.value.materialJudgments.map((judgment) => (
              <div
                key={judgment.materialId}
                className="grid gap-1 py-3 sm:grid-cols-[8rem_minmax(0,1fr)]"
              >
                <span className="font-medium">{judgment.materialName}</span>
                <span className="text-ink-secondary text-sm leading-6">
                  {judgment.reason}
                </span>
              </div>
            ))}
          </div>
        </section>
      ) : null}
      {session.analysis.value?.warnings.map((warning) => (
        <InkNotice key={warning} tone="warning">
          {warning}
        </InkNotice>
      ))}
      {session.readiness.estimatedSpiritStones !== null &&
      !session.readiness.loading &&
      !session.readiness.canAfford ? (
        <InkNotice tone="warning">
          灵石不足：本次炼制需要{' '}
          {session.readiness.estimatedSpiritStones.toLocaleString('zh-CN')} 枚，
          当前仅有{' '}
          {(session.cultivator?.spiritStones ?? 0).toLocaleString('zh-CN')} 枚。
        </InkNotice>
      ) : null}
      <section className="border-ink/15 border p-5">
        <p className="text-crimson text-center text-xs tracking-[0.28em]">
          炼制前确认
        </p>
        <div className="divide-ink/10 border-ink/10 mt-4 divide-y border-y">
          <ConfirmRow
            label="炼法"
            value={
              session.mode === 'formula'
                ? `依方 · ${session.formula?.name ?? '未定丹方'}`
                : `随心 · ${session.intent.trim()}`
            }
          />
          <ConfirmRow
            label="材料"
            value={`${session.materials.ids.length} 味 · 共 ${session.totalDose} 份`}
          />
          <ConfirmRow
            label="灵石"
            value={
              session.readiness.estimatedSpiritStones === null
                ? '待核'
                : `${session.readiness.estimatedSpiritStones} 枚`
            }
          />
          <ConfirmRow label="天地灵气" value={`${session.qiCost} 点`} />
          <ConfirmRow
            label="预计成丹"
            value={
              batch
                ? `${batch.totalQuantityRange.min}—${batch.totalQuantityRange.max} 枚`
                : '征兆未显'
            }
          />
        </div>
      </section>

      <div className="flex flex-wrap justify-between gap-3">
        <InkButton variant="secondary" onClick={session.returnToPreparation}>
          返回修改
        </InkButton>
        <InkButton
          variant="primary"
          disabled={!session.readyForFormulaFire}
          onClick={session.requestFormulaFire}
        >
          确认炼制
        </InkButton>
      </div>
    </div>
  );
}

function Omen({
  title,
  value,
  children,
}: {
  title: string;
  value: string;
  children: React.ReactNode;
}) {
  return (
    <section className="border-ink/15 bg-ink/[0.025] border p-4">
      <p className="text-ink-secondary text-xs tracking-[0.16em]">{title}</p>
      <p className="mt-2 text-lg font-semibold">{value}</p>
      <p className="text-ink-secondary mt-2 text-xs leading-6">{children}</p>
    </section>
  );
}
function ConfirmRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="grid gap-1 px-3 py-3 sm:grid-cols-[6rem_minmax(0,1fr)]">
      <span className="text-ink-secondary text-sm">{label}</span>
      <span>{value}</span>
    </div>
  );
}
