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
  const branch = plant.branch ? species.branches[plant.branch] : null;
  const recovery = gardenRecoveryPresentation(plant);
  const currentState = plant.exhausted
    ? '采尽'
    : plant.recoveryRemainingMs > 0
      ? plant.storageFull
        ? `${recovery.label} · 积蓄已满暂缓`
        : recovery.label
      : plant.evolved
        ? '蜕变已成'
        : plant.canMature
          ? '可引灵成株'
          : plant.canEvolve
            ? '可尝试蜕变'
            : plant.canBranch
              ? '可确定方向'
              : mature
                ? '静养生长'
                : '幼苗初生';
  const milestones = [
    {
      title: '成株',
      done: mature,
      available: plant.canMature,
      detail: mature
        ? '已引灵成株并形成首批待领收成，生产与寿命由此开始。'
        : plant.canMature
          ? '幼苗已养足根基，引入自身天地灵气后才会成株。'
          : `再在田长养约 ${formatGardenDuration(plant.matureMs - growth)}，便可引灵成株，等待期间寿命尚未开始。`,
    },
    {
      title: branch ? `蕴灵 · ${branch.name}` : '蕴灵定向',
      done: branch !== null,
      available: plant.canBranch,
      detail: branch
        ? branch.description
        : plant.canBranch
          ? '灵机已足，消耗天地灵气后可择定长期培养方向。'
          : plant.exhausted
            ? '这株灵植采尽时尚未定向。'
            : !mature
              ? '先引灵成株，再积累蕴灵根基。'
              : `再有效在田长养约 ${formatGardenDuration(plant.branchRemainingMs)}，便可引灵定向。`,
    },
    {
      title: '蜕变',
      done: plant.evolved,
      available: plant.canEvolve,
      detail: plant.evolved
        ? `蜕变使之后的产物提升至${plant.outputQuality}。`
        : plant.canEvolve
          ? '根基与境界条件已满足，可投入灵气和药材尝试蜕变。'
          : (plant.evolveReason ?? '继续积累生机，等待蜕变机缘。'),
    },
  ];

  return (
    <div className="space-y-7 pb-2">
      <div className="grid grid-cols-[minmax(0,0.8fr)_minmax(0,1.2fr)] items-center gap-4">
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
            {plant.outputQuality} · {species.element}行灵植
          </p>
          <p className="text-ink-secondary text-xs leading-6">
            在田生长 <span className="font-mono">{growthAge(growth)}</span>
          </p>
        </div>
      </div>

      <p className="text-ink-secondary text-sm leading-7">
        {species.description}
      </p>

      {plant.recoveryRemainingMs > 0 || plant.mutated ? (
        <div
          className="border-ink/15 space-y-2 border-l-2 pl-3 text-xs leading-6"
          role="status"
        >
          {plant.recoveryRemainingMs > 0 ? (
            <p className="text-ink-secondary">
              还需歇养约{' '}
              <span className="text-ink font-mono">
                {formatGardenDuration(plant.recoveryRemainingMs)}
              </span>
              ，随后自行恢复。
              {plant.storageFull
                ? '积蓄已满，寿命与歇养计时均已暂停；领取收成后继续恢复。'
                : '期间暂停生产，寿命照常消耗，蕴灵积累与蜕变冷却继续推进，无需照料。'}
            </p>
          ) : null}
          {plant.mutated ? (
            <p className="text-teal">
              异化速生 · 此后的生产速度提高{' '}
              <span className="font-mono">10%</span>。
            </p>
          ) : null}
        </div>
      ) : null}

      <section aria-label="这株灵植的产出" className="space-y-3">
        <div className="flex flex-wrap items-baseline justify-between gap-2">
          <h3 className="font-semibold">{plant.output.name}</h3>
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
        <dl className="grid grid-cols-2 gap-x-4 text-xs leading-6">
          <div>
            <dt className="text-ink-secondary">剩余生产寿命</dt>
            <dd className="font-mono">
              {!mature
                ? '成株后开始'
                : plant.exhausted
                  ? '0 分钟'
                  : formatGardenDuration(plant.remainingProductionMs)}
            </dd>
          </div>
          <div>
            <dt className="text-ink-secondary">预计还能收</dt>
            <dd>
              {mature ? (
                <>
                  <span className="font-mono">
                    {plant.remainingHarvestCycles}
                  </span>{' '}
                  轮
                </>
              ) : (
                '成株后查看'
              )}
            </dd>
          </div>
        </dl>
        {mature && !plant.exhausted && plant.output.cycleMs > 7 * 86_400_000 ? (
          <p className="text-ink-secondary text-xs leading-6">
            这株灵植产出较慢，可积蓄一个完整周期的收成，积满后暂停生产。
          </p>
        ) : null}
        <p className="text-ink-secondary text-xs leading-6">
          {plant.exhausted
            ? pendingQuantity > 0
              ? '领取最后一批收成后可清畦重种。'
              : '收成已领完，可以清畦重种。'
            : plant.recoveryRemainingMs > 0
              ? plant.storageFull
                ? '积蓄已满，歇养计时也已暂停。领取收成后继续恢复。'
                : '灵植正在自行恢复，下一次产出时间已计入歇养。'
              : plant.storageFull
                ? '待领收成已经积满，剩余生产时间暂停消耗。领取后恢复生产。'
                : !mature
                  ? '引灵成株后才会迎来首批收成，并开始周期生产与寿命计时。'
                  : plant.remainingHarvestCycles === 0
                    ? '按当前路线，剩余生产时间不足一轮。'
                    : `距下次产出约 ${formatGardenDuration(Math.max(0, plant.nextYieldMs - elapsed))}。`}
        </p>
        {pendingQuantity > 0 ? (
          <details className="border-ink/15 border-l-2 pl-3 text-sm">
            <summary className="text-teal cursor-pointer leading-7">
              已积蓄 <span className="font-mono">{pendingQuantity}</span> 份收成
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
            {!plant.exhausted ? (
              <p className="text-ink-secondary mt-2 text-xs leading-6">
                返回灵圃后可一键收好所有收成。
              </p>
            ) : null}
          </details>
        ) : null}
      </section>

      {!plant.evolved &&
      mature &&
      plant.branch &&
      plant.evolveSuccessChance > 0 ? (
        <section aria-label="蜕变机会" className="space-y-2 text-xs leading-6">
          <div className="flex flex-wrap gap-x-5 gap-y-1">
            <p>
              蜕变成功率{' '}
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
              蜕变机会已用尽，仍会按现有方向继续生产。
            </p>
          ) : plant.evolveCooldownRemainingMs > 0 ? (
            <p className="text-ink-secondary">
              蜕变余韵未散，再有效在田长养约{' '}
              <span className="font-mono">
                {formatGardenDuration(plant.evolveCooldownRemainingMs)}
              </span>{' '}
              后可重试；期间照常生产。
            </p>
          ) : plant.evolveRemainingMs > 0 ? (
            <p className="text-ink-secondary">
              再有效在田长养约{' '}
              <span className="font-mono">
                {formatGardenDuration(plant.evolveRemainingMs)}
              </span>
              ，便养足蜕变根基。
            </p>
          ) : null}
        </section>
      ) : null}

      {plant.incidents.length > 0 ? (
        <section aria-label="这株灵植的异事" className="space-y-3">
          <h3 className="font-semibold">灵植异事</h3>
          <GardenIncidentHistory plants={[plant]} species={allSpecies} />
        </section>
      ) : null}

      <section aria-label="生长历程" className="space-y-4">
        <h3 className="font-semibold">生长历程</h3>
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
                        ? '可施为'
                        : plant.exhausted
                          ? '已结束'
                          : '待长成'}
                  </span>
                </div>
                <p className="text-ink-secondary text-xs leading-6">
                  {milestone.detail}
                </p>
              </div>
            </li>
          ))}
        </ol>
      </section>

      {!plant.exhausted &&
      !plant.evolved &&
      !plant.canEvolve &&
      plant.evolveSuccessChance > 0 ? (
        <details className="text-sm">
          <summary className="text-ink-secondary cursor-pointer">
            查看蜕变条件
          </summary>
          <div className="mt-3 space-y-2 text-xs leading-6">
            <p>
              引灵定向后，再有效在田长养{' '}
              <span className="font-mono">
                {formatGardenDuration(plant.evolveMs)}
              </span>
              ，且达到{plant.evolveCost.minRealm}及以上。
            </p>
            <p>
              引自身天地灵气，助植株跨阶。消耗{' '}
              <span className="font-mono">{plant.evolveCost.qi}</span>{' '}
              天地灵气、 <SpiritStones amount={plant.evolveCost.spiritStones} />{' '}
              与 <span className="font-mono">{plant.evolveCost.quantity}</span>{' '}
              份{plant.evolveCost.materialQuality}及以上药材。
            </p>
            <p>
              每次尝试均实扣全部费用，失败后保留当前形态与产物，等待冷却后可再试；最多{' '}
              <span className="font-mono">3</span> 次。
            </p>
          </div>
        </details>
      ) : null}

      <div className="border-ink/10 flex flex-wrap items-center justify-between gap-3 border-t pt-4">
        {plant.exhausted ? (
          pendingQuantity > 0 ? (
            <InkButton variant="primary" disabled={locked} onClick={onHarvest}>
              一键收获
            </InkButton>
          ) : (
            <InkButton variant="primary" disabled={locked} onClick={onClear}>
              清畦重种
            </InkButton>
          )
        ) : plant.canMature ? (
          <InkButton variant="primary" disabled={locked} onClick={onMature}>
            引灵成株 · <span className="font-mono">{plant.matureQiCost}</span>{' '}
            天地灵气
          </InkButton>
        ) : plant.canBranch ? (
          <InkButton variant="primary" disabled={locked} onClick={onBranch}>
            蕴灵定向 · <span className="font-mono">{plant.branchQiCost}</span>{' '}
            天地灵气
          </InkButton>
        ) : plant.canEvolve ? (
          <InkButton variant="primary" disabled={locked} onClick={onEvolve}>
            准备蜕变
          </InkButton>
        ) : (
          <p className="text-ink-secondary text-xs">
            {!mature
              ? '幼苗正在扎根，长足后可引灵成株。'
              : plant.remainingHarvestCycles === 0
                ? '这株灵植即将采尽。'
                : plant.evolved
                  ? '灵蕴已定，静候下一次收成。'
                  : '照常生长，培养机会可以稍后处理。'}
          </p>
        )}
        {!plant.exhausted ? (
          <InkButton variant="secondary" disabled={locked} onClick={onArchive}>
            移入保种阁
          </InkButton>
        ) : null}
      </div>
    </div>
  );
}
