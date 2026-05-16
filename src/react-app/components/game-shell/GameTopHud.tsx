import type { GameHudSnapshot } from './useGameHudModel';

function HudMeter({
  label,
  display,
  percent,
  tone,
}: GameHudSnapshot['metrics'][number]) {
  const toneClass =
    tone === 'hp'
      ? 'bg-crimson'
      : tone === 'mp'
        ? 'bg-teal'
        : tone === 'progress'
          ? 'bg-ink'
          : 'bg-wood';

  return (
    <div className="min-w-0 space-y-0.5">
      <div className="flex items-center justify-between gap-2 text-[0.66rem] leading-4 md:text-[0.74rem]">
        <span className="text-battle-muted shrink-0 tracking-[0.12em]">
          {label}
        </span>
        <span className="text-ink shrink-0 text-right font-mono text-[0.7rem] md:text-[0.8rem]">
          {display}
        </span>
      </div>
      <div className="bg-battle-faint h-[3px] min-w-0 overflow-hidden">
        <div className={`${toneClass} h-full`} style={{ width: `${percent}%` }} />
      </div>
    </div>
  );
}

export function GameTopHud({
  snapshot,
  onOpenCultivator,
}: {
  snapshot: GameHudSnapshot | null;
  onOpenCultivator: () => void;
}) {
  if (!snapshot) return null;

  return (
    <header className="border-ink/10 border-b border-dashed">
      <button
        type="button"
        onClick={onOpenCultivator}
        className="mx-auto block w-full max-w-5xl px-3 py-1.5 text-left md:px-6 md:py-2"
      >
        <div className="grid grid-cols-[minmax(0,0.82fr)_minmax(0,1.18fr)] gap-2.5 md:gap-5">
          <div className="min-w-0 space-y-0.5">
            <div className="font-heading truncate text-[1.36rem] leading-none md:text-[1.7rem]">
              {snapshot.name}
            </div>
            <div className="text-battle-muted truncate text-[0.72rem] leading-4 tracking-[0.12em] md:text-[0.82rem]">
              {snapshot.realm}·{snapshot.realmStage}
            </div>
            {snapshot.title ? (
              <div className="text-crimson truncate text-[0.7rem] leading-4 tracking-[0.14em] md:text-[0.8rem]">
                「{snapshot.title}」
              </div>
            ) : null}
            <div className="flex min-w-0 items-baseline gap-1 text-[0.66rem] leading-4 md:text-[0.74rem]">
              <span className="text-battle-muted shrink-0 tracking-[0.14em]">
                状态
              </span>
              <span className="text-ink truncate">{snapshot.statusText}</span>
            </div>
          </div>

          <div className="min-w-0 pt-0.5">
            <div className="mb-1 flex items-center justify-end gap-3">
              <div className="shrink-0 text-[0.66rem] tracking-[0.14em] md:text-[0.76rem]">
                <span className="text-battle-muted mr-1">灵石</span>
                <span className="text-ink font-mono">{snapshot.spiritStones}</span>
              </div>
              {snapshot.unreadMailCount > 0 ? (
                <div className="text-[0.66rem] tracking-[0.14em] md:text-[0.76rem]">
                  <span className="text-battle-muted mr-1">玉简</span>
                  <span className="text-crimson font-mono">
                    {snapshot.unreadMailCount}
                  </span>
                </div>
              ) : null}
            </div>
            <div className="grid grid-cols-2 gap-x-3 gap-y-1.5 md:gap-x-4 md:gap-y-2">
              {snapshot.metrics.map(({ key, ...metric }) => (
                <HudMeter key={key} {...metric} />
              ))}
            </div>
          </div>
        </div>
      </button>
    </header>
  );
}
