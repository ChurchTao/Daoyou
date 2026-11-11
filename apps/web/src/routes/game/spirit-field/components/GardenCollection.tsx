import { InkButton } from '@app/components/ui';
import type { SpiritFieldSnapshot } from '@daoyou/contracts/spirit-field';
import type { SpiritGardenPlantView } from '@daoyou/game-domain/spirit-field';
import {
  formatGardenDuration,
  gardenSeedName,
  pendingPlantQuantity,
} from '../garden-presentation';
import { BotanicalArt } from './BotanicalArt';
import { GardenIncidentHistory } from './GardenIncidentHistory';

interface GardenCollectionProps {
  snapshot: SpiritFieldSnapshot;
  locked: boolean;
  onRestore: (plant: SpiritGardenPlantView) => void;
  onRetire: (plant: SpiritGardenPlantView) => void;
  onHarvest: () => void;
}

function GrowthAge({ value }: { value: number }) {
  const minutes = Math.floor(value / 60_000);
  const hours = Math.floor(minutes / 60);
  const days = Math.floor(hours / 24);
  if (days > 0)
    return (
      <>
        <span className="font-mono">{days}</span> 天{' '}
        <span className="font-mono">{hours % 24}</span> 小时
      </>
    );
  if (hours > 0)
    return (
      <>
        <span className="font-mono">{hours}</span> 小时
      </>
    );
  return (
    <>
      <span className="font-mono">{minutes}</span> 分钟
    </>
  );
}

export function GardenCollection({
  snapshot,
  locked,
  onRestore,
  onRetire,
  onHarvest,
}: GardenCollectionProps) {
  const emptyPlots = snapshot.plots.filter((plot) => !plot.plant).length;
  const hasExhaustedPlot = snapshot.plots.some((plot) => plot.plant?.exhausted);
  const coverSpecies = snapshot.species[0];
  const pending = snapshot.collection.reduce(
    (sum, plant) => sum + pendingPlantQuantity(plant),
    0,
  );
  return (
    <section className="space-y-6" aria-label="保种收藏">
      <div className="flex items-end justify-between gap-4">
        <p className="text-ink-secondary text-sm leading-6">
          暂歇一隅，留待来日。
          <br />
          收藏期间暂停成长、生产、寿命与冷却，培养成果都会保留。
        </p>
        <p className="text-ink-secondary shrink-0 text-sm">
          <span className="text-ink font-mono text-2xl">
            {snapshot.collection.length}
          </span>
          <span className="mx-1">/</span>
          <span className="font-mono">
            {snapshot.profile.collectionLimit}
          </span>{' '}
          株
        </p>
      </div>
      {pending > 0 ? (
        <div className="border-ink/15 flex flex-wrap items-center justify-between gap-3 border-y py-3 text-sm">
          <p>
            收藏中留有{' '}
            <span className="text-teal font-mono font-semibold">{pending}</span>{' '}
            份收成
          </p>
          <InkButton variant="primary" disabled={locked} onClick={onHarvest}>
            与田中产物一并收获
          </InkButton>
        </div>
      ) : null}
      {!snapshot.collection.length ? (
        <div className="flex min-h-72 flex-col items-center justify-center px-4 text-center">
          {coverSpecies ? (
            <BotanicalArt
              speciesId={coverSpecies.id}
              muted
              className="mb-3 w-24 opacity-35"
            />
          ) : null}
          <p className="text-base">保种阁尚空</p>
          <p className="text-ink-secondary mt-2 max-w-64 text-sm leading-6">
            将田中灵植移来歇养，便能腾出一畦，尝试新的草木。
          </p>
        </div>
      ) : (
        <>
          {emptyPlots === 0 ? (
            <p className="border-crimson/40 text-ink-secondary border-l-2 pl-3 text-sm leading-6">
              {hasExhaustedPlot
                ? '六畦均有灵植。领完采尽植株的收成后，可清畦腾位。'
                : snapshot.collection.length >= snapshot.profile.collectionLimit
                  ? '田地与保种阁都已满。领取收成后，可以结束一株收藏灵植的培育，为新草木腾位。'
                  : '六畦均有灵植。先将田中一株移入保种阁，再选择要迁回的灵植。'}
            </p>
          ) : null}
          <ul className="divide-ink/10 divide-y">
            {snapshot.collection.map((plant) => {
              const species = snapshot.species.find(
                (entry) => entry.id === plant.speciesId,
              );
              const quantity = pendingPlantQuantity(plant);
              const branchName =
                plant.branch && species
                  ? species.branches[plant.branch].name
                  : '尚未定向';
              return (
                <li
                  key={plant.id}
                  className="flex gap-3 py-5 first:pt-0 sm:gap-5"
                >
                  <BotanicalArt
                    speciesId={plant.speciesId}
                    stage={plant.stage}
                    className="w-20 shrink-0 self-start sm:w-24"
                  />
                  <div className="min-w-0 flex-1 space-y-2">
                    <div className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-1">
                      <h3 className="text-base font-semibold">
                        {plant.speciesName}
                      </h3>
                      <span className="text-ink-secondary text-xs">
                        {plant.outputQuality} ·{' '}
                        {plant.evolved ? '已蜕变' : branchName}
                      </span>
                    </div>
                    <p className="text-ink-secondary text-sm">
                      在田生长 <GrowthAge value={plant.activeGrowthMs} />
                    </p>
                    {!plant.firstYieldGranted ? (
                      <p className="text-ink-secondary text-xs">
                        幼苗尚未引灵成株，寿命尚未开始。
                      </p>
                    ) : null}
                    {plant.mutated ? (
                      <p className="text-teal text-xs">
                        异化 · 速生 <span className="font-mono">10%</span>
                      </p>
                    ) : null}
                    {plant.recoveryRemainingMs > 0 ? (
                      <p className="text-ink-secondary text-xs leading-6">
                        歇养尚余{' '}
                        <span className="font-mono">
                          {formatGardenDuration(plant.recoveryRemainingMs)}
                        </span>
                        ，迁回后继续恢复。
                      </p>
                    ) : null}
                    <p className="text-sm">
                      {!plant.firstYieldGranted ? '成株后产出：' : ''}
                      {plant.output.name}
                      <span className="text-ink-secondary ml-2 text-xs">
                        {plant.branch ? branchName : '基础产出'}
                      </span>
                    </p>
                    {quantity > 0 ? (
                      <p className="text-teal text-sm">
                        <span className="font-mono">{quantity}</span> 份待领取
                      </p>
                    ) : null}
                    {plant.pendingSeedSpeciesId ? (
                      <p className="text-teal text-xs leading-6">
                        含
                        {gardenSeedName(
                          plant.pendingSeedSpeciesId,
                          snapshot.species,
                        )}{' '}
                        <span className="font-mono">1</span> 枚
                      </p>
                    ) : null}
                    {plant.incidents.length > 0 ? (
                      <details className="text-xs">
                        <summary className="text-ink-secondary cursor-pointer leading-6">
                          灵植异事
                        </summary>
                        <div className="mt-2">
                          <GardenIncidentHistory
                            plants={[plant]}
                            species={snapshot.species}
                          />
                        </div>
                      </details>
                    ) : null}
                    <div className="flex flex-wrap items-center justify-between gap-2 pt-1">
                      <InkButton
                        variant="primary"
                        disabled={locked || emptyPlots === 0}
                        onClick={() => onRestore(plant)}
                      >
                        迁回灵圃
                      </InkButton>
                      <details className="text-ink-secondary text-sm">
                        <summary className="cursor-pointer py-1">
                          管理此株
                        </summary>
                        <div className="mt-2 space-y-2 text-right">
                          {quantity > 0 ? (
                            <p className="max-w-44 text-xs leading-5">
                              先领取全部产物，才能结束培育。
                            </p>
                          ) : null}
                          <InkButton
                            disabled={locked || quantity > 0}
                            variant="secondary"
                            onClick={() => onRetire(plant)}
                          >
                            结束培育
                          </InkButton>
                        </div>
                      </details>
                    </div>
                  </div>
                </li>
              );
            })}
          </ul>
        </>
      )}
    </section>
  );
}
