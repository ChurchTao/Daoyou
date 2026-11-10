import { InkButton } from '@app/components/ui';
import { SpiritStones } from '@app/components/ui/SpiritStones';
import type {
  SpiritGardenPlantView,
  SpiritGardenSpecies,
} from '@daoyou/game-domain/spirit-field';
import { formatGardenDuration } from '../garden-presentation';
import { BotanicalArt } from './BotanicalArt';

interface GardenPlantDetailProps {
  plant: SpiritGardenPlantView;
  species: SpiritGardenSpecies;
  elapsedMs: number;
  locked: boolean;
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
  elapsedMs,
  locked,
  onBranch,
  onEvolve,
  onArchive,
  onHarvest,
  onClear,
}: GardenPlantDetailProps) {
  const elapsed = Math.max(0, elapsedMs);
  const growth = plant.activeGrowthMs + (plant.exhausted ? 0 : elapsed);
  const mature = plant.stage !== 'seedling';
  const pendingQuantity = plant.pending.reduce(
    (sum, product) => sum + product.quantity,
    0,
  );
  const branch = plant.branch ? species.branches[plant.branch] : null;
  const currentState = plant.exhausted
    ? '采尽'
    : plant.evolved
      ? '蜕变已成'
      : plant.canEvolve
        ? '可完成蜕变'
        : plant.canBranch
          ? '可确定方向'
          : mature
            ? '静养生长'
            : '幼苗初生';
  const milestones = [
    {
      title: '成株',
      done: mature,
      available: false,
      detail: mature
        ? '已经长成，首次成熟时得到一份收成。'
        : `再生长约 ${formatGardenDuration(Math.max(0, plant.matureMs - growth))}，自动迎来首次收成。`,
    },
    {
      title: branch ? `蕴灵 · ${branch.name}` : '蕴灵定向',
      done: branch !== null,
      available: plant.canBranch,
      detail: branch
        ? branch.description
        : plant.canBranch
          ? '灵机已足，可以选择这株灵植的长期培养方向。'
          : plant.exhausted
            ? '这株灵植采尽时尚未定向。'
            : `在田生长满 ${formatGardenDuration(plant.branchMs)} 后，决定它今后的产物。`,
    },
    {
      title: '蜕变',
      done: plant.evolved,
      available: plant.canEvolve,
      detail: plant.evolved
        ? `蜕变使之后的产物提升至${plant.outputQuality}。`
        : plant.canEvolve
          ? '成长与境界条件已满足，可以投入药材完成一次蜕变。'
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
            className={`text-xs ${plant.evolved && !plant.exhausted ? 'text-teal' : plant.canEvolve || plant.canBranch ? 'text-crimson' : 'text-ink-secondary'}`}
          >
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

      <section aria-label="这株灵植的产出" className="space-y-3">
        <div className="flex flex-wrap items-baseline justify-between gap-2">
          <h3 className="font-semibold">{plant.output.name}</h3>
          {!plant.exhausted ? (
            <p className="text-ink-secondary text-xs">
              每{' '}
              <span className="font-mono">
                {formatGardenDuration(plant.output.cycleMs)}
              </span>{' '}
              <span className="font-mono">{plant.output.quantity}</span> 份
            </p>
          ) : null}
        </div>
        <dl className="grid grid-cols-2 gap-x-4 text-xs leading-6">
          <div>
            <dt className="text-ink-secondary">剩余生产时间</dt>
            <dd className="font-mono">
              {plant.exhausted
                ? '0 分钟'
                : formatGardenDuration(plant.remainingProductionMs)}
            </dd>
          </div>
          <div>
            <dt className="text-ink-secondary">预计还能收</dt>
            <dd>
              <span className="font-mono">{plant.remainingHarvestCycles}</span>{' '}
              轮
            </dd>
          </div>
        </dl>
        <p className="text-ink-secondary text-xs leading-6">
          {plant.exhausted
            ? pendingQuantity > 0
              ? '领取最后一批收成后可清畦重种。'
              : '收成已领完，可以清畦重种。'
            : plant.storageFull
              ? '待领收成已经积满，剩余生产时间暂停消耗。领取后恢复生产。'
              : !mature
                ? '成株后开始稳定生产，首次成熟还会先得到一份收成。'
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
            </ul>
            {!plant.exhausted ? (
              <p className="text-ink-secondary mt-2 text-xs leading-6">
                返回灵圃后可一键收好所有收成。
              </p>
            ) : null}
          </details>
        ) : null}
      </section>

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

      {!plant.exhausted && !plant.evolved && !plant.canEvolve ? (
        <details className="text-sm">
          <summary className="text-ink-secondary cursor-pointer">
            查看蜕变条件
          </summary>
          <div className="mt-3 space-y-2 text-xs leading-6">
            <p>
              选定培养方向，在田生长满{' '}
              <span className="font-mono">
                {formatGardenDuration(plant.evolveMs)}
              </span>
              ，且达到{plant.evolveCost.minRealm}及以上。
            </p>
            <p>
              消耗 <SpiritStones amount={plant.evolveCost.spiritStones} /> 与{' '}
              <span className="font-mono">{plant.evolveCost.quantity}</span> 份
              {plant.evolveCost.materialQuality}及以上药材。
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
        ) : plant.canBranch ? (
          <InkButton variant="primary" disabled={locked} onClick={onBranch}>
            确定培养方向
          </InkButton>
        ) : plant.canEvolve ? (
          <InkButton variant="primary" disabled={locked} onClick={onEvolve}>
            准备蜕变
          </InkButton>
        ) : (
          <p className="text-ink-secondary text-xs">
            {plant.remainingHarvestCycles === 0
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
