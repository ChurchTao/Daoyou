import { tierColorMap } from '@app/components/ui/inkBadgeTiers';
import { cn } from '@app/lib/cn';
import type {
  CharacterManualDefV1,
  CultivatorManualStateV1,
  ManualSlotV1,
} from '@daoyou/game-domain/manuals';

export function ManualRealmSlot({
  realm,
  slot,
  manual,
  progress,
  unlocked,
  selected,
  onSelect,
}: {
  realm: CharacterManualDefV1['realm'];
  slot: ManualSlotV1;
  manual?: CharacterManualDefV1;
  progress?: CultivatorManualStateV1['learned'][number];
  unlocked: boolean;
  selected: boolean;
  onSelect: () => void;
}) {
  const advanced = slot > 4;
  return (
    <button
      type="button"
      disabled={!unlocked}
      aria-pressed={selected}
      aria-label={`${advanced ? '高阶' : `${realm}基础`}功法第${slot}位${manual ? `：${manual.name}` : unlocked ? '：择法' : '：未开放'}`}
      onClick={onSelect}
      className={cn(
        'focus-visible:outline-crimson w-full min-h-16 px-0.5 py-1.5 text-center transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 disabled:cursor-not-allowed',
        tierColorMap[realm],
        unlocked && 'enabled:hover:bg-current/10',
        advanced && 'bg-current/10',
        selected && advanced && 'bg-current/20',
        selected && !advanced && 'bg-current/8',
      )}
    >
      {advanced ? (
        <span className="block text-[10px] tracking-[0.28em] opacity-75">
          高阶
        </span>
      ) : null}
      <span className="inline-flex items-center justify-center gap-1">
        {selected ? (
          <span aria-hidden="true" className="h-1.5 w-1.5 rotate-45 bg-current" />
        ) : null}
        <span
          className={cn(
            'inline-block border-b border-current pb-0.5',
            advanced ? 'border-b-2 text-base font-semibold' : 'text-sm',
            selected && 'border-b-2 font-semibold',
          )}
        >
          {realm}
        </span>
      </span>
      <span
        className={cn(
          'mt-1 block text-xs leading-4',
          unlocked ? 'opacity-80' : 'text-ink/40',
        )}
      >
        {manual?.name ?? (unlocked ? '择法' : '未开放')}
      </span>
      {progress ? (
        <span className="mt-0.5 block font-mono text-xs opacity-80">
          {progress.level}层{progress.level === 9 ? ' · 圆满' : ''}
        </span>
      ) : null}
    </button>
  );
}
