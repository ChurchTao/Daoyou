import { InkButton } from '@app/components/ui';
import type { RealmType } from '@daoyou/constants/realms';
import type {
  SpiritGardenBranch,
  SpiritGardenPlantView,
  SpiritGardenSpecies,
} from '@daoyou/game-domain/spirit-field';
import { getSpiritGardenBranchPreview } from '@daoyou/game-rules/spirit-field';
import { useId } from 'react';
import { formatGardenDuration } from '../garden-presentation';
import { BotanicalArt } from './BotanicalArt';

interface GardenBranchChoiceProps {
  plant: SpiritGardenPlantView;
  species: SpiritGardenSpecies;
  realm: RealmType;
  selectedBranch: SpiritGardenBranch | null;
  qi: number | undefined;
  currencyUnavailable: boolean;
  locked: boolean;
  onSelect(branch: SpiritGardenBranch): void;
  onConfirm(): void;
  onBack(): void;
}

export function GardenBranchChoice({
  plant,
  species,
  realm,
  selectedBranch,
  qi,
  currencyUnavailable,
  locked,
  onSelect,
  onConfirm,
  onBack,
}: GardenBranchChoiceProps) {
  const choiceId = useId();
  const choiceDisabled = locked || !plant.canBranch;
  return (
    <div className="space-y-5 pb-2">
      <div className="flex items-center gap-3 sm:gap-5">
        <BotanicalArt
          speciesId={plant.speciesId}
          stage={plant.stage}
          className="w-20 shrink-0 sm:w-28"
        />
        <div className="space-y-2">
          <p className="text-crimson text-xs">
            {plant.exhausted ? '已停止产出' : '可选择培养方向'}
          </p>
          <h3 className="text-xl font-semibold">{plant.speciesName}</h3>
        </div>
      </div>

      <fieldset className="space-y-3">
        <legend className="sr-only">培养方向</legend>
        {(['abundance', 'essence'] as const).map((branch) => {
          const route = species.branches[branch];
          const preview = getSpiritGardenBranchPreview(plant, branch, realm);
          const output = preview.output;
          const selected = selectedBranch === branch;
          return (
            <label
              key={branch}
              className={`relative block cursor-pointer border-l-2 px-4 py-4 transition-colors ${selected ? 'border-crimson bg-crimson/5' : 'border-ink/15 hover:bg-ink/4'} ${choiceDisabled ? 'pointer-events-none opacity-60' : ''}`}
            >
              <input
                className="peer sr-only"
                type="radio"
                name={choiceId}
                value={branch}
                checked={selected}
                disabled={choiceDisabled}
                onChange={() => onSelect(branch)}
              />
              <span className="peer-focus-visible:outline-crimson pointer-events-none absolute inset-0 outline-offset-2 peer-focus-visible:outline-2" />
              <span className="flex items-center justify-between gap-3">
                <span className="text-lg font-semibold">{route.name}</span>
                <span
                  className={`text-xs ${selected ? 'text-crimson' : 'text-ink-secondary'}`}
                >
                  {selected ? '已选择' : '选择'}
                </span>
              </span>
              <span className="mt-2 flex flex-wrap items-baseline justify-between gap-x-3 gap-y-1 text-sm">
                <span>{output.name}</span>
                <span className="text-ink-secondary text-xs">
                  {plant.mutated ? '基础周期每 ' : '每 '}
                  <span className="font-mono">
                    {formatGardenDuration(output.cycleMs)}
                  </span>{' '}
                  <span className="font-mono">{output.quantity}</span> 份 ·{' '}
                  {plant.outputQuality}
                </span>
              </span>
              <span className="text-ink-secondary mt-1 block text-xs leading-6">
                {route.description}
              </span>
              {selected ||
              preview.remainingHarvestCycles === 0 ||
              preview.storageFull ? (
                <span className="text-ink-secondary mt-2 block text-xs leading-6">
                  {preview.exhausted
                    ? '这株灵植已停止产出。'
                    : preview.remainingHarvestCycles === 0
                      ? '剩余寿命不足以完成下一轮产出。'
                      : preview.storageFull
                        ? '收成已满，领取后继续生产。'
                        : `选择后，距下次产出约 ${formatGardenDuration(preview.nextYieldMs)}${preview.recoveryRemainingMs > 0 ? '（含恢复时间）' : ''}。`}
                </span>
              ) : null}
            </label>
          );
        })}
      </fieldset>

      <div className="space-y-2 text-xs leading-6">
        <details className="text-ink-secondary">
          <summary className="min-h-11 cursor-pointer py-3">
            已有收成与生产进度
          </summary>
          <p className="mt-1">
            已有收成与剩余生产寿命保留。新周期更短时，保留当前完成比例；更长时，保留本轮已生产的时间。
          </p>
        </details>
        <p>
          本次消耗 <span className="font-mono">{plant.branchQiCost}</span>{' '}
          天地灵气；当前 <span className="font-mono">{qi ?? '—'}</span>。
        </p>
        {qi !== undefined && qi < plant.branchQiCost ? (
          <p className="text-crimson">当前天地灵气不足。</p>
        ) : null}
        {currencyUnavailable ? (
          <p className="text-ink-secondary">正在确认当前天地灵气，请稍候。</p>
        ) : null}
      </div>

      <p className="text-crimson text-xs">每株只选一次，确定后无法更改。</p>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <InkButton variant="secondary" disabled={locked} onClick={onBack}>
          返回灵植
        </InkButton>
        <InkButton
          variant="primary"
          disabled={
            choiceDisabled ||
            !selectedBranch ||
            currencyUnavailable ||
            qi === undefined ||
            qi < plant.branchQiCost
          }
          onClick={onConfirm}
        >
          {selectedBranch
            ? `确认选择「${species.branches[selectedBranch].name}」`
            : '先选择培养方向'}
        </InkButton>
      </div>
    </div>
  );
}
