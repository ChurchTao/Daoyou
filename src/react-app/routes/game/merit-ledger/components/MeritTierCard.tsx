import { MeritStamp } from '@app/components/feature/merit/MeritStamp';
import { cn } from '@shared/lib/cn';
import type { SponsorshipTierId } from '@shared/lib/sponsorship';
import { SPONSORSHIP_TIER_META } from '@shared/lib/sponsorship';
import type { ReactNode } from 'react';

type TierPresentation = {
  cardClassName: string;
  ruleClassName: string;
};

const MERIT_TIER_PRESENTATION: Record<SponsorshipTierId, TierPresentation> = {
  faint_light: {
    cardClassName:
      'border-[#9a7954]/55 bg-[#ede0c5] text-[#2a1a12] shadow-[0_6px_18px_rgba(72,45,24,0.06)]',
    ruleClassName: 'bg-[#7c5b39]/55',
  },
  fellow_traveler: {
    cardClassName:
      'border-[#718084]/55 bg-[#dce2e0] text-[#253034] shadow-[0_6px_18px_rgba(45,62,64,0.06)]',
    ruleClassName: 'bg-[#596a6e]/55',
  },
  night_guardian: {
    cardClassName:
      'border-[#b69649]/70 bg-[#27241e] text-[#d7b666] shadow-[0_8px_20px_rgba(21,17,11,0.16)]',
    ruleClassName: 'bg-[#c6a653]/65',
  },
  immortality_witness: {
    cardClassName:
      'border-[#9e9a64]/55 bg-[#e4e4d2] text-[#292719] shadow-[0_6px_18px_rgba(64,61,34,0.06)]',
    ruleClassName: 'bg-[#77733f]/55',
  },
};

function CardCorner({ className }: { className: string }) {
  return (
    <span
      aria-hidden="true"
      className={cn(
        'pointer-events-none absolute h-2.5 w-2.5 border-current opacity-20',
        className,
      )}
    />
  );
}

export function MeritTierCard({
  tier,
  eyebrow,
  children,
  action,
  className,
}: {
  tier: SponsorshipTierId;
  eyebrow?: ReactNode;
  children?: ReactNode;
  action?: ReactNode;
  className?: string;
}) {
  const presentation = MERIT_TIER_PRESENTATION[tier];
  const meta = SPONSORSHIP_TIER_META[tier];

  return (
    <article
      className={cn(
        'group relative overflow-hidden border p-4 bg-blend-multiply transition-[transform,box-shadow] duration-200 hover:-translate-y-0.5 sm:p-5',
        presentation.cardClassName,
        className,
      )}
      style={{
        backgroundImage: "url('/assets/paper.webp')",
        backgroundSize: '300px',
      }}
    >
      <CardCorner className="top-2 left-2 border-t border-l" />
      <CardCorner className="top-2 right-2 border-t border-r" />
      <CardCorner className="bottom-2 left-2 border-b border-l" />
      <CardCorner className="right-2 bottom-2 border-r border-b" />

      <div className="relative z-10 flex items-start gap-4">
        <div className="min-w-0 flex-1">
          {eyebrow ? (
            <div className="mb-2 text-[0.7rem] tracking-[0.16em] opacity-60">
              {eyebrow}
            </div>
          ) : null}
          <h3 className="text-lg leading-none font-semibold tracking-[0.08em]">
            {meta.name}
          </h3>
          <span
            aria-hidden="true"
            className={cn('mt-3 block h-px w-6', presentation.ruleClassName)}
          />
          {children ? (
            <div className="mt-3 text-sm leading-6">{children}</div>
          ) : null}
          {action ? <div className="mt-3">{action}</div> : null}
        </div>

        <MeritStamp tier={tier} className="size-9 shrink-0 opacity-90" />
      </div>
    </article>
  );
}
