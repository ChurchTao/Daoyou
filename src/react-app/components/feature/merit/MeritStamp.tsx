import { cn } from '@shared/lib/cn';
import type { SponsorshipTierId } from '@shared/lib/sponsorship';
import { SPONSORSHIP_TIER_META } from '@shared/lib/sponsorship';

type MeritStampPresentation = {
  stampSrc: string;
  stampClassName: string;
};

const MERIT_STAMP_PRESENTATION: Record<
  SponsorshipTierId,
  MeritStampPresentation
> = {
  faint_light: {
    stampSrc: '/assets/sponsors/yidengweiguang.webp',
    stampClassName: 'rotate-[1.5deg]',
  },
  fellow_traveler: {
    stampSrc: '/assets/sponsors/shanshuitongcheng.webp',
    stampClassName: '-rotate-[1deg]',
  },
  night_guardian: {
    stampSrc: '/assets/sponsors/changyehudao.webp',
    stampClassName: 'rotate-[0.5deg]',
  },
  immortality_witness: {
    stampSrc: '/assets/sponsors/gongzhengchangsheng.webp',
    stampClassName: '-rotate-[0.5deg]',
  },
};

export function MeritStamp({
  tier,
  className,
}: {
  tier: SponsorshipTierId;
  className?: string;
}) {
  const presentation = MERIT_STAMP_PRESENTATION[tier];
  return (
    <img
      src={presentation.stampSrc}
      alt={`${SPONSORSHIP_TIER_META[tier].name}印戳`}
      className={cn(
        'pointer-events-none block aspect-square size-8 object-contain drop-shadow-[0_1px_1px_rgba(91,15,10,0.18)]',
        presentation.stampClassName,
        className,
      )}
    />
  );
}
