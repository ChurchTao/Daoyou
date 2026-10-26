import { GameIcon } from '@app/components/ui/GameIcon';
import type { SummonedBeast } from '@daoyou/game-domain/beasts';
import { BeastIcon } from './BeastIcon';

export function BeastRosterEntry({
  beast,
  selected,
  isLead,
  disabled,
  onSelect,
}: {
  beast: SummonedBeast;
  selected: boolean;
  isLead?: boolean;
  disabled?: boolean;
  onSelect: () => void;
}) {
  return (
    <button
      type="button"
      disabled={disabled}
      aria-label={`${beast.name}，${beast.level}级${beast.isMutant ? '，变异' : ''}${beast.isLocked ? '，已锁定' : ''}${isLead ? '，首发' : ''}`}
      aria-pressed={selected}
      onClick={onSelect}
      className={`hover:bg-teal/5 focus-visible:outline-teal flex h-16 min-w-0 items-center gap-2 border-l-2 px-2 text-left transition-colors focus-visible:outline-2 focus-visible:outline-offset-[-2px] disabled:cursor-not-allowed disabled:opacity-50 ${selected ? 'border-teal bg-teal/8' : 'border-transparent'}`}
    >
      <BeastIcon
        speciesId={beast.speciesId}
        isMutant={beast.isMutant}
        className="shrink-0 text-[32px]"
      />
      <span className="min-w-0 flex-1">
        <span className="block truncate text-sm" title={beast.name}>
          {beast.name}
        </span>
        <span className="text-ink-secondary mt-1 flex items-center gap-1 text-xs whitespace-nowrap">
          <span className="font-mono">{beast.level}级</span>
          {beast.isLocked ? <GameIcon value="🔒" label="已锁定" /> : null}
          {isLead ? <span className="text-teal">首发</span> : null}
        </span>
      </span>
    </button>
  );
}
