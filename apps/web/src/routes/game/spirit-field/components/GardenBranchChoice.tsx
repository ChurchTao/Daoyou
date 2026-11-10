import { InkButton } from '@app/components/ui';
import type {
  SpiritGardenBranch,
  SpiritGardenPlantView,
  SpiritGardenSpecies,
} from '@daoyou/game-domain/spirit-field';
import { getSpiritGardenOutput } from '@daoyou/game-rules/spirit-field';
import { useId } from 'react';
import { formatGardenDuration } from '../garden-presentation';
import { BotanicalArt } from './BotanicalArt';

interface GardenBranchChoiceProps {
  plant: SpiritGardenPlantView;
  species: SpiritGardenSpecies;
  selectedBranch: SpiritGardenBranch | null;
  locked: boolean;
  onSelect(branch: SpiritGardenBranch): void;
  onConfirm(): void;
  onBack(): void;
}

export function GardenBranchChoice({
  plant,
  species,
  selectedBranch,
  locked,
  onSelect,
  onConfirm,
  onBack,
}: GardenBranchChoiceProps) {
  const choiceId = useId();
  return (
    <div className="space-y-6 pb-2">
      <div className="flex items-center gap-5">
        <BotanicalArt
          speciesId={plant.speciesId}
          stage={plant.stage}
          className="w-28 shrink-0"
        />
        <div className="space-y-2">
          <p className="text-crimson text-xs">蕴灵已足</p>
          <h3 className="text-xl font-semibold">
            让{plant.speciesName}长成什么
          </h3>
          <p className="text-ink-secondary text-sm leading-7">
            选择今后的收成方向。它会沿这条路继续生长。
          </p>
        </div>
      </div>

      <fieldset className="space-y-3">
        <legend className="sr-only">培养方向</legend>
        {(['abundance', 'essence'] as const).map((branch) => {
          const route = species.branches[branch];
          const output = getSpiritGardenOutput({ ...plant, branch });
          const selected = selectedBranch === branch;
          return (
            <label
              key={branch}
              className={`relative block cursor-pointer border-l-2 px-4 py-4 transition-colors ${selected ? 'border-crimson bg-crimson/5' : 'border-ink/15 hover:bg-ink/4'} ${locked ? 'pointer-events-none opacity-60' : ''}`}
            >
              <input
                className="peer sr-only"
                type="radio"
                name={choiceId}
                value={branch}
                checked={selected}
                disabled={locked}
                onChange={() => onSelect(branch)}
              />
              <span className="peer-focus-visible:outline-crimson pointer-events-none absolute inset-0 outline-offset-2 peer-focus-visible:outline-2" />
              <span className="flex items-center justify-between gap-3">
                <span className="text-lg font-semibold">{route.name}</span>
                <span
                  className={`text-xs ${selected ? 'text-crimson' : 'text-ink-secondary'}`}
                >
                  {selected ? '已选此向' : '选择此向'}
                </span>
              </span>
              <span className="text-ink-secondary mt-2 block text-sm leading-7">
                {route.description}
              </span>
              <span className="mt-3 flex flex-wrap items-baseline justify-between gap-x-3 gap-y-1 text-sm">
                <span>{output.name}</span>
                <span className="text-ink-secondary text-xs">
                  每{' '}
                  <span className="font-mono">
                    {formatGardenDuration(output.cycleMs)}
                  </span>{' '}
                  <span className="font-mono">{output.quantity}</span> 份 ·{' '}
                  {plant.outputQuality}
                </span>
              </span>
            </label>
          );
        })}
      </fieldset>

      <div className="space-y-2 text-xs leading-6">
        <p className="text-crimson">每株只选一次，确定后无法更改。</p>
        <p className="text-ink-secondary">
          确定方向无需额外消耗。已积蓄的收成与当前生产进度都会保留。
        </p>
      </div>

      <div className="flex flex-wrap items-center justify-between gap-3">
        <InkButton variant="secondary" disabled={locked} onClick={onBack}>
          返回灵植
        </InkButton>
        <InkButton
          variant="primary"
          disabled={locked || !selectedBranch || !plant.canBranch}
          onClick={onConfirm}
        >
          {selectedBranch
            ? `确定${species.branches[selectedBranch].name}方向`
            : '先选择培养方向'}
        </InkButton>
      </div>
    </div>
  );
}
