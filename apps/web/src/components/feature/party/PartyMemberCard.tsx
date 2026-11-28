import type {
  PartyMemberVitals,
  PartyPublicMember,
} from '@daoyou/contracts/party';
import { PartyPortrait } from './PartyPortrait';

export function PartyMemberCard({
  member,
  captain,
  self,
  online,
  sectName,
  vitals,
  showVitals = true,
  onInspect,
}: {
  member: Pick<PartyPublicMember, 'name' | 'gender' | 'realm' | 'realmStage'>;
  captain?: boolean;
  self?: boolean;
  online?: boolean;
  sectName?: string | null;
  vitals?: PartyMemberVitals | null;
  showVitals?: boolean;
  onInspect?: () => void;
}) {
  const presenceLabel =
    online === undefined ? undefined : online ? '在线' : '离线';
  const identity = (
    <>
      <span className="relative flex size-11 shrink-0">
        <span className="border-ink-border bg-paper-2 absolute inset-0 overflow-hidden rounded-full border">
          <PartyPortrait
            member={member}
            className="size-full origin-[50%_36%] scale-125"
          />
        </span>
        {presenceLabel && (
          <span
            role="img"
            aria-label={presenceLabel}
            title={presenceLabel}
            className={`border-paper absolute top-0 right-0 size-3 rounded-full border-2 ${online ? 'bg-teal' : 'bg-crimson'}`}
          />
        )}
      </span>
      <span className="min-w-0 flex-1 wrap-anywhere">
        <strong className="block text-sm">{member.name}</strong>
        <span className="text-ink-secondary flex flex-wrap items-center gap-x-2 text-xs">
          <span>
            {member.realm}
            {member.realmStage}
          </span>
          {sectName !== undefined && (
            <span>
              <span aria-hidden="true">· </span>
              {sectName ?? '散修'}
            </span>
          )}
        </span>
      </span>
      <span className="flex shrink-0 flex-wrap justify-end gap-x-1.5 text-xs">
        {captain && <span className="text-crimson">队长</span>}
        {self && <span className="text-ink-secondary">你</span>}
      </span>
    </>
  );

  return (
    <div className="min-w-0 space-y-2">
      {onInspect ? (
        <button
          type="button"
          aria-label={`查看${member.name}的名片${presenceLabel ? `，${presenceLabel}` : ''}`}
          aria-haspopup="dialog"
          className="hover:text-crimson focus-visible:outline-crimson flex min-h-11 w-full items-center gap-2 rounded-sm text-left"
          onClick={onInspect}
        >
          {identity}
        </button>
      ) : (
        <div className="flex min-h-11 items-center gap-2">{identity}</div>
      )}
      {showVitals &&
        (vitals ? (
          <div className="grid gap-1.5">
            {[
              {
                label: '气血',
                value: vitals.hp,
                max: vitals.maxHp,
                color: 'bg-resource-hp',
              },
              {
                label: '法力',
                value: vitals.mp,
                max: vitals.maxMp,
                color: 'bg-resource-mp',
              },
            ].map(({ label, value, max, color }) => {
              const current = Math.max(0, Math.min(value, max));
              const pair = `${current.toLocaleString()} / ${max.toLocaleString()}`;
              return (
                <div key={label} className="space-y-0.5">
                  <div className="flex flex-wrap items-baseline justify-between gap-x-2 text-xs">
                    <span>{label}</span>
                    <span className="font-mono">{pair}</span>
                  </div>
                  <div
                    className="bg-ink/10 h-1 overflow-hidden"
                    role="meter"
                    aria-label={`${member.name} ${label}`}
                    aria-valuemin={0}
                    aria-valuemax={Math.max(1, max)}
                    aria-valuenow={current}
                    aria-valuetext={pair}
                  >
                    <div
                      className={`h-full ${color}`}
                      style={{
                        width: `${max > 0 ? (current / max) * 100 : 0}%`,
                      }}
                    />
                  </div>
                </div>
              );
            })}
          </div>
        ) : (
          <p className="text-ink-secondary text-xs">
            {vitals === null ? '暂时无法读取气血、法力' : '正在读取气血、法力…'}
          </p>
        ))}
    </div>
  );
}
