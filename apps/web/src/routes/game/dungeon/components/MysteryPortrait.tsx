import { GameIcon } from '@app/components/ui/GameIcon';
import { cn } from '@app/lib/cn';
import { mysteryPortraitIcon } from './mysteryArt';

/** 人物的姓氏印章，代替尚未绘制的立绘。 */
export function MysterySeal({
  name,
  muted,
}: {
  name: string;
  muted?: boolean;
}) {
  return (
    <span
      aria-hidden="true"
      className={cn(
        'flex size-8 shrink-0 items-center justify-center rounded-full border text-sm',
        muted
          ? 'border-ink-border text-ink-secondary'
          : 'border-crimson/60 text-crimson',
      )}
    >
      {name.slice(0, 1)}
    </span>
  );
}

const SIZE = {
  sm: 'size-10',
  md: 'size-16',
  lg: 'size-28 md:size-36',
  xl: 'size-40 md:size-64',
} as const;

/** 人物或守卫的立绘；没有素材时退回姓氏印章。 */
export function MysteryPortrait({
  portrait,
  name,
  size = 'sm',
  muted,
}: {
  portrait?: string;
  name: string;
  size?: keyof typeof SIZE;
  muted?: boolean;
}) {
  const icon = mysteryPortraitIcon(portrait);
  if (!icon) return <MysterySeal name={name} muted={muted} />;
  return (
    <GameIcon
      value={icon}
      purpose="artwork"
      className={cn(SIZE[size], muted && 'opacity-50 grayscale')}
    />
  );
}
