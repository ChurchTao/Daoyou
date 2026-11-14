import { storySceneOpen } from '@daoyou/game-domain/story/gates';
import Link from '@app/components/router/AppLink';
import type { ReactNode } from 'react';

export interface HomeStop {
  /** 离洞府多远：门口、山脚、远处。 */
  at: string;
  places: readonly {
    id: string;
    label: string;
    href: string;
    note?: ReactNode;
  }[];
}

/** 下山的路：从门口到远处，一站一站排下去。只列认得路的地方。 */
export function HomeRoad({
  stops,
  unlocked,
  fresh,
}: {
  stops: readonly HomeStop[];
  unlocked: readonly string[] | null;
  fresh: readonly string[];
}) {
  const reachable = stops
    .map((stop) => ({
      ...stop,
      places: unlocked
        ? stop.places.filter((place) => storySceneOpen(unlocked, place.id))
        : stop.places,
    }))
    .filter((stop) => stop.places.length > 0);

  return (
    <ol className="border-ink/30 ml-1.5 border-l pl-5" data-guide="cave.out">
      {reachable.map((stop) => (
        <li
          key={stop.at}
          className="relative flex min-h-11 items-baseline gap-x-5 py-1.5 text-lg leading-8"
        >
          <span
            aria-hidden
            className="border-ink bg-paper absolute top-[1.05rem] -left-[1.55rem] size-2 rounded-full border"
          />
          <span className="text-ink-secondary w-8 shrink-0 text-xs tracking-[0.2em]">
            {stop.at}
          </span>
          <span className="flex min-w-0 flex-1 flex-wrap gap-x-5">
            {stop.places.map((place) => (
              <span key={place.id} className="whitespace-nowrap">
                <Link
                  href={place.href}
                  className="text-ink decoration-ink/35 hover:text-crimson hover:decoration-crimson focus-visible:outline-crimson underline decoration-1 underline-offset-[6px] transition-colors outline-none focus-visible:outline-2 focus-visible:outline-offset-2"
                >
                  {place.label}
                </Link>
                {fresh.includes(place.id) ? (
                  <span className="bg-crimson text-paper ml-1.5 px-1 text-xs leading-5">
                    新
                  </span>
                ) : null}
                {place.note ? (
                  <span className="text-ink-secondary ml-2 text-sm">
                    {place.note}
                  </span>
                ) : null}
              </span>
            ))}
          </span>
        </li>
      ))}
    </ol>
  );
}
