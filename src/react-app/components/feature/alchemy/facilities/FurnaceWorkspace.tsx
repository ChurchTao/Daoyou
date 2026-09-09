import { InkButton, InkDetailDrawer } from '@app/components/ui';
import type { AlchemyMode } from '@shared/types/consumable';
import { useRef, useState } from 'react';
import { AlchemyBag } from '../AlchemyBag';
import { AlchemyFurnace } from '../AlchemyFurnace';
import { FormulaPickerModal } from '../FormulaPickerModal';
import { useAlchemyCraftSession } from '../alchemyCraftContext';
import { FurnaceFiringStage } from '../stages/FurnaceFiringStage';
import { FurnaceHarvestStage } from '../stages/FurnaceHarvestStage';
import { FurnaceObservationStage } from '../stages/FurnaceObservationStage';
import { FurnacePreparationStage } from '../stages/FurnacePreparationStage';

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
  const [bagOpen, setBagOpen] = useState(false);
  const [formulaOpen, setFormulaOpen] = useState(false);
  const bagPane = useRef<HTMLElement>(null);
  const openBag = () => {
    if (window.matchMedia('(min-width: 768px)').matches)
      bagPane.current?.querySelector('input')?.focus();
    else setBagOpen(true);
  };
  const bag = <AlchemyBag />;
  const locked = session.phase === 'firing' || session.phase === 'result';
  return (
    <div className="space-y-4 text-sm">
      <header className="border-ink/10 flex items-center justify-between gap-3 border-b pb-3">
        <h3 className="font-medium">
          {session.sectContext?.facilityLabel ?? '玄火丹炉'}
        </h3>
        <InkButton
          disabled={session.phase === 'firing'}
          onClick={session.phase === 'result' ? onReturn : onBack}
        >
          返回炼丹房
        </InkButton>
      </header>
      <div className="grid gap-6 md:grid-cols-[minmax(0,1.2fr)_minmax(0,1fr)]">
        <section className="min-w-0 space-y-4">
          <div className="text-right md:hidden">
            <InkButton
              disabled={session.phase === 'firing'}
              onClick={() => setBagOpen(true)}
            >
              储物袋
            </InkButton>
          </div>
          <div className="flex items-center justify-center gap-3 text-xs">
            <span
              className={
                session.mode === 'improvised'
                  ? 'text-ink'
                  : 'text-ink-secondary'
              }
            >
              随心炼制
            </span>
            <button
              type="button"
              role="switch"
              aria-label="丹方炼制"
              aria-checked={session.mode === 'formula'}
              disabled={locked}
              onClick={() => {
                const mode =
                  session.mode === 'formula' ? 'improvised' : 'formula';
                if (onModeChange) onModeChange(mode);
                else session.setMode(mode);
              }}
              className="border-ink/20 bg-ink/5 aria-checked:bg-crimson/10 relative h-6 w-11 rounded-full border disabled:opacity-50"
            >
              <span
                className={`bg-ink-secondary absolute top-1 h-3.5 w-3.5 rounded-full transition-[left] ${session.mode === 'formula' ? 'left-6' : 'left-1'}`}
              />
            </button>
            <span
              className={
                session.mode === 'formula' ? 'text-ink' : 'text-ink-secondary'
              }
            >
              丹方炼制
            </span>
          </div>
          <AlchemyFurnace
            onOpenBag={openBag}
            onOpenFormula={() => setFormulaOpen(true)}
          />
          {session.note ? (
            <p className="text-ink-secondary text-sm leading-7">
              {session.note}
            </p>
          ) : null}
          {session.phase === 'preparing' ? <FurnacePreparationStage /> : null}
          {session.phase === 'observing' ? <FurnaceObservationStage /> : null}
          {session.phase === 'firing' ? <FurnaceFiringStage /> : null}
          {session.phase === 'result' ? <FurnaceHarvestStage /> : null}
        </section>
        <aside
          ref={bagPane}
          aria-label="炼丹物品栏"
          className="border-ink/10 hidden min-w-0 border-l pl-5 md:block"
        >
          {bag}
        </aside>
      </div>
      <InkDetailDrawer
        isOpen={bagOpen}
        title="储物袋"
        size="md"
        onClose={() => setBagOpen(false)}
      >
        {bag}
      </InkDetailDrawer>
      <FormulaPickerModal
        isOpen={formulaOpen}
        selectedId={session.formula?.id}
        onClose={() => setFormulaOpen(false)}
        onSelect={session.selectFormula}
      />
    </div>
  );
}
