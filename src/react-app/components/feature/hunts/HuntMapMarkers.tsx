import { GameIcon } from '@app/components/ui/GameIcon';
import { HUNT_BOSSES, type HuntEvent } from '@shared/hunts/config';
export type HuntMapPoint = { id: string; x: number; y: number };
export function HuntMapMarkers({
  events,
  points,
  showList,
  onSelect,
}: {
  events: HuntEvent[];
  points: HuntMapPoint[];
  showList: boolean;
  onSelect: (event: HuntEvent) => void;
}) {
  return (
    <>
      {showList ? (
        <details className="bg-paper/95 absolute top-[var(--atlas-toolbar-bottom)] left-3 z-20 max-h-[50dvh] max-w-[calc(100%-1.5rem)] overflow-auto p-3 shadow-sm">
          <summary className="text-crimson cursor-pointer text-sm">
            异闻讨伐 · {events.length}
          </summary>
          <ul className="mt-2 space-y-1">
            {events.map((event) => (
              <li key={event.id}>
                <button
                  onClick={() => onSelect(event)}
                  className="hover:bg-ink/5 flex w-full items-center gap-2 p-2 text-left text-sm"
                >
                  <GameIcon
                    value={HUNT_BOSSES[event.bossId].icon}
                    className="text-4xl"
                  />
                  <span>
                    {event.realm} · {HUNT_BOSSES[event.bossId].name}
                    <span className="text-ink-secondary block text-xs">
                      {event.locationName}
                    </span>
                  </span>
                </button>
              </li>
            ))}
          </ul>
        </details>
      ) : (
        points.map((point) => {
          const event = events.find((e) => e.id === point.id);
          return event ? (
            <button
              key={event.id}
              aria-label={`讨伐${event.realm}期${HUNT_BOSSES[event.bossId].name}`}
              onClick={() => onSelect(event)}
              style={{ left: point.x, top: point.y }}
              className="bg-paper/95 border-crimson/40 absolute z-10 flex -translate-x-1/2 -translate-y-full flex-col items-center rounded border px-2 py-1 shadow-sm"
            >
              <GameIcon
                value={HUNT_BOSSES[event.bossId].icon}
                className="text-5xl"
              />
              <span className="text-crimson text-xs whitespace-nowrap">
                {event.realm} · {HUNT_BOSSES[event.bossId].name}
              </span>
            </button>
          ) : null;
        })
      )}
    </>
  );
}
