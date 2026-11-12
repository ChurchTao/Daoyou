import Link from '@app/components/router/AppLink';
import { cn } from '@app/lib/cn';
import type { ReactNode } from 'react';

export interface HomeDoor {
  /** 场景编号，主线按它决定这扇门开没开。 */
  id: string;
  label: string;
  href: string;
  /** 门牌底下的近况，两三个字。 */
  note?: ReactNode;
  /** 该进去一趟了。 */
  hot?: boolean;
  guide?: string;
}

const plaque =
  'relative flex min-h-[7.5rem] w-[3.25rem] flex-col items-center gap-1 border px-1 pt-3 pb-1.5';

/**
 * 洞里的石门，一扇一块竖排门牌。
 * 没开的门不写名字，只留一块虚线的空牌。
 */
export function HomeDoors({
  doors,
  unlocked,
  fresh,
}: {
  doors: readonly HomeDoor[];
  /** 主线眼下开放的场景，为空表示不设限。 */
  unlocked: readonly string[] | null;
  fresh: readonly string[];
}) {
  const open = unlocked
    ? doors.filter((door) => unlocked.includes(door.id))
    : doors;
  const shut = doors.length - open.length;
  // 一扇都没开时多摆几块空牌，看得出往里还有地方。
  const blanks = shut === 0 ? 0 : open.length === 0 ? 3 : 1;

  return (
    <ul className="flex flex-wrap gap-2" data-guide="cave.inside">
      {open.map((door) => (
        <li key={door.id}>
          <Link
            href={door.href}
            data-guide={door.guide}
            className={cn(
              plaque,
              'group text-ink hover:border-crimson hover:text-crimson focus-visible:outline-crimson transition-colors outline-none focus-visible:outline-2 focus-visible:outline-offset-2',
              door.hot ? 'border-crimson' : 'border-ink/35',
            )}
          >
            <span className="flex-1 text-base tracking-[0.2em] [writing-mode:vertical-rl]">
              {door.label}
            </span>
            <span
              className={cn(
                'min-h-4 text-xs leading-4 whitespace-nowrap',
                door.hot ? 'text-crimson' : 'text-ink-secondary',
              )}
            >
              {door.note}
            </span>
            {fresh.includes(door.id) ? (
              <span className="bg-crimson text-paper absolute -top-1.5 -right-1.5 px-1 text-xs leading-5">
                新
              </span>
            ) : null}
          </Link>
        </li>
      ))}
      {Array.from({ length: blanks }, (_, index) => (
        <li
          key={`shut:${index}`}
          aria-label={index === 0 ? `还有 ${shut} 道石门没有开` : undefined}
          aria-hidden={index > 0}
          className={cn(plaque, 'border-ink/20 text-ink/30 border-dashed')}
        >
          <span className="flex-1 text-base tracking-[0.2em] [writing-mode:vertical-rl]">
            石门未开
          </span>
        </li>
      ))}
    </ul>
  );
}
