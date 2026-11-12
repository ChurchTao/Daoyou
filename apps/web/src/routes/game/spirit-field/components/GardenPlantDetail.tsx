import { InkButton } from '@app/components/ui';
import { GameIcon } from '@app/components/ui/GameIcon';
import type {
  SpiritGardenPlantView,
  SpiritGardenSpecies,
} from '@daoyou/game-domain/spirit-field';
import {
  formatGardenDuration,
  gardenRecoveryPresentation,
  gardenSeedName,
  pendingPlantQuantity,
  stageLabel,
} from '../garden-presentation';
import { BotanicalArt } from './BotanicalArt';
import { GardenIncidentHistory } from './GardenIncidentHistory';

interface GardenPlantDetailProps {
  plant: SpiritGardenPlantView;
  species: SpiritGardenSpecies;
  allSpecies: SpiritGardenSpecies[];
  elapsedMs: number;
  locked: boolean;
  onMature(): void;
  onBranch(): void;
  onEvolve(): void;
  onArchive(): void;
  onHarvest(): void;
  onClear(): void;
}

function growthAge(ms: number) {
  const minutes = Math.max(0, Math.floor(ms / 60_000));
  if (minutes < 1) return '不足 1 分钟';
  if (minutes < 60) return `${minutes} 分钟`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours} 小时`;
  return `${Math.floor(hours / 24)} 天${hours % 24 ? ` ${hours % 24} 小时` : ''}`;
}

export function GardenPlantDetail({
  plant,
  species,
  allSpecies,
  elapsedMs,
  locked,
  onMature,
  onBranch,
  onEvolve,
  onArchive,
  onHarvest,
  onClear,
}: GardenPlantDetailProps) {
  const mature = plant.firstYieldGranted;
  const pendingQuantity = pendingPlantQuantity(plant);
  const pendingProducts = plant.pending.reduce(
    (sum, product) => sum + product.quantity,
    0,
  );
  const branch = plant.branch ? species.branches[plant.branch] : null;
  const recovery = gardenRecoveryPresentation(plant);
  const harvestFirst = plant.storageFull || plant.exhausted;
  const canCultivate = plant.canMature || plant.canBranch || plant.canEvolve;
  // Only the next reachable cultivation step belongs in the current task area.
  const nextStep = plant.exhausted
    ? null
    : !mature
      ? {
          title: plant.canMature ? '幼苗已长足' : '幼苗生长中',
          remaining: plant.canMature
            ? 0
            : Math.max(0, plant.matureMs - plant.activeGrowthMs),
          duration: plant.matureMs,
          description: plant.canMature
            ? '培育成株，开始收取产物。'
            : '长足后可培育成株。',
        }
      : !plant.branch
        ? {
            title: plant.canBranch ? '可选择培养方向' : '正在解锁培养方向',
            remaining: plant.branchRemainingMs,
            duration: plant.branchMs,
            description: plant.canBranch
              ? '决定今后的产物，每株只选一次。'
              : '期间照常生产。',
          }
        : !plant.evolved &&
            plant.evolveSuccessChance > 0 &&
            plant.evolutionAttemptsRemaining > 0
          ? {
              title: plant.canEvolve
                ? '可尝试蜕变'
                : plant.evolveCooldownRemainingMs > 0
                  ? '蜕变冷却中'
                  : '正在蕴养',
              remaining: Math.max(
                plant.evolveRemainingMs,
                plant.evolveCooldownRemainingMs,
              ),
              duration:
                plant.evolveCooldownRemainingMs > 0 ? 0 : plant.evolveMs,
              description: plant.canEvolve
                ? '有机会提升之后产物的品质。'
                : (plant.evolveReason ?? '期间照常生产。'),
            }
          : null;
  const stages = [
    { label: '成株', done: mature },
    { label: branch?.name ?? '定向', done: branch !== null },
    ...(plant.evolveSuccessChance > 0 || plant.evolved
      ? [
          {
            label:
              !plant.evolved && plant.evolutionAttemptsRemaining === 0
                ? '蜕变机会用尽'
                : '蜕变',
            done: plant.evolved,
          },
        ]
      : []),
  ];
  const currentStage = nextStep ? stages.findIndex((stage) => !stage.done) : -1;

  return (
    <div className="space-y-5 pb-2">
      <div className="flex items-center gap-4">
        <BotanicalArt
          speciesId={plant.speciesId}
          stage={plant.stage}
          className="w-20 shrink-0 sm:w-28"
        />
        <div className="min-w-0 space-y-1.5">
          <p className="text-ink-secondary text-xs">
            {plant.quality}原种 · {species.element}行 · {stageLabel(plant)}
          </p>
          <h3 className="text-ink text-2xl leading-tight font-semibold">
            {plant.speciesName}
          </h3>
          {plant.evolved ? (
            <p className="text-teal text-xs">
              产物已提升至{plant.outputQuality}
            </p>
          ) : null}
        </div>
      </div>

      <ol aria-label="培养进程" className="flex items-start text-xs">
        {stages.map((stage, index) => (
          <li
            key={index}
            aria-current={
              index === currentStage && !plant.exhausted ? 'step' : undefined
            }
            className={`flex flex-1 items-center gap-2 ${stage.done ? 'text-teal' : index === currentStage && !plant.exhausted ? 'text-crimson' : 'text-ink-secondary'}`}
          >
            <span
              aria-hidden="true"
              className={`size-2 shrink-0 rounded-full border ${stage.done ? 'border-teal bg-teal' : index === currentStage && !plant.exhausted ? 'border-crimson' : 'border-ink/20'}`}
            />
            <span>
              {stage.label}
              <span className="sr-only">
                {stage.done ? '，已完成' : '，未完成'}
              </span>
            </span>
            {index < stages.length - 1 ? (
              <span
                aria-hidden="true"
                className="border-ink/15 mr-2 min-w-2 flex-1 border-t"
              />
            ) : null}
          </li>
        ))}
      </ol>

      {nextStep ||
      plant.exhausted ||
      plant.storageFull ||
      plant.recoveryRemainingMs > 0 ||
      pendingQuantity > 0 ? (
        <section
          aria-label="当前操作"
          className="border-ink/15 space-y-3 border-y py-4"
        >
          {plant.exhausted ? (
            <p className="text-ink-secondary text-sm">
              {pendingQuantity > 0
                ? '已停止产出，领取余下收成后可重新栽种。'
                : '收成已领完，可清理田块重新栽种。'}
            </p>
          ) : plant.storageFull ? (
            <p className="text-ink text-sm">
              收成已满
              <span className="text-ink-secondary ml-2 text-xs">
                领取后继续生长与生产
              </span>
            </p>
          ) : null}
          {plant.recoveryRemainingMs > 0 && !plant.exhausted ? (
            <div role="status" className="text-ink-secondary text-xs leading-6">
              <p className="flex flex-wrap items-center gap-x-2">
                {recovery.icon ? (
                  <GameIcon
                    value={recovery.icon}
                    className="garden-incident-mark"
                  />
                ) : null}
                <span>
                  {recovery.label} ·{' '}
                  {formatGardenDuration(plant.recoveryRemainingMs)}
                </span>
              </p>
              <p>
                {plant.storageFull
                  ? '收成已满，恢复计时暂停。'
                  : '暂时停产，之后自行恢复，无需照料。'}
              </p>
            </div>
          ) : null}
          {nextStep && !harvestFirst ? (
            <div className="space-y-2">
              <div className="flex flex-wrap items-baseline justify-between gap-2">
                <h4
                  className={`text-sm font-semibold ${canCultivate ? 'text-crimson' : 'text-ink'}`}
                >
                  {nextStep.title}
                </h4>
                {nextStep.remaining > 0 ? (
                  <span className="text-ink-secondary font-mono text-xs">
                    还需 {formatGardenDuration(nextStep.remaining)}
                  </span>
                ) : null}
              </div>
              {nextStep.duration > 0 && nextStep.remaining > 0 ? (
                <div
                  role="progressbar"
                  aria-label={nextStep.title}
                  aria-valuemin={0}
                  aria-valuemax={nextStep.duration}
                  aria-valuenow={Math.max(
                    0,
                    nextStep.duration - nextStep.remaining,
                  )}
                  className="bg-ink/10 h-1 w-full overflow-hidden"
                >
                  <div
                    className="bg-crimson/60 h-full"
                    style={{
                      width: `${Math.max(0, Math.min(100, (1 - nextStep.remaining / nextStep.duration) * 100))}%`,
                    }}
                  />
                </div>
              ) : null}
              <p className="text-ink-secondary text-xs leading-6">
                {plant.recoveryRemainingMs > 0 && mature
                  ? '恢复期间，培养计时继续。'
                  : nextStep.remaining > 0 && plant.branch
                    ? plant.evolveCooldownRemainingMs > 0
                      ? '冷却期间照常生产。'
                      : `达到${plant.evolveCost.minRealm}境界后可尝试蜕变；期间照常生产。`
                    : nextStep.description}
              </p>
            </div>
          ) : null}
          <div className="flex flex-wrap items-center gap-x-3 gap-y-2">
            {pendingQuantity > 0 ? (
              <InkButton
                variant={harvestFirst || !canCultivate ? 'primary' : 'default'}
                disabled={locked}
                onClick={onHarvest}
              >
                一键收获
              </InkButton>
            ) : null}
            {plant.exhausted && pendingQuantity === 0 ? (
              <InkButton variant="primary" disabled={locked} onClick={onClear}>
                清理后重新栽种
              </InkButton>
            ) : plant.canMature ? (
              <InkButton
                variant={harvestFirst ? 'default' : 'primary'}
                disabled={locked}
                onClick={onMature}
              >
                培育成株
              </InkButton>
            ) : plant.canBranch ? (
              <InkButton
                variant={harvestFirst ? 'default' : 'primary'}
                disabled={locked}
                onClick={onBranch}
              >
                选择培养方向
              </InkButton>
            ) : plant.canEvolve ? (
              <InkButton
                variant={harvestFirst ? 'default' : 'primary'}
                disabled={locked}
                onClick={onEvolve}
              >
                准备蜕变
              </InkButton>
            ) : null}
            {plant.canMature ? (
              <span className="text-ink-secondary text-xs">
                <span className="font-mono">{plant.matureQiCost}</span> 天地灵气
              </span>
            ) : null}
          </div>
        </section>
      ) : null}

      <section aria-label="这株灵植的产出" className="space-y-2">
        <p className="text-ink-secondary text-xs">
          {!mature ? '成株后产出' : '当前产出'}
        </p>
        <div className="flex flex-wrap items-baseline justify-between gap-2">
          <h4 className="font-semibold">{plant.output.name}</h4>
          {!plant.exhausted ? (
            <p className="text-ink-secondary text-xs">
              {plant.mutated ? '基础周期 ' : ''}
              <span className="font-mono">
                {formatGardenDuration(plant.output.cycleMs)}
              </span>{' '}
              / <span className="font-mono">{plant.output.quantity}</span> 份
            </p>
          ) : null}
        </div>
        {plant.mutated ? (
          <p className="text-teal text-xs">
            产出速度 +<span className="font-mono">10%</span>
          </p>
        ) : null}
        {mature && !plant.exhausted && !plant.storageFull ? (
          <p className="text-ink-secondary text-xs leading-6">
            {plant.remainingHarvestCycles === 0
              ? '剩余寿命不足以完成下一轮生产。'
              : `下次产出约 ${formatGardenDuration(Math.max(0, plant.nextYieldMs - Math.max(0, elapsedMs)))} 后${plant.recoveryRemainingMs > 0 ? '（含恢复时间）' : ''}`}
          </p>
        ) : null}
        {pendingQuantity > 0 ? (
          <details className="text-sm">
            <summary className="text-teal min-h-11 cursor-pointer py-3 text-xs">
              待领收成
              {pendingProducts > 0 ? (
                <>
                  {' '}
                  · <span className="font-mono">{pendingProducts}</span> 份产物
                </>
              ) : null}
              {plant.pendingSeedSpeciesId ? ' · 1 枚灵种' : null}
            </summary>
            <ul className="space-y-1 text-xs leading-6">
              {plant.pending.map((product, index) => (
                <li
                  key={`${product.name}:${product.quality}:${index}`}
                  className="flex flex-wrap justify-between gap-x-3"
                >
                  <span>
                    {product.name}
                    <span className="text-ink-secondary ml-2">
                      {product.quality}
                    </span>
                  </span>
                  <span className="font-mono">{product.quantity} 份</span>
                </li>
              ))}
              {plant.pendingSeedSpeciesId ? (
                <li className="flex flex-wrap justify-between gap-x-3">
                  <span>
                    {gardenSeedName(plant.pendingSeedSpeciesId, allSpecies)}
                  </span>
                  <span className="font-mono">1 枚</span>
                </li>
              ) : null}
            </ul>
            <p className="text-ink-secondary mt-2 text-xs leading-6">
              一键收获会同时领取在田与暂存区的全部收成。
            </p>
          </details>
        ) : null}
      </section>

      <div className="border-ink/10 border-t">
        <details className="text-sm">
          <summary className="text-ink-secondary min-h-11 cursor-pointer py-3">
            植株资料
          </summary>
          <div className="space-y-3 pb-3 text-xs leading-6">
            <p className="text-ink-secondary">{species.description}</p>
            <dl className="grid grid-cols-2 gap-3">
              <div>
                <dt className="text-ink-secondary">在田生长</dt>
                <dd className="font-mono">{growthAge(plant.activeGrowthMs)}</dd>
              </div>
              {mature ? (
                <>
                  <div>
                    <dt className="text-ink-secondary">剩余生产寿命</dt>
                    <dd className="font-mono">
                      {plant.exhausted
                        ? '已用尽'
                        : formatGardenDuration(plant.remainingProductionMs)}
                    </dd>
                  </div>
                  <div>
                    <dt className="text-ink-secondary">预计后续收成</dt>
                    <dd>
                      <span className="font-mono">
                        {plant.remainingHarvestCycles}
                      </span>{' '}
                      轮
                    </dd>
                  </div>
                </>
              ) : null}
            </dl>
            {branch ? (
              <p className="text-ink-secondary">
                {branch.name} · {branch.description}
              </p>
            ) : null}
            {!mature ? (
              <p className="text-ink-secondary">幼苗期间不消耗生产寿命。</p>
            ) : null}
            {plant.branch &&
            !plant.evolved &&
            plant.evolveSuccessChance > 0 &&
            plant.evolutionAttemptsRemaining === 0 ? (
              <p className="text-ink-secondary">
                蜕变次数已用完，继续按现有方向生产。
              </p>
            ) : null}
            <p className="text-ink-secondary">
              收成积满时暂停生长、生产与寿命计时。
              {plant.output.cycleMs > 7 * 86_400_000
                ? '这株产出较慢，可积蓄一个完整周期的收成。'
                : null}
            </p>
            {plant.recoveryRemainingMs > 0 ? (
              <p className="text-ink-secondary">
                恢复期间寿命照常消耗，培养与蜕变冷却继续计时。
              </p>
            ) : null}
          </div>
        </details>
        {plant.incidents.length > 0 ? (
          <details className="text-sm">
            <summary className="text-ink-secondary min-h-11 cursor-pointer py-3">
              灵植异事 ·{' '}
              <span className="font-mono">{plant.incidents.length}</span> 次
            </summary>
            <GardenIncidentHistory plants={[plant]} species={allSpecies} />
          </details>
        ) : null}
        {!plant.exhausted ? (
          <details className="text-sm">
            <summary className="text-ink-secondary min-h-11 cursor-pointer py-3">
              管理此株
            </summary>
            <div className="space-y-2 pb-3">
              <p className="text-ink-secondary text-xs leading-6">
                暂存可腾出田块，暂停全部计时，保留已有收成与培养进度。
              </p>
              <InkButton
                variant="secondary"
                disabled={locked}
                onClick={onArchive}
              >
                暂存灵植
              </InkButton>
            </div>
          </details>
        ) : null}
      </div>
    </div>
  );
}
