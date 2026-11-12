import { InkTabs } from '@app/components/ui';
import { QUALITY_VALUES, type Quality } from '@daoyou/constants/qualities';
import type { SpiritFieldSnapshot } from '@daoyou/contracts/spirit-field';
import type { SpiritGardenSpeciesId } from '@daoyou/game-domain/spirit-field';
import { getSpiritGardenOutput } from '@daoyou/game-rules/spirit-field';
import { useState } from 'react';
import { formatGardenDuration } from '../garden-presentation';
import { BotanicalArt } from './BotanicalArt';

const qualityTabs = QUALITY_VALUES.map((quality) => ({
  value: quality,
  label: quality,
}));

interface GardenCodexProps {
  snapshot: SpiritFieldSnapshot;
  locked: boolean;
  selectedSpeciesId: SpiritGardenSpeciesId | null;
  onSelectSpecies: (id: SpiritGardenSpeciesId) => void;
}

export function GardenCodex({
  snapshot,
  locked,
  selectedSpeciesId,
  onSelectSpecies,
}: GardenCodexProps) {
  const [quality, setQuality] = useState<Quality>(
    () =>
      snapshot.species.find((species) => species.id === selectedSpeciesId)
        ?.quality ?? '凡品',
  );
  const speciesInQuality = snapshot.species.filter(
    (species) => species.quality === quality,
  );
  const selected =
    speciesInQuality.find((species) => species.id === selectedSpeciesId) ??
    speciesInQuality.find((species) =>
      snapshot.codex.some(
        (entry) => entry.speciesId === species.id && entry.matured,
      ),
    ) ??
    speciesInQuality[0];
  const record = snapshot.codex.find(
    (entry) => entry.speciesId === selected?.id,
  );
  const baseOutput = selected
    ? getSpiritGardenOutput({
        speciesId: selected.id,
        quality: selected.quality,
        branch: null,
      })
    : null;
  const maturedInQuality = speciesInQuality.filter((species) =>
    snapshot.codex.some(
      (entry) => entry.speciesId === species.id && entry.matured,
    ),
  ).length;

  return (
    <section className="space-y-6" aria-label="灵植图录">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <p className="text-ink-secondary text-sm leading-6">
          养成记录会永久保留。
        </p>
        <p className="shrink-0 text-sm">
          <span className="text-teal font-mono text-3xl">
            {snapshot.profile.maturedSpeciesCount}
          </span>
          <span className="text-ink-secondary mx-1">/</span>
          <span className="text-ink-secondary font-mono">
            {snapshot.species.length}
          </span>
          <span className="text-ink-secondary ml-2">种已养成</span>
        </p>
      </div>
      <div className="space-y-3">
        <InkTabs
          items={qualityTabs}
          activeValue={quality}
          onChange={(value) => {
            if (locked || !QUALITY_VALUES.includes(value as Quality)) return;
            const nextQuality = value as Quality;
            setQuality(nextQuality);
            const first = snapshot.species.find(
              (species) => species.quality === nextQuality,
            );
            if (first) onSelectSpecies(first.id);
          }}
        />
        <p className="text-ink-secondary text-xs">
          {quality}草木 · 已养成{' '}
          <span className="font-mono">
            {maturedInQuality}/{speciesInQuality.length}
          </span>{' '}
          种
        </p>
      </div>
      <div
        className="grid grid-cols-4 gap-x-2 gap-y-4"
        role="group"
        aria-label="选择图录物种"
      >
        {speciesInQuality.map((species) => {
          const entry = snapshot.codex.find(
            (item) => item.speciesId === species.id,
          );
          const active = selected?.id === species.id;
          return (
            <button
              key={species.id}
              type="button"
              disabled={locked}
              aria-pressed={active}
              onClick={() => onSelectSpecies(species.id)}
              className={`focus-visible:outline-crimson min-w-0 cursor-pointer border-b-2 px-1 pb-2 text-center transition-colors focus-visible:outline-2 focus-visible:outline-offset-4 disabled:cursor-not-allowed disabled:opacity-50 ${active ? 'border-crimson text-crimson' : 'text-ink-secondary hover:border-ink/20 border-transparent'}`}
            >
              <BotanicalArt
                speciesId={species.id}
                muted={!entry?.matured && !active}
                className="mx-auto w-full max-w-20"
              />
              <span className="block min-h-10 text-sm leading-5 text-balance">
                {species.name}
              </span>
              <span
                className={`mt-1 block text-xs ${entry?.matured ? 'text-teal' : 'text-ink-secondary'}`}
              >
                {entry?.evolved
                  ? '已完成蜕变'
                  : entry?.matured
                    ? '已养成'
                    : '待养成'}
              </span>
            </button>
          );
        })}
      </div>
      {selected ? (
        <div className="space-y-5">
          <div className="border-ink/15 flex items-center gap-4 border-t pt-5">
            <BotanicalArt
              speciesId={selected.id}
              className="w-24 shrink-0 sm:w-28"
            />
            <div className="min-w-0 space-y-2">
              <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
                <h3 className="text-xl font-semibold">{selected.name}</h3>
                <span className="text-ink-secondary text-xs">
                  {selected.quality} · {selected.element}行灵植
                </span>
              </div>
              <p className="text-ink-secondary text-sm leading-6">
                {selected.description}
              </p>
              <p className="text-sm">成株产物：{selected.baseOutput.name}</p>
              {baseOutput ? (
                <p className="text-ink-secondary text-xs leading-5">
                  每{' '}
                  <span className="font-mono">
                    {formatGardenDuration(baseOutput.cycleMs)}
                  </span>{' '}
                  产出 <span className="font-mono">{baseOutput.quantity}</span>{' '}
                  份
                </p>
              ) : null}
            </div>
          </div>
          <div className="grid gap-4 sm:grid-cols-2" aria-label="培养路线记载">
            {(['abundance', 'essence'] as const).map((branch) => {
              const route = selected.branches[branch];
              const known = record?.branches.includes(branch);
              const output = getSpiritGardenOutput({
                speciesId: selected.id,
                quality: selected.quality,
                branch,
              });
              return (
                <div
                  key={branch}
                  className={`border-l-2 pl-3 ${known ? 'border-teal/60' : 'border-ink/15'}`}
                >
                  <div className="flex flex-wrap items-baseline gap-x-2 gap-y-1">
                    <h4 className="text-sm font-semibold">{route.name}</h4>
                    {known ? (
                      <span className="text-teal text-xs">已记载</span>
                    ) : null}
                  </div>
                  <p className="mt-2 text-sm leading-6">{output.name}</p>
                  <p className="text-ink-secondary mt-1 text-xs leading-5">
                    每{' '}
                    <span className="font-mono">
                      {formatGardenDuration(output.cycleMs)}
                    </span>{' '}
                    产出 <span className="font-mono">{output.quantity}</span> 份
                  </p>
                  <p className="text-ink-secondary mt-2 text-xs leading-6">
                    {output.description}
                  </p>
                </div>
              );
            })}
          </div>
          <dl className="text-ink-secondary flex flex-wrap gap-x-6 gap-y-2 text-xs">
            <div className="flex gap-2">
              <dt>灵植蜕变</dt>
              <dd className={record?.evolved ? 'text-teal' : ''}>
                {selected.quality === '神品'
                  ? '神品不再蜕变'
                  : record?.evolved
                    ? '已记载'
                    : '未记载'}
              </dd>
            </div>
          </dl>
        </div>
      ) : null}
    </section>
  );
}
