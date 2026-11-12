import { InkButton } from '@app/components/ui';
import { GameIcon } from '@app/components/ui/GameIcon';
import { cn } from '@app/lib/cn';
import type { SpiritFieldSnapshot } from '@daoyou/contracts/spirit-field';
import type { SpiritGardenPlantView } from '@daoyou/game-domain/spirit-field';
import {
  formatGardenDuration,
  gardenRecoveryPresentation,
  getPlantOpportunity,
  pendingPlantQuantity,
  stageLabel,
} from '../garden-presentation';
import '../garden.css';
import { BotanicalArt } from './BotanicalArt';
import { GardenIncidentReport } from './GardenIncidentReport';

export interface GardenCanvasProps {
  snapshot: SpiritFieldSnapshot;
  cultivatorId?: string;
  selectedIndex: number | null;
  locked: boolean;
  harvesting: boolean;
  claimingStarter: boolean;
  restorePlant: SpiritGardenPlantView | null;
  onSelectPlot(index: number, action?: 'mature' | 'branch' | 'evolve'): void;
  onHarvest(): void;
  onOpenCollection(): void;
  onOpenCodex(): void;
  onStarter(): void;
  onMatureBatch(): void;
  onBranchBatch(): void;
  onCancelRestore(): void;
}

export function GardenCanvas({
  snapshot,
  cultivatorId,
  selectedIndex,
  locked,
  harvesting,
  claimingStarter,
  restorePlant,
  onSelectPlot,
  onHarvest,
  onOpenCollection,
  onOpenCodex,
  onStarter,
  onMatureBatch,
  onBranchBatch,
  onCancelRestore,
}: GardenCanvasProps) {
  const occupied = snapshot.plots.filter((plot) => plot.plant);
  const plants = [
    ...snapshot.plots.flatMap((plot) => (plot.plant ? [plot.plant] : [])),
    ...snapshot.collection,
  ];
  const hasIncidents = plants.some((plant) => plant.incidents.length > 0);
  const pendingProducts = plants.reduce(
    (sum, plant) =>
      sum +
      plant.pending.reduce((total, product) => total + product.quantity, 0),
    0,
  );
  const pendingSeeds = plants.filter(
    (plant) => plant.pendingSeedSpeciesId,
  ).length;
  const matureReadyCount = snapshot.plots.filter(
    (plot) => plot.plant?.canMature,
  ).length;
  const branchReadyCount = snapshot.plots.filter(
    (plot) => plot.plant?.canBranch,
  ).length;
  const selected =
    selectedIndex === null ? null : snapshot.plots[selectedIndex];
  const exhaustedPlot = occupied.find((plot) => plot.plant?.exhausted);
  const notedPlot = selected?.plant
    ? selected
    : (occupied.find(
        (plot) =>
          plot.plant?.canMature ||
          plot.plant?.canBranch ||
          plot.plant?.canEvolve,
      ) ??
      exhaustedPlot ??
      occupied[0]);
  const notedPlant = notedPlot?.plant;
  const opportunity = notedPlant ? getPlantOpportunity(notedPlant) : null;
  const allEmpty = occupied.length === 0;
  const newGarden =
    allEmpty &&
    snapshot.collection.length === 0 &&
    snapshot.profile.maturedSpeciesCount === 0;

  return (
    <div className="spirit-garden">
      <div className="garden-toolbar">
        <div className="garden-yield-summary" aria-live="polite">
          <span className="garden-eyebrow">灵圃收成</span>
          <p>
            {snapshot.pendingQuantity > 0 ? (
              <>
                <strong className="font-mono">
                  {pendingProducts || pendingSeeds}
                </strong>
                <span>
                  {pendingProducts > 0 ? '份产物待领取' : '枚灵种待领取'}
                  {pendingProducts > 0 && pendingSeeds > 0 ? (
                    <>
                      ，另有 <span className="font-mono">{pendingSeeds}</span>{' '}
                      枚灵种
                    </>
                  ) : null}
                </span>
              </>
            ) : (
              <span className="garden-no-yield">
                {allEmpty
                  ? newGarden
                    ? '一座灵圃，从一枚灵种开始'
                    : '点选空田，种下新的灵植'
                  : exhaustedPlot
                    ? '停止产出的灵植可清理后重新栽种'
                    : '灵植正在生长'}
              </span>
            )}
          </p>
        </div>
        <div className="garden-toolbar-actions">
          <InkButton
            variant="primary"
            pending={harvesting}
            pendingLabel="正在收获……"
            disabled={locked || snapshot.pendingQuantity === 0}
            onClick={onHarvest}
          >
            一键收获
          </InkButton>
          <div className="garden-secondary-links">
            <InkButton
              variant="secondary"
              disabled={locked}
              onClick={onOpenCollection}
            >
              灵植暂存{' '}
              <span className="font-mono">{snapshot.collection.length}</span>
            </InkButton>
            <InkButton
              variant="secondary"
              disabled={locked}
              onClick={onOpenCodex}
            >
              灵植图鉴{' '}
              <span className="font-mono">
                {snapshot.profile.maturedSpeciesCount}
                <span>/{snapshot.species.length}</span>
              </span>
            </InkButton>
          </div>
        </div>
      </div>

      {restorePlant ? (
        <div className="garden-restore-note" role="status">
          <p>
            为<span className="font-semibold">{restorePlant.speciesName}</span>
            选一块空田，继续生长。
          </p>
          <InkButton
            variant="secondary"
            onClick={onCancelRestore}
            disabled={locked}
          >
            取消移回
          </InkButton>
        </div>
      ) : null}

      <div className="garden-layout">
        <section className="garden-ground" aria-label="田中灵植">
          <div className="garden-ground-heading">
            <span>田中灵植</span>
            <span>
              已种植 <span className="font-mono">{occupied.length}</span> 株
              <span aria-hidden="true" className="garden-heading-dot">
                ·
              </span>
              <span className="font-mono">{snapshot.plots.length}</span> 块田
            </span>
          </div>
          {allEmpty && !restorePlant ? (
            <div className="garden-first-plant">
              <p>
                {snapshot.collection.length > 0
                  ? '田中尚空。可以移回暂存区里的灵植，或另栽新种。'
                  : snapshot.profile.starterClaimed
                    ? newGarden
                      ? '已领到灵种。点选一块空田，种下第一株。'
                      : '点选一块空田，种下新的灵植。'
                    : '先领取三种初始灵种，再点选空田栽种。'}
              </p>
              {!snapshot.profile.starterClaimed ? (
                <InkButton
                  variant="primary"
                  pending={claimingStarter}
                  pendingLabel="正在领种……"
                  disabled={locked}
                  onClick={onStarter}
                >
                  领取初始灵种
                </InkButton>
              ) : null}
            </div>
          ) : null}
          <div className="garden-plots">
            {snapshot.plots.map((plot) => {
              const plant = plot.plant;
              const quantity = plant ? pendingPlantQuantity(plant) : 0;
              const productQuantity =
                plant?.pending.reduce(
                  (sum, product) => sum + product.quantity,
                  0,
                ) ?? 0;
              const pendingLabel = (
                <>
                  {productQuantity > 0 ? (
                    <>
                      <span className="font-mono">{productQuantity}</span>{' '}
                      份待领
                    </>
                  ) : null}
                  {productQuantity > 0 && plant?.pendingSeedSpeciesId
                    ? ' · '
                    : null}
                  {plant?.pendingSeedSpeciesId ? '灵种待领' : null}
                </>
              );
              const recovery = plant ? gardenRecoveryPresentation(plant) : null;
              const actionReady = Boolean(
                plant?.canMature || plant?.canBranch || plant?.canEvolve,
              );
              const availableRestore = Boolean(restorePlant && !plant);
              const action = plant?.canMature
                ? '可成株'
                : plant?.canBranch
                  ? '可选择方向'
                  : plant?.canEvolve
                    ? '可蜕变'
                    : null;
              return (
                <button
                  key={plot.index}
                  data-plot-index={plot.index}
                  type="button"
                  className={cn(
                    'garden-plot',
                    !plant && 'garden-plot--empty',
                    selectedIndex === plot.index && 'garden-plot--selected',
                    actionReady && 'garden-plot--opportunity',
                    availableRestore && 'garden-plot--restore',
                  )}
                  disabled={locked || Boolean(restorePlant && plant)}
                  onClick={() => onSelectPlot(plot.index)}
                  aria-haspopup={restorePlant ? undefined : 'dialog'}
                  aria-pressed={selectedIndex === plot.index}
                  aria-label={`${plot.index + 1}号田，${plant ? `${plant.speciesName}，${stageLabel(plant)}${productQuantity ? `，${productQuantity} 份产物待领取` : ''}${plant.pendingSeedSpeciesId ? '，1 枚灵种待领取' : ''}${plant.recoveryRemainingMs > 0 ? `，${recovery?.label}${plant.storageFull ? '，收成已满，恢复计时暂停' : `，约 ${formatGardenDuration(plant.recoveryRemainingMs)}`}` : ''}${plant.mutated ? '，产出速度提高10%' : ''}${action ? `，${action}` : ''}` : availableRestore ? `移回${plot.index + 1}号田` : '空田，栽种灵植'}`}
                >
                  <span className="garden-plot-number">
                    <span className="font-mono">{plot.index + 1}</span>号田
                  </span>
                  <span className="garden-soil" aria-hidden="true" />
                  {plant ? (
                    <>
                      <BotanicalArt
                        speciesId={plant.speciesId}
                        stage={plant.stage}
                        className="garden-plot-art"
                      />
                      {action ? (
                        <span className="garden-opportunity-mark">
                          {action}
                        </span>
                      ) : null}
                      <span className="garden-plot-caption">
                        <span className="garden-plant-name">
                          {plant.speciesName}
                        </span>
                        <span
                          className={cn(
                            'garden-plant-status',
                            quantity > 0 &&
                              plant.recoveryRemainingMs === 0 &&
                              'garden-plant-status--yield',
                          )}
                        >
                          {plant.recoveryRemainingMs > 0 ? (
                            <>
                              <span className="garden-recovery-status">
                                {recovery?.icon ? (
                                  <GameIcon
                                    value={recovery.icon}
                                    className="garden-incident-mark"
                                  />
                                ) : null}
                                {recovery?.label}
                              </span>
                              {quantity > 0 ? (
                                <>
                                  {' '}
                                  ·{' '}
                                  <span className="text-teal">
                                    {pendingLabel}
                                  </span>
                                </>
                              ) : null}
                            </>
                          ) : plant.storageFull && !plant.exhausted ? (
                            <>{pendingLabel} · 收成已满</>
                          ) : quantity ? (
                            <>
                              {stageLabel(plant)} · {pendingLabel}
                            </>
                          ) : (
                            stageLabel(plant)
                          )}
                        </span>
                        <span
                          className={cn(
                            'garden-plant-condition',
                            plant.mutated && 'garden-plant-condition--mutated',
                          )}
                        >
                          {plant.mutated ? (
                            <>
                              产出速度 +<span className="font-mono">10%</span>
                              {plant.recoveryRemainingMs > 0 &&
                              plant.storageFull ? (
                                <span className="text-ink-secondary">
                                  {' '}
                                  · 收成已满，恢复计时暂停
                                </span>
                              ) : null}
                            </>
                          ) : plant.recoveryRemainingMs > 0 ? (
                            plant.storageFull ? (
                              '收成已满 · 恢复计时暂停'
                            ) : (
                              <>
                                恢复约{' '}
                                <span className="font-mono">
                                  {formatGardenDuration(
                                    plant.recoveryRemainingMs,
                                  )}
                                </span>
                              </>
                            )
                          ) : null}
                        </span>
                      </span>
                    </>
                  ) : (
                    <span className="garden-empty-content">
                      <span className="garden-empty-plus" aria-hidden="true">
                        ＋
                      </span>
                      <span>
                        {availableRestore
                          ? `移回${plot.index + 1}号田`
                          : '种下一株'}
                      </span>
                    </span>
                  )}
                </button>
              );
            })}
          </div>
          <p className="garden-ground-footer">
            停止产出后，可清理田块并重新栽种。
            <span>
              最多暂存{' '}
              <span className="font-mono">
                {Math.round(snapshot.profile.offlineCapMs / 86_400_000)}
              </span>{' '}
              天的产出
            </span>
          </p>
          {matureReadyCount > 0 || branchReadyCount > 0 ? (
            <div className="mt-3 flex flex-wrap gap-x-3 gap-y-1">
              <InkButton
                variant="secondary"
                disabled={locked || matureReadyCount === 0}
                onClick={onMatureBatch}
              >
                批量培育成株 (
                <span className="font-mono">{matureReadyCount}</span>)
              </InkButton>
              <InkButton
                variant="secondary"
                disabled={locked || branchReadyCount === 0}
                onClick={onBranchBatch}
              >
                批量选择培养方向 (
                <span className="font-mono">{branchReadyCount}</span>)
              </InkButton>
            </div>
          ) : null}
        </section>

        <aside className="garden-notebook" aria-label="灵圃手记">
          <p className="garden-eyebrow">灵圃手记</p>
          {hasIncidents && cultivatorId ? (
            <GardenIncidentReport
              snapshot={snapshot}
              cultivatorId={cultivatorId}
              locked={locked || Boolean(restorePlant)}
              onSelectPlot={onSelectPlot}
              onOpenCollection={onOpenCollection}
            />
          ) : null}
          {notedPlant && notedPlot && opportunity ? (
            <>
              <div className="garden-notebook-current">
                <span className="garden-notebook-plot">
                  <span className="font-mono">{notedPlot.index + 1}</span>号田
                </span>
                <h2>{notedPlant.speciesName}</h2>
                <p>
                  {notedPlant.outputQuality} · {stageLabel(notedPlant)}
                </p>
                {notedPlant.mutated ? (
                  <span className="garden-notebook-mutation text-teal">
                    产出速度 + <span className="font-mono">10%</span>
                  </span>
                ) : null}
              </div>
              <div className="garden-notebook-opportunity">
                <span
                  className={cn(
                    'garden-note-status',
                    (opportunity.kind === 'mature' ||
                      opportunity.kind === 'branch' ||
                      opportunity.kind === 'evolve') &&
                      'garden-note-status--ready',
                  )}
                >
                  {opportunity.label}
                </span>
                <p>{opportunity.description}</p>
              </div>
              <InkButton
                variant={
                  opportunity.kind === 'mature' ||
                  opportunity.kind === 'branch' ||
                  opportunity.kind === 'evolve'
                    ? 'primary'
                    : 'default'
                }
                className="garden-note-action"
                disabled={locked || Boolean(restorePlant)}
                onClick={() =>
                  onSelectPlot(
                    notedPlot.index,
                    opportunity.kind === 'mature' ||
                      opportunity.kind === 'branch' ||
                      opportunity.kind === 'evolve'
                      ? opportunity.kind
                      : undefined,
                  )
                }
              >
                {opportunity.actionLabel}
              </InkButton>
              {opportunity.kind !== 'exhausted' &&
              notedPlant.firstYieldGranted ? (
                <div className="garden-notebook-output">
                  <span>
                    {notedPlant.mutated ? '日常产出 · 基础周期' : '日常产出'}
                  </span>
                  <p>{notedPlant.output.name}</p>
                  <small>
                    每{' '}
                    <span className="font-mono">
                      {formatGardenDuration(notedPlant.output.cycleMs)}
                    </span>{' '}
                    ·{' '}
                    <span className="font-mono">
                      {notedPlant.output.quantity}
                    </span>{' '}
                    份
                  </small>
                </div>
              ) : null}
            </>
          ) : (
            <div className="garden-notebook-empty">
              <h2>留一方小天地</h2>
              <p>
                点选空田栽种。幼苗长足后，投入天地灵气使其成株，便会开始生产；之后还可选择培养方向、尝试蜕变。
              </p>
            </div>
          )}
          <div className="garden-codex-goal">
            <span>百草研习</span>
            <p>
              记录 <span className="font-mono">{snapshot.species.length}</span>{' '}
              种草木与各自的培养路线。
            </p>
            <InkButton
              variant="secondary"
              disabled={locked}
              onClick={onOpenCodex}
            >
              查看灵植图鉴
            </InkButton>
          </div>
        </aside>
      </div>
    </div>
  );
}
