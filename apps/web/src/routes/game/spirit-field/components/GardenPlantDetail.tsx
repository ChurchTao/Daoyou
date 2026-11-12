import { InkButton } from '@app/components/ui';
import { GameIcon } from '@app/components/ui/GameIcon';
import { SpiritStones } from '@app/components/ui/SpiritStones';
import type {
  SpiritGardenPlantView,
  SpiritGardenSpecies,
} from '@daoyou/game-domain/spirit-field';
import {
  formatGardenDuration,
  gardenRecoveryPresentation,
  gardenSeedName,
  getPlantOpportunity,
  pendingPlantQuantity,
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
  if (minutes < 60) return `${minutes} 分钟`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours} 小时`;
  const days = Math.floor(hours / 24);
  return `${days} 天${hours % 24 ? ` ${hours % 24} 小时` : ''}`;
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
  const elapsed = Math.max(0, elapsedMs);
  const growth = plant.activeGrowthMs;
  const mature = plant.firstYieldGranted;
  const pendingQuantity = pendingPlantQuantity(plant);
  const pendingProducts = plant.pending.reduce(
    (sum, product) => sum + product.quantity,
    0,
  );
  const branch = plant.branch ? species.branches[plant.branch] : null;
  const recovery = gardenRecoveryPresentation(plant);
  const opportunity = getPlantOpportunity(plant);
  const canCultivate = plant.canMature || plant.canBranch || plant.canEvolve;
  const hasCurrentAction =
    canCultivate || pendingQuantity > 0 || plant.exhausted;
  const harvestIsPrimary =
    !canCultivate || plant.storageFull || plant.exhausted;
  const currentGuidance = plant.storageFull
    ? '待领收成已满，生长、生产与寿命计时暂停；领取后继续。'
    : !canCultivate &&
        (opportunity.kind === 'growing' || opportunity.kind === 'exhausted')
      ? opportunity.description
      : null;
  const harvestAction =
    pendingQuantity > 0 ? (
      <InkButton
        variant={harvestIsPrimary ? 'primary' : 'default'}
        disabled={locked}
        onClick={onHarvest}
      >
        领取全部收成
      </InkButton>
    ) : null;
  const currentState = plant.exhausted
    ? '停止产出'
    : plant.recoveryRemainingMs > 0
      ? plant.storageFull
        ? `${recovery.label} · 收成已满，恢复计时暂停`
        : recovery.label
      : plant.storageFull
        ? '收成已满 · 生产暂停'
        : plant.evolved
          ? '蜕变成功'
          : plant.canMature
            ? '可培育成株'
            : plant.canEvolve
              ? '可尝试蜕变'
              : plant.canBranch
                ? '可选择培养方向'
                : mature
                  ? '持续生产'
                  : '幼苗生长中';
  const milestones = [
    {
      title: '成株',
      done: mature,
      available: plant.canMature,
      waitingLabel: '生长中',
      detail: mature
        ? '已成株，首批收成已产生，并开始持续生产。'
        : plant.canMature
          ? '幼苗已长足，投入天地灵气即可成株并获得首批收成。'
          : `幼苗还需生长约 ${formatGardenDuration(plant.matureMs - growth)}，之后可投入天地灵气使其成株。成株前不消耗生产寿命。`,
    },
    {
      title: branch ? `培养方向 · ${branch.name}` : '选择培养方向',
      done: branch !== null,
      available: plant.canBranch,
      waitingLabel: '等待中',
      detail: branch
        ? branch.description
        : plant.canBranch
          ? '等待已完成，投入天地灵气即可选择今后的收成方向。每株只能选一次。'
          : plant.exhausted
            ? '这株灵植停止产出前未选择培养方向。'
            : !mature
              ? '先培育成株，再等待培养方向解锁。'
              : `还需在田生长约 ${formatGardenDuration(plant.branchRemainingMs)}，之后可投入天地灵气选择方向。收成已满或灵植处于暂存区时暂停计时。`,
    },
    {
      title: '蜕变',
      done: plant.evolved,
      available: plant.canEvolve,
      waitingLabel:
        plant.evolveSuccessChance === 0
          ? '已达上限'
          : plant.evolutionAttemptsRemaining === 0
            ? '次数已用完'
            : '未达条件',
      detail: plant.evolved
        ? `蜕变使之后的产物提升至${plant.outputQuality}。`
        : plant.canEvolve
          ? '已满足条件，可投入天地灵气、灵石与药材尝试蜕变。每次尝试都会消耗费用。'
          : (plant.evolveReason ??
            '选择培养方向后继续生长，达到所需境界后可尝试蜕变。'),
    },
  ];

  return (
    <div className="space-y-5 pb-2 sm:space-y-7">
      <div className="grid grid-cols-[5.5rem_minmax(0,1fr)] items-center gap-4 sm:grid-cols-[minmax(0,0.8fr)_minmax(0,1.2fr)]">
        <BotanicalArt
          speciesId={plant.speciesId}
          stage={plant.stage}
          className="mx-auto w-full max-w-44"
        />
        <div className="min-w-0 space-y-2">
          <p
            className={`inline-flex flex-wrap items-center gap-1 text-xs ${plant.exhausted || plant.recoveryRemainingMs > 0 ? 'text-ink-secondary' : plant.evolved ? 'text-teal' : plant.canMature || plant.canEvolve || plant.canBranch ? 'text-crimson' : 'text-ink-secondary'}`}
          >
            {plant.recoveryRemainingMs > 0 && recovery.icon ? (
              <GameIcon
                value={recovery.icon}
                className="garden-incident-mark"
              />
            ) : null}
            {currentState}
          </p>
          <h3 className="text-ink text-2xl leading-tight font-semibold">
            {plant.speciesName}
          </h3>
          <p className="text-ink-secondary text-sm">
            {plant.quality}原种 · {species.element}行灵植
          </p>
          {plant.evolved ? (
            <p className="text-teal text-xs">
              蜕变后产物为{plant.outputQuality}
            </p>
          ) : null}
          <p className="text-ink-secondary text-xs leading-6">
            在田生长 <span className="font-mono">{growthAge(growth)}</span>
          </p>
        </div>
      </div>

      <p className="text-ink-secondary text-sm leading-6 sm:leading-7">
        {species.description}
      </p>

      {currentGuidance || hasCurrentAction ? (
        <section aria-label="当前操作" className="space-y-2">
          {currentGuidance ? (
            <p className="text-ink-secondary text-xs leading-6">
              {currentGuidance}
            </p>
          ) : null}
          {hasCurrentAction ? (
            <div className="flex flex-wrap items-center gap-x-3 gap-y-2">
              {harvestIsPrimary ? harvestAction : null}
              {plant.exhausted && pendingQuantity === 0 ? (
                <InkButton
                  variant="primary"
                  disabled={locked}
                  onClick={onClear}
                >
                  清理后重新栽种
                </InkButton>
              ) : plant.canMature ? (
                <InkButton
                  variant="primary"
                  disabled={locked}
                  onClick={onMature}
                >
                  培育成株 ·{' '}
                  <span className="font-mono">{plant.matureQiCost}</span>{' '}
                  天地灵气
                </InkButton>
              ) : plant.canBranch ? (
                <InkButton
                  variant={plant.storageFull ? 'default' : 'primary'}
                  disabled={locked}
                  onClick={onBranch}
                >
                  选择培养方向
                </InkButton>
              ) : plant.canEvolve ? (
                <InkButton
                  variant={plant.storageFull ? 'default' : 'primary'}
                  disabled={locked}
                  onClick={onEvolve}
                >
                  准备蜕变
                </InkButton>
              ) : null}
              {!harvestIsPrimary ? harvestAction : null}
            </div>
          ) : null}
          {pendingQuantity > 0 ? (
            <p className="text-ink-secondary text-xs leading-6">
              同时领取在田与暂存区中的全部待领收成。
            </p>
          ) : null}
        </section>
      ) : null}

      {plant.recoveryRemainingMs > 0 || plant.mutated ? (
        <div
          className="border-ink/15 space-y-2 border-l-2 pl-3 text-xs leading-6"
          role="status"
        >
          {plant.recoveryRemainingMs > 0 ? (
            <p className="text-ink-secondary">
              恢复还需约{' '}
              <span className="text-ink font-mono">
                {formatGardenDuration(plant.recoveryRemainingMs)}
              </span>
              ，随后自行恢复。
              {plant.storageFull
                ? '领取待领收成后继续恢复计时。'
                : '期间暂停生产，寿命照常消耗，培养方向解锁与蜕变冷却继续计时，无需照料。'}
            </p>
          ) : null}
          {plant.mutated ? (
            <p className="text-teal">
              生长加速 · 此后的产出速度提高{' '}
              <span className="font-mono">10%</span>。
            </p>
          ) : null}
        </div>
      ) : null}

      <section aria-label="这株灵植的产出" className="space-y-3">
        <div className="flex flex-wrap items-baseline justify-between gap-2">
          <h3 className="font-semibold">
            {!mature ? '成株产物 · ' : null}
            {plant.output.name}
          </h3>
          {mature && !plant.exhausted ? (
            <p className="text-ink-secondary text-xs">
              {plant.mutated ? '基础周期每 ' : '每 '}
              <span className="font-mono">
                {formatGardenDuration(plant.output.cycleMs)}
              </span>{' '}
              <span className="font-mono">{plant.output.quantity}</span> 份
            </p>
          ) : null}
        </div>
        {mature ? (
          <dl className="grid grid-cols-2 gap-x-4 text-xs leading-6">
            <div>
              <dt className="text-ink-secondary">剩余生产寿命</dt>
              <dd className="font-mono">
                {plant.exhausted
                  ? '0 分钟'
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
          </dl>
        ) : null}
        {mature && !plant.exhausted && plant.output.cycleMs > 7 * 86_400_000 ? (
          <p className="text-ink-secondary text-xs leading-6">
            这株灵植产出较慢，可积蓄一个完整周期的收成，积满后暂停生产。
          </p>
        ) : null}
        {mature && !plant.exhausted && !plant.storageFull ? (
          <p className="text-ink-secondary text-xs leading-6">
            {plant.remainingHarvestCycles === 0
              ? '按当前培养方向，剩余寿命不足以完成下一轮生产。'
              : `距下次产出约 ${formatGardenDuration(Math.max(0, plant.nextYieldMs - elapsed))}${plant.recoveryRemainingMs > 0 ? '（含恢复时间）' : ''}。`}
          </p>
        ) : null}
        {pendingQuantity > 0 ? (
          <details className="border-ink/15 border-l-2 pl-3 text-sm">
            <summary className="text-teal cursor-pointer leading-7">
              待领收成
              {pendingProducts > 0 ? (
                <>
                  {' '}
                  · <span className="font-mono">{pendingProducts}</span> 份产物
                </>
              ) : null}
              {plant.pendingSeedSpeciesId ? (
                <>
                  {' '}
                  · <span className="font-mono">1</span> 枚灵种
                </>
              ) : null}
            </summary>
            <ul className="mt-2 space-y-1 text-xs leading-6">
              {plant.pending.map((product, index) => (
                <li
                  key={`${product.name}:${product.quality}:${index}`}
                  className="flex flex-wrap items-baseline justify-between gap-x-3"
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
                <li className="flex flex-wrap items-baseline justify-between gap-x-3">
                  <span>
                    {gardenSeedName(plant.pendingSeedSpeciesId, allSpecies)}
                  </span>
                  <span className="font-mono">1 枚</span>
                </li>
              ) : null}
            </ul>
          </details>
        ) : null}
      </section>

      <details className="text-sm">
        <summary className="text-ink-secondary cursor-pointer leading-7">
          生长历程与培养条件
        </summary>
        <div className="mt-4 space-y-5">
          <ol className="space-y-0">
            {milestones.map((milestone, index) => (
              <li
                key={milestone.title}
                className="relative grid grid-cols-[1rem_minmax(0,1fr)] gap-x-4 pb-5 last:pb-0"
              >
                {index < milestones.length - 1 ? (
                  <span
                    aria-hidden="true"
                    className="border-ink/15 absolute top-4 bottom-0 left-[7px] border-l"
                  />
                ) : null}
                <span
                  aria-hidden="true"
                  className={`relative mt-1.5 size-3.5 rounded-full border ${milestone.done ? 'border-teal bg-teal' : milestone.available ? 'border-crimson bg-crimson/10 ring-crimson/10 ring-4' : 'border-ink/25 bg-paper'}`}
                />
                <div className="min-w-0 space-y-1">
                  <div className="flex items-baseline justify-between gap-3">
                    <p className="text-sm font-semibold">{milestone.title}</p>
                    <span
                      className={`text-xs ${milestone.done ? 'text-teal' : milestone.available ? 'text-crimson' : 'text-ink-secondary'}`}
                    >
                      {milestone.done
                        ? '已完成'
                        : milestone.available
                          ? '可培养'
                          : plant.exhausted
                            ? '已结束'
                            : milestone.waitingLabel}
                    </span>
                  </div>
                  <p className="text-ink-secondary text-xs leading-6">
                    {milestone.detail}
                  </p>
                </div>
              </li>
            ))}
          </ol>
          {!plant.evolved &&
          mature &&
          plant.branch &&
          plant.evolveSuccessChance > 0 ? (
            <section
              aria-label="蜕变机会"
              className="space-y-2 text-xs leading-6"
            >
              <div className="flex flex-wrap gap-x-5 gap-y-1">
                <p>
                  每次蜕变成功率{' '}
                  <span className="font-mono">
                    {Math.round(plant.evolveSuccessChance * 100)}%
                  </span>
                </p>
                <p>
                  剩余尝试{' '}
                  <span className="font-mono">
                    {plant.evolutionAttemptsRemaining}
                  </span>{' '}
                  次
                </p>
              </div>
              {plant.evolutionAttemptsRemaining === 0 ? (
                <p className="text-ink-secondary">
                  蜕变次数已用完，仍会按现有方向继续生产。
                </p>
              ) : plant.evolveCooldownRemainingMs > 0 ? (
                <p className="text-ink-secondary">
                  蜕变冷却中，再在田生长约{' '}
                  <span className="font-mono">
                    {formatGardenDuration(plant.evolveCooldownRemainingMs)}
                  </span>{' '}
                  后冷却结束。冷却不影响生产，收成已满或灵植处于暂存区时暂停计时。
                </p>
              ) : plant.evolveRemainingMs > 0 ? (
                <p className="text-ink-secondary">
                  还需在田生长约{' '}
                  <span className="font-mono">
                    {formatGardenDuration(plant.evolveRemainingMs)}
                  </span>
                  ，达到所需境界后可尝试蜕变。收成已满或灵植处于暂存区时暂停计时。
                </p>
              ) : null}
            </section>
          ) : null}

          {!plant.exhausted &&
          !plant.evolved &&
          !plant.canEvolve &&
          plant.evolveSuccessChance > 0 ? (
            <section
              aria-label="蜕变条件"
              className="space-y-2 text-xs leading-6"
            >
              <h3 className="text-ink font-semibold">蜕变条件</h3>
              <p>
                确定培养方向后，再在田生长{' '}
                <span className="font-mono">
                  {formatGardenDuration(plant.evolveMs)}
                </span>
                ，且达到{plant.evolveCost.minRealm}
                及以上境界。收成已满或灵植处于暂存区时暂停计时。
              </p>
              <p>
                每次尝试消耗{' '}
                <span className="font-mono">{plant.evolveCost.qi}</span>{' '}
                天地灵气、{' '}
                <SpiritStones amount={plant.evolveCost.spiritStones} /> 与{' '}
                <span className="font-mono">{plant.evolveCost.quantity}</span>{' '}
                份{plant.evolveCost.materialQuality}及以上药材。
              </p>
              <p>
                成功后只提升之后产物的品质，不延长寿命；已积蓄的收成保持原品质。
              </p>
              <p>
                失败也会消耗全部费用，保留当前形态与产物，冷却结束后可再试；每株最多尝试{' '}
                <span className="font-mono">3</span> 次。
              </p>
            </section>
          ) : null}
        </div>
      </details>

      {plant.incidents.length > 0 ? (
        <details className="text-sm">
          <summary className="text-ink-secondary cursor-pointer leading-7">
            灵植异事 ·{' '}
            <span className="font-mono">{plant.incidents.length}</span> 次
          </summary>
          <div className="mt-3">
            <GardenIncidentHistory plants={[plant]} species={allSpecies} />
          </div>
        </details>
      ) : null}

      <details className="text-sm">
        <summary className="text-ink-secondary cursor-pointer">
          灵兽留下种子的规则
        </summary>
        <p className="text-ink-secondary mt-3 text-xs leading-6">
          灵兽偷吃后有 <span className="font-mono">10%</span> 概率遗落灵种，
          凡品至神品的8个品质等概率，每株一生最多获得{' '}
          <span className="font-mono">1</span> 枚。
        </p>
      </details>

      {!plant.exhausted ? (
        <details className="border-ink/10 border-t pt-4 text-sm">
          <summary className="text-ink-secondary cursor-pointer leading-7">
            管理此株
          </summary>
          <div className="mt-3 space-y-2">
            <p className="text-ink-secondary text-xs leading-6">
              暂存整株灵植可腾出田块，暂停生长、生产、寿命、恢复和蜕变冷却计时，已有收成和培养进度保留。
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
  );
}
