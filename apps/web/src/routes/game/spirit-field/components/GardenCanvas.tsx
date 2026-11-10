import { InkButton } from '@app/components/ui';
import { cn } from '@app/lib/cn';
import type { SpiritFieldSnapshot } from '@daoyou/contracts/spirit-field';
import type { SpiritGardenPlantView } from '@daoyou/game-domain/spirit-field';
import {
  formatGardenDuration,
  getPlantOpportunity,
  pendingPlantQuantity,
  stageLabel,
} from '../garden-presentation';
import '../garden.css';
import { BotanicalArt } from './BotanicalArt';

export interface GardenCanvasProps {
  snapshot: SpiritFieldSnapshot;
  selectedIndex: number | null;
  locked: boolean;
  restorePlant: SpiritGardenPlantView | null;
  onSelectPlot(index: number): void;
  onHarvest(): void;
  onOpenCollection(): void;
  onOpenCodex(): void;
  onStarter(): void;
  onCancelRestore(): void;
}

export function GardenCanvas({
  snapshot,
  selectedIndex,
  locked,
  restorePlant,
  onSelectPlot,
  onHarvest,
  onOpenCollection,
  onOpenCodex,
  onStarter,
  onCancelRestore,
}: GardenCanvasProps) {
  const occupied = snapshot.plots.filter((plot) => plot.plant);
  const selected =
    selectedIndex === null ? null : snapshot.plots[selectedIndex];
  const notedPlot = selected?.plant
    ? selected
    : (occupied.find(
        (plot) => plot.plant?.canBranch || plot.plant?.canEvolve,
      ) ?? occupied[0]);
  const notedPlant = notedPlot?.plant;
  const opportunity = notedPlant ? getPlantOpportunity(notedPlant) : null;
  const nextExchange = snapshot.exchanges
    .filter((entry) => !entry.unlocked)
    .sort((a, b) => a.requiredMatured - b.requiredMatured)[0];
  const nextSpecies = snapshot.species.find(
    (entry) => entry.id === nextExchange?.speciesId,
  );
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
                  {snapshot.pendingQuantity}
                </strong>
                <span>份收成，静待采收</span>
              </>
            ) : (
              <span className="garden-no-yield">
                {allEmpty
                  ? newGarden
                    ? '一座灵圃，从一枚灵种开始'
                    : '空畦静候新的长养'
                  : '灵植正在静静生长'}
              </span>
            )}
          </p>
        </div>
        <div className="garden-toolbar-actions">
          <InkButton
            variant="primary"
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
              保种阁{' '}
              <span className="font-mono">{snapshot.collection.length}</span>
            </InkButton>
            <InkButton
              variant="secondary"
              disabled={locked}
              onClick={onOpenCodex}
            >
              百草志{' '}
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
            选一块空畦，继续长养。
          </p>
          <InkButton
            variant="secondary"
            onClick={onCancelRestore}
            disabled={locked}
          >
            取消迁回
          </InkButton>
        </div>
      ) : null}

      <div className="garden-layout">
        <section className="garden-ground" aria-label="田中灵植">
          <div className="garden-ground-heading">
            <span>田中灵植</span>
            <span>
              <span className="font-mono">{occupied.length}</span> 株长养
              <span aria-hidden="true" className="garden-heading-dot">
                ·
              </span>
              <span className="font-mono">{snapshot.plots.length}</span> 畦灵田
            </span>
          </div>
          {allEmpty && !restorePlant ? (
            <div className="garden-first-plant">
              <p>
                {snapshot.collection.length > 0
                  ? '田中尚空。可以迁回保种阁里的灵植，或另栽新种。'
                  : snapshot.profile.starterClaimed
                    ? newGarden
                      ? '灵种入土，日久自有灵华。点选一块空畦，种下第一株。'
                      : '点选一块空畦，继续养成新的草木。'
                    : '先领下三种灵种，再为它们选一处安身之地。'}
              </p>
              {!snapshot.profile.starterClaimed ? (
                <InkButton
                  variant="primary"
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
              const actionReady = Boolean(plant?.canBranch || plant?.canEvolve);
              const availableRestore = Boolean(restorePlant && !plant);
              const action = plant?.canBranch
                ? '可定向'
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
                  aria-label={`第 ${plot.index + 1} 畦，${plant ? `${plant.speciesName}，${stageLabel(plant.stage)}${quantity ? `，${quantity} 份待收` : ''}${action ? `，${action}` : ''}` : availableRestore ? '迁回此畦' : '空田，栽种灵植'}`}
                >
                  <span className="garden-plot-number">
                    第 <span className="font-mono">{plot.index + 1}</span> 畦
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
                            quantity > 0 && 'garden-plant-status--yield',
                          )}
                        >
                          {plant.storageFull ? (
                            <>
                              <span className="font-mono">{quantity}</span> 份 ·
                              积蓄已满
                            </>
                          ) : quantity ? (
                            <>
                              {stageLabel(plant.stage)} ·{' '}
                              <span className="font-mono">{quantity}</span>{' '}
                              份待收
                            </>
                          ) : (
                            stageLabel(plant.stage)
                          )}
                        </span>
                      </span>
                    </>
                  ) : (
                    <span className="garden-empty-content">
                      <span className="garden-empty-plus" aria-hidden="true">
                        ＋
                      </span>
                      <span>{availableRestore ? '迁回此畦' : '种下一株'}</span>
                    </span>
                  )}
                </button>
              );
            })}
          </div>
          <p className="garden-ground-footer">
            采收不伤根本，灵植与洞府一同长养。
            <span>
              产物可积蓄{' '}
              <span className="font-mono">
                {Math.round(snapshot.profile.offlineCapMs / 86_400_000)}
              </span>{' '}
              天
            </span>
          </p>
        </section>

        <aside className="garden-notebook" aria-label="灵圃手记">
          <p className="garden-eyebrow">灵圃手记</p>
          {notedPlant && notedPlot && opportunity ? (
            <>
              <div className="garden-notebook-current">
                <span className="garden-notebook-plot">
                  第 <span className="font-mono">{notedPlot.index + 1}</span> 畦
                </span>
                <h2>{notedPlant.speciesName}</h2>
                <p>
                  {notedPlant.outputQuality} · {stageLabel(notedPlant.stage)}
                </p>
              </div>
              <div className="garden-notebook-opportunity">
                <span
                  className={cn(
                    'garden-note-status',
                    (opportunity.kind === 'branch' ||
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
                  opportunity.kind === 'branch' || opportunity.kind === 'evolve'
                    ? 'primary'
                    : 'default'
                }
                className="garden-note-action"
                disabled={locked || Boolean(restorePlant)}
                onClick={() => onSelectPlot(notedPlot.index)}
              >
                {opportunity.actionLabel}
              </InkButton>
              <div className="garden-notebook-output">
                <span>日常产出</span>
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
            </>
          ) : (
            <div className="garden-notebook-empty">
              <h2>留一方小天地</h2>
              <p>灵植会自行生长。往后的枝叶、花果与蜕变，由你慢慢养成。</p>
            </div>
          )}
          <div className="garden-codex-goal">
            <span>百草研习</span>
            <p>
              {nextExchange && nextSpecies ? (
                <>
                  再养成{' '}
                  <span className="font-mono">
                    {Math.max(
                      0,
                      nextExchange.requiredMatured -
                        snapshot.profile.maturedSpeciesCount,
                    )}
                  </span>{' '}
                  种，开放{nextSpecies.name}灵种
                </>
              ) : (
                '已开放全部灵种，继续记录不同培养方向。'
              )}
            </p>
            <InkButton
              variant="secondary"
              disabled={locked}
              onClick={onOpenCodex}
            >
              查看百草志
            </InkButton>
          </div>
        </aside>
      </div>
    </div>
  );
}
