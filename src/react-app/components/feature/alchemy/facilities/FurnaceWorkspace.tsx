import { AlchemyToolWorkspace } from '../AlchemyToolWorkspace';
import { useAlchemyCraftSession } from '../alchemyCraftContext';
import { FurnaceFiringStage } from '../stages/FurnaceFiringStage';
import { FurnaceHarvestStage } from '../stages/FurnaceHarvestStage';
import { FurnaceObservationStage } from '../stages/FurnaceObservationStage';
import { FurnacePreparationStage } from '../stages/FurnacePreparationStage';
import type { AlchemyMode } from '@shared/types/consumable';

export function FurnaceWorkspace({
  onBack,
  onReturn = onBack,
  onModeChange,
}: {
  onBack(): void;
  onReturn?(): void;
  onModeChange?(mode: AlchemyMode): void;
}) {
  const session = useAlchemyCraftSession();
  const title =
    session.phase === 'result'
      ? '查看炼制结果'
      : session.mode === 'formula'
        ? '按照丹方炼制'
        : '随心炼丹';
  return (
    <AlchemyToolWorkspace
      title={title}
      backLabel={session.sectContext?.facilityLabel ?? '玄火丹炉'}
      onBack={onBack}
      backDisabled={session.phase === 'firing'}
    >
      <div className="space-y-6">
        {session.note ? (
          <p className="text-ink-secondary text-sm leading-7">{session.note}</p>
        ) : null}
        {session.phase === 'preparing' ? (
          <FurnacePreparationStage onModeChange={onModeChange} />
        ) : null}
        {session.phase === 'observing' ? <FurnaceObservationStage /> : null}
        {session.phase === 'firing' ? <FurnaceFiringStage /> : null}
        {session.phase === 'result' ? (
          <FurnaceHarvestStage onReturn={onReturn} />
        ) : null}
      </div>
    </AlchemyToolWorkspace>
  );
}
