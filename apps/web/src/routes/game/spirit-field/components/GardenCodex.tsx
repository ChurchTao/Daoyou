import { InkButton } from '@app/components/ui';
import { SpiritStones } from '@app/components/ui/SpiritStones';
import type { SpiritFieldSnapshot } from '@daoyou/contracts/spirit-field';
import type { SpiritGardenSpeciesId } from '@daoyou/game-domain/spirit-field';
import { BotanicalArt } from './BotanicalArt';

interface GardenCodexProps {
  snapshot: SpiritFieldSnapshot;
  locked: boolean;
  selectedSpeciesId: SpiritGardenSpeciesId | null;
  onSelectSpecies: (id: SpiritGardenSpeciesId) => void;
  onExchange: (id: SpiritGardenSpeciesId) => void;
}

export function GardenCodex({
  snapshot,
  locked,
  selectedSpeciesId,
  onSelectSpecies,
  onExchange,
}: GardenCodexProps) {
  const selected =
    snapshot.species.find((species) => species.id === selectedSpeciesId) ??
    snapshot.species.find((species) =>
      snapshot.codex.some(
        (entry) => entry.speciesId === species.id && entry.matured,
      ),
    ) ??
    snapshot.species[0];
  const record = snapshot.codex.find(
    (entry) => entry.speciesId === selected?.id,
  );
  const exchange = snapshot.exchanges.find(
    (entry) => entry.speciesId === selected?.id,
  );
  const nextUnlock = snapshot.exchanges
    .filter((entry) => !entry.unlocked)
    .sort((left, right) => left.requiredMatured - right.requiredMatured)[0];
  const nextSpecies = snapshot.species.find(
    (entry) => entry.id === nextUnlock?.speciesId,
  );
  const matured = snapshot.profile.maturedSpeciesCount;
  return (
    <section className="space-y-6" aria-label="灵植图录">
      <div className="space-y-3">
        <div className="flex flex-wrap items-end justify-between gap-3">
          <p className="text-ink-secondary text-sm leading-6">
            养过的草木，走过的生长之路，
            <br />
            皆记入这本百草志。
          </p>
          <p className="shrink-0 text-sm">
            <span className="text-teal font-mono text-3xl">{matured}</span>
            <span className="text-ink-secondary mx-1">/</span>
            <span className="text-ink-secondary font-mono">
              {snapshot.species.length}
            </span>
            <span className="text-ink-secondary ml-2">种已养成</span>
          </p>
        </div>
        <p className="border-ink/15 border-l-2 pl-3 text-sm leading-6">
          {nextUnlock && nextSpecies ? (
            <>
              再养成{' '}
              <span className="font-mono font-semibold">
                {Math.max(0, nextUnlock.requiredMatured - matured)}
              </span>{' '}
              种不同灵植，即可兑换{nextSpecies.name}灵种。
            </>
          ) : (
            '所有物种的灵种兑换均已开放，继续记下新的培养路线。'
          )}
        </p>
      </div>
      <div
        className="grid grid-cols-4 gap-x-2 gap-y-4"
        role="group"
        aria-label="选择图录物种"
      >
        {snapshot.species.map((species) => {
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
              <span className="block text-sm">{species.name}</span>
              <span
                className={`mt-1 block text-xs ${entry?.matured ? 'text-teal' : 'text-ink-secondary'}`}
              >
                {entry?.evolved
                  ? '蜕变已录'
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
                  {selected.element}行灵植
                </span>
              </div>
              <p className="text-ink-secondary text-sm leading-6">
                {selected.description}
              </p>
              <p className="text-sm">成株产物：{selected.baseOutput.name}</p>
            </div>
          </div>
          <div className="grid grid-cols-2 gap-4" aria-label="培养路线记载">
            {(['abundance', 'essence'] as const).map((branch) => {
              const route = selected.branches[branch];
              const known = record?.branches.includes(branch);
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
                  <p className="mt-2 text-sm leading-6">{route.output.name}</p>
                  <p className="text-ink-secondary mt-1 text-xs leading-5">
                    凡品每{' '}
                    <span className="font-mono">
                      {route.output.cycleMs / 3_600_000}
                    </span>{' '}
                    小时{' '}
                    <span className="font-mono">{route.output.quantity}</span>{' '}
                    份
                  </p>
                </div>
              );
            })}
          </div>
          <dl className="text-ink-secondary flex flex-wrap gap-x-6 gap-y-2 text-xs">
            <div className="flex gap-2">
              <dt>首次养成</dt>
              <dd className={record?.matured ? 'text-teal' : ''}>
                {record?.matured ? '已记载' : '未记载'}
              </dd>
            </div>
            <div className="flex gap-2">
              <dt>灵植蜕变</dt>
              <dd className={record?.evolved ? 'text-teal' : ''}>
                {record?.evolved ? '已记载' : '未记载'}
              </dd>
            </div>
          </dl>
          {exchange ? (
            <div className="border-ink/15 space-y-3 border-t pt-4">
              <div className="flex flex-wrap items-center justify-between gap-2 text-sm">
                <p>
                  {exchange.quality}灵种 <span className="font-mono">1</span> 份
                </p>
                <SpiritStones amount={exchange.spiritStones} />
              </div>
              {!exchange.unlocked ? (
                <p className="text-ink-secondary text-sm leading-6">
                  养成{' '}
                  <span className="font-mono">{exchange.requiredMatured}</span>{' '}
                  种不同灵植后，开放这枚灵种的兑换。
                </p>
              ) : snapshot.player.spiritStones < exchange.spiritStones ? (
                <p className="text-crimson text-sm">当前灵石不足。</p>
              ) : null}
              <InkButton
                variant="primary"
                disabled={
                  locked ||
                  !exchange.unlocked ||
                  snapshot.player.spiritStones < exchange.spiritStones
                }
                onClick={() => onExchange(selected.id)}
              >
                兑换{selected.name}灵种
              </InkButton>
            </div>
          ) : null}
        </div>
      ) : null}
    </section>
  );
}
