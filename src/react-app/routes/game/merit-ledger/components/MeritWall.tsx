import { MeritStamp } from '@app/components/feature/merit/MeritStamp';
import {
  SPONSORSHIP_TIER_IDS,
  SPONSORSHIP_TIER_META,
  type SponsorshipTierId,
} from '@shared/lib/sponsorship';

export type MeritPublicRow = {
  cultivatorId: string;
  name: string;
  title: string | null;
  realm: string;
  realmStage: string;
  highestTier: SponsorshipTierId;
  firstSupportedMonth: string;
};

const DISPLAY_TIER_IDS = [...SPONSORSHIP_TIER_IDS].reverse();

export function MeritWall({ rows }: { rows: MeritPublicRow[] }) {
  const groups = DISPLAY_TIER_IDS.map((tier) => ({
    tier,
    members: rows.filter((row) => row.highestTier === tier),
  })).filter((group) => group.members.length > 0);

  if (groups.length === 0) {
    return (
      <p className="text-ink-secondary py-10 text-center text-sm">
        此间尚无公开留名。
      </p>
    );
  }

  return (
    <div className="space-y-8">
      {groups.map(({ tier, members }) => (
        <section key={tier}>
          <header className="border-ink/20 mb-4 flex items-center gap-3 border-b border-dashed pb-3">
            <MeritStamp tier={tier} className="size-10 shrink-0 opacity-90" />
            <div>
              <h3 className="text-lg font-medium tracking-[0.1em]">
                {SPONSORSHIP_TIER_META[tier].name}
              </h3>
              <p className="text-ink-secondary mt-0.5 text-xs tracking-[0.12em]">
                共 {members.length} 位道友
              </p>
            </div>
          </header>
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
            {members.map((row) => (
              <article
                key={row.cultivatorId}
                className="border-ink/15 bg-paper/70 min-w-0 border p-3"
              >
                <p className="truncate text-sm font-medium">
                  {row.name}
                  {row.title ? (
                    <span className="text-ink-secondary text-xs">
                      {' '}
                      · {row.title}
                    </span>
                  ) : null}
                </p>
                <p className="text-ink-secondary mt-1 truncate text-xs leading-5">
                  {row.realm} · {row.realmStage}
                </p>
                <p className="text-ink-secondary mt-1 text-xs opacity-70">
                  初录于 {row.firstSupportedMonth}
                </p>
              </article>
            ))}
          </div>
        </section>
      ))}
    </div>
  );
}
