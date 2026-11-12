import { InkButton } from '@app/components/ui';
import { REALM_ORDER } from '@daoyou/constants/realms';
import type { SpiritFieldSnapshot } from '@daoyou/contracts/spirit-field';
import { SPIRIT_GARDEN_MIN_REALM } from '@daoyou/game-content/spirit-field/config';
import type { SpiritGardenPlantView } from '@daoyou/game-domain/spirit-field';
import {
  formatGardenDuration,
  gardenSeedName,
  pendingPlantQuantity,
  stageLabel,
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
        <span className="font-mono">{days}</span> 天
        {hours % 24 > 0 ? (
          <>
            {' '}
            <span className="font-mono">{hours % 24}</span> 小时
          </>
        ) : null}
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
  const emptyPlots = snapshot.plots.filter(
    (plot) => !plot.plant && !plot.unknownPlant,
  ).length;
  const hasExhaustedPlot = snapshot.plots.some((plot) => plot.plant?.exhausted);
  const coverSpecies = snapshot.species[0];
  const pending = snapshot.collection.reduce(
    (sum, plant) => sum + pendingPlantQuantity(plant),
    0,
  );
  const pendingProducts = snapshot.collection.reduce(
    (sum, plant) =>
      sum +
      plant.pending.reduce((total, product) => total + product.quantity, 0),
    0,
  );
  const pendingSeeds = snapshot.collection.filter(
    (plant) => plant.pendingSeedSpeciesId,
  ).length;
  return (
    <section className="space-y-6" aria-label="灵植暂存">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div className="text-ink-secondary space-y-1 text-xs">
          <p>生长已暂停，移回灵田后继续。</p>
          <details>
            <summary className="focus-visible:outline-crimson min-h-11 w-fit cursor-pointer content-center focus-visible:outline-2 focus-visible:outline-offset-2">
              暂存说明
            </summary>
            <p className="max-w-sm pb-2 leading-6">
              暂存整株灵植可腾出田块。生长、生产、寿命、恢复和蜕变冷却计时均暂停，已有收成保留。
            </p>
          </details>
        </div>
        <p className="text-ink-secondary shrink-0 text-sm">
          <span className="text-ink font-mono text-2xl">
            {snapshot.collection.length}
          </span>
          <span className="mx-1">/</span>
          <span className="font-mono">
            {snapshot.profile.collectionLimit}
          </span>{' '}
          格
        </p>
      </div>
      {snapshot.collection.length > snapshot.profile.collectionLimit ? (
        <p className="text-crimson text-sm leading-6" role="status">
          暂存区容量已调整，已有灵植全部保留。请先移回或永久移除多余灵植，腾出空位后才能继续暂存。
        </p>
      ) : null}
      {pending > 0 ? (
        <div className="border-ink/15 flex flex-wrap items-center justify-between gap-3 border-y py-3 text-sm">
          <p>
            暂存灵植的待领收成：
            {pendingProducts > 0 ? (
              <>
                <span className="text-teal font-mono font-semibold">
                  {pendingProducts}
                </span>{' '}
                份产物
              </>
            ) : null}
            {pendingProducts > 0 && pendingSeeds > 0 ? '、' : null}
            {pendingSeeds > 0 ? (
              <>
                <span className="text-teal font-mono font-semibold">
                  {pendingSeeds}
                </span>{' '}
                枚灵种
              </>
            ) : null}
          </p>
          <InkButton variant="primary" disabled={locked} onClick={onHarvest}>
            领取全部收成
          </InkButton>
          <p className="text-ink-secondary w-full text-xs leading-5">
            同时领取灵田与暂存区中的产物和灵种。
          </p>
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
          <p className="text-base">暂无暂存的灵植</p>
          <p className="text-ink-secondary mt-2 max-w-64 text-sm leading-6">
            在灵植详情中选择「暂存灵植」，腾出田地后就能种下新的灵植。
          </p>
        </div>
      ) : (
        <>
          {emptyPlots === 0 ? (
            <p className="border-crimson/40 text-ink-secondary border-l-2 pl-3 text-sm leading-6">
              {hasExhaustedPlot
                ? '田地已满。领取已停止产出的灵植的收成后，可清理田块腾出空位。'
                : snapshot.collection.length >= snapshot.profile.collectionLimit
                  ? '田地与暂存区都已满。领取收成后，可永久移除暂存灵植，腾出空位后再暂存田中的灵植。'
                  : '田地已满。先暂存田中的一株灵植，再选择要移回的灵植。'}
            </p>
          ) : null}
          <ul className="divide-ink/10 divide-y">
            {snapshot.collection.map((plant) => {
              const species = snapshot.species.find(
                (entry) => entry.id === plant.speciesId,
              );
              const quantity = pendingPlantQuantity(plant);
              const productQuantity = plant.pending.reduce(
                (sum, product) => sum + product.quantity,
                0,
              );
              const minRealm = SPIRIT_GARDEN_MIN_REALM[plant.outputQuality];
              const realmInsufficient =
                REALM_ORDER[snapshot.player.realm] < REALM_ORDER[minRealm];
              const branchName =
                plant.branch && species
                  ? species.branches[plant.branch].name
                  : '未选培养方向';
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
                        {plant.outputQuality} · {stageLabel(plant)}
                      </span>
                    </div>
                    {plant.recoveryRemainingMs > 0 ? (
                      <p className="text-ink-secondary text-xs leading-6">
                        恢复还需约{' '}
                        <span className="font-mono">
                          {formatGardenDuration(plant.recoveryRemainingMs)}
                        </span>
                        ，移回后继续恢复。
                      </p>
                    ) : null}
                    <p className="text-sm">
                      {!plant.firstYieldGranted ? '成株后产出：' : ''}
                      {plant.output.name}
                      <span className="text-ink-secondary ml-2 text-xs">
                        {plant.branch ? branchName : '基础产出'}
                      </span>
                    </p>
                    {productQuantity > 0 ? (
                      <p className="text-teal text-sm">
                        <span className="font-mono">{productQuantity}</span>{' '}
                        份产物待领取
                      </p>
                    ) : null}
                    {plant.pendingSeedSpeciesId ? (
                      <p className="text-teal text-xs leading-6">
                        待领取：
                        {gardenSeedName(
                          plant.pendingSeedSpeciesId,
                          snapshot.species,
                        )}{' '}
                        <span className="font-mono">1</span> 枚
                      </p>
                    ) : null}
                    <div className="flex flex-wrap items-center justify-between gap-2 pt-1">
                      <InkButton
                        variant={plant.exhausted ? 'secondary' : 'primary'}
                        disabled={
                          locked ||
                          (plant.exhausted
                            ? quantity > 0
                            : emptyPlots === 0 || realmInsufficient)
                        }
                        onClick={() =>
                          plant.exhausted ? onRetire(plant) : onRestore(plant)
                        }
                      >
                        {plant.exhausted ? '永久移除灵植' : '移回灵田'}
                      </InkButton>
                      {!plant.exhausted ? (
                        <details className="text-ink-secondary text-sm">
                          <summary className="focus-visible:outline-crimson min-h-11 cursor-pointer content-center focus-visible:outline-2 focus-visible:outline-offset-2">
                            管理此株
                          </summary>
                          <div className="mt-2 space-y-2 text-right">
                            {quantity > 0 ? (
                              <p className="max-w-44 text-xs leading-5">
                                先领取全部产物和灵种，才能永久移除这株灵植。
                              </p>
                            ) : null}
                            <InkButton
                              disabled={locked || quantity > 0}
                              variant="secondary"
                              onClick={() => onRetire(plant)}
                            >
                              永久移除灵植
                            </InkButton>
                          </div>
                        </details>
                      ) : null}
                    </div>
                    {plant.exhausted ? (
                      <p className="text-ink-secondary text-xs leading-5">
                        {quantity > 0
                          ? '已停止产出。先领取收成，再移除灵植腾出空位。'
                          : '已停止产出，可移除灵植腾出空位。'}
                      </p>
                    ) : realmInsufficient ? (
                      <p className="text-ink-secondary text-xs leading-5">
                        移回需要达到{minRealm}。
                      </p>
                    ) : null}
                    <details className="text-ink-secondary text-xs">
                      <summary className="focus-visible:outline-crimson min-h-11 cursor-pointer content-center focus-visible:outline-2 focus-visible:outline-offset-2">
                        生长记录
                      </summary>
                      <div className="space-y-2 pb-2 leading-6">
                        <p>
                          在田生长 <GrowthAge value={plant.activeGrowthMs} />
                        </p>
                        {!plant.firstYieldGranted ? (
                          <p>幼苗尚未成株，生产寿命尚未开始。</p>
                        ) : null}
                        {plant.mutated ? (
                          <p className="text-teal">
                            产出速度 + <span className="font-mono">10%</span>
                          </p>
                        ) : null}
                        {plant.incidents.length > 0 ? (
                          <GardenIncidentHistory
                            plants={[plant]}
                            species={snapshot.species}
                          />
                        ) : null}
                      </div>
                    </details>
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
