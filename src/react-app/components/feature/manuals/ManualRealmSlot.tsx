import type {
  CharacterManualDefV1,
  CultivatorManualStateV1,
} from '@shared/engine/combat-v6/manuals/types';
import { ManualProgress } from './ManualProgress';

export function ManualRealmSlot({
  realm,
  manual,
  progress,
  unlocked,
  selected,
  onSelect,
}: {
  realm: CharacterManualDefV1['realm'];
  manual?: CharacterManualDefV1;
  progress?: CultivatorManualStateV1['learned'][number];
  unlocked: boolean;
  selected: boolean;
  onSelect: () => void;
}) {
  return (
    <button
      type="button"
      disabled={!unlocked}
      aria-pressed={selected}
      aria-label={`${realm}功法位${manual ? `：${manual.name}` : unlocked ? '：择法' : '：未开放'}`}
      onClick={onSelect}
      className={`relative min-h-16 w-full border px-2 py-2 text-left transition-colors lg:min-h-32 lg:px-3 lg:py-3 ${!unlocked ? 'border-ink/10 bg-bgpaper/90 text-ink/35' : selected ? 'border-ink/50 bg-bgpaper shadow-sm' : 'border-ink/20 bg-bgpaper/90 hover:border-ink/50'}`}
    >
      <span className="text-ink-secondary mb-1 flex items-center justify-between gap-1 text-xs lg:mb-2">
        <span>{realm}</span>
        {progress ? (
          <span className="font-mono lg:hidden">{progress.level} 层</span>
        ) : null}
      </span>
      <span className="block text-sm font-medium">
        {manual?.name ?? (unlocked ? '＋ 择法' : `${realm}开放`)}
      </span>
      {manual && progress ? (
        <>
          <span className="text-ink-secondary mt-1 mb-2 hidden text-xs lg:block">
            <span className="font-mono">{progress.level}</span> 层
            {progress.level === 9 ? ' · 圆满' : ''}
          </span>
          <div className="hidden lg:block">
            <ManualProgress
              manual={manual}
              level={progress.level}
              unlockedLevel={progress.unlockedLevel}
              compact
            />
          </div>
        </>
      ) : null}
      {selected ? (
        <span
          className="bg-crimson absolute top-3 right-2 hidden h-1.5 w-1.5 rotate-45 lg:block"
          aria-hidden="true"
        />
      ) : null}
    </button>
  );
}
