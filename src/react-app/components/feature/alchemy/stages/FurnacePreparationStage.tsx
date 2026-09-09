import { InkButton } from '@app/components/ui';
import { useAlchemyCraftSession } from '../alchemyCraftContext';

export function FurnacePreparationStage() {
  const session = useAlchemyCraftSession();
  const problem =
    session.readiness.error ||
    session.readiness.validation?.blockingReason ||
    session.analysis.error ||
    (session.readiness.estimatedSpiritStones !== null &&
    !session.readiness.canAfford
      ? '灵石不足'
      : '');
  return (
    <div className="space-y-3">
      {session.mode === 'improvised' ? (
        <label className="flex items-center gap-3 text-sm">
          <span className="shrink-0">炼制目标</span>
          <input
            aria-label="炼制目标"
            value={session.intent}
            maxLength={300}
            placeholder="如：温养经脉、恢复气血"
            onChange={(e) => session.setIntent(e.target.value)}
            className="border-ink/20 min-w-0 flex-1 border-b bg-transparent py-2"
          />
        </label>
      ) : null}
      {problem ? (
        <p role="alert" className="text-crimson text-xs">
          {problem}
        </p>
      ) : null}
      <footer className="border-ink/10 flex flex-wrap items-center justify-between gap-3 border-t pt-3">
        <div className="text-ink-secondary space-y-1 text-xs">
          <p className="font-mono">
            {session.materials.ids.length} / 5 味 · {session.totalDose} 份
          </p>
          <p>
            {session.readiness.estimatedSpiritStones !== null
              ? `${session.readiness.estimatedSpiritStones.toLocaleString()} 灵石 · ${session.qiCost} 天地灵气`
              : '投入灵材后确定本次消耗'}
          </p>
        </div>
        <InkButton
          variant="primary"
          pending={session.readiness.loading || session.analysis.loading}
          pendingLabel="正在核对……"
          disabled={
            session.mode === 'improvised'
              ? !session.readyForImprovisedFire
              : !session.readyForFormulaAnalysis ||
                session.analysis.cooldownRemaining > 0
          }
          onClick={() =>
            session.mode === 'improvised'
              ? session.requestImprovisedFire()
              : void session.analyzeFormula()
          }
        >
          {session.mode === 'improvised'
            ? '开炉炼丹'
            : session.analysis.cooldownRemaining > 0
              ? `${session.analysis.cooldownRemaining} 秒后可预览`
              : '预览丹方'}
        </InkButton>
      </footer>
    </div>
  );
}
