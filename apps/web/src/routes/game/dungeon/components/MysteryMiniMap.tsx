import { cn } from '@app/lib/cn';
import type { MysteryPlayerView } from '@daoyou/game-domain/dungeon/mystery';

const WIDTH = 320;
const NODE_W = 76;
const NODE_H = 26;
const ROW_H = 44;

/**
 * 已知地点的连线示意：按距入口的步数分层，只画到访过的房间与其相邻房间。
 * 只有相邻的房间可以点，避免一次点击扣掉多点行动力。
 */
export function MysteryMiniMap({
  map,
  reachable,
  disabled,
  onSelect,
  large = false,
}: {
  map: MysteryPlayerView['map'];
  /** 当前可直接前往的房间（相邻房间）。 */
  reachable: ReadonlySet<string>;
  disabled: boolean;
  onSelect: (roomId: string) => void;
  large?: boolean;
}) {
  const layers = new Map<number, string[]>();
  for (const room of map.rooms)
    layers.set(room.depth, [...(layers.get(room.depth) ?? []), room.id]);
  const depths = [...layers.keys()].sort((a, b) => a - b);
  const pos = new Map<string, { x: number; y: number }>();
  depths.forEach((depth, row) => {
    const ids = layers.get(depth)!;
    ids.forEach((id, i) =>
      pos.set(id, {
        x: (WIDTH / ids.length) * (i + 0.5),
        y: row * ROW_H + NODE_H / 2 + 12,
      }),
    );
  });
  const height = depths.length * ROW_H + 8;
  const clip = (name: string) =>
    name.length > 6 ? `${name.slice(0, 5)}…` : name;

  return (
    <svg
      viewBox={`0 0 ${WIDTH} ${height}`}
      className={cn('w-full', large ? 'max-h-[60vh]' : 'max-h-44')}
      role="img"
      aria-label="已知地点示意图"
    >
      {map.edges.map(([a, b]) => {
        const from = pos.get(a);
        const to = pos.get(b);
        if (!from || !to) return null;
        const known =
          map.rooms.find((r) => r.id === a)?.visited &&
          map.rooms.find((r) => r.id === b)?.visited;
        return (
          <line
            key={`${a}-${b}`}
            x1={from.x}
            y1={from.y}
            x2={to.x}
            y2={to.y}
            className="stroke-ink-border"
            strokeWidth={1}
            strokeDasharray={known ? undefined : '3 3'}
          />
        );
      })}
      {map.rooms.map((room) => {
        const p = pos.get(room.id)!;
        const canGo = reachable.has(room.id) && !disabled;
        const marks = [
          room.locked ? '锁' : '',
          room.guarded ? '守' : '',
          room.disturbed ? '异' : '',
        ].join('');
        return (
          <g
            key={room.id}
            onClick={canGo ? () => onSelect(room.id) : undefined}
            className={cn(canGo && 'cursor-pointer')}
            role={canGo ? 'button' : undefined}
            aria-label={canGo ? `前往${room.name}` : room.name}
          >
            <rect
              x={p.x - NODE_W / 2}
              y={p.y - NODE_H / 2}
              width={NODE_W}
              height={NODE_H}
              rx={4}
              className={cn(
                room.here
                  ? 'fill-ink stroke-ink'
                  : room.visited
                    ? 'fill-paper stroke-ink-secondary'
                    : 'fill-paper stroke-ink-border',
                canGo && 'hover:stroke-crimson',
              )}
              strokeWidth={room.here ? 1.5 : 1}
              strokeDasharray={room.visited || room.here ? undefined : '3 2'}
            />
            <text
              x={p.x}
              y={p.y + 4}
              textAnchor="middle"
              className={cn(
                'text-[11px]',
                room.here
                  ? 'fill-paper'
                  : room.visited
                    ? 'fill-ink'
                    : 'fill-ink-secondary',
              )}
            >
              {clip(room.name)}
            </text>
            {marks ? (
              <text
                x={p.x + NODE_W / 2 - 2}
                y={p.y - NODE_H / 2 - 2}
                textAnchor="end"
                className="fill-crimson text-[10px]"
              >
                {marks}
              </text>
            ) : null}
            {room.people > 0 ? (
              <text
                x={p.x - NODE_W / 2 + 2}
                y={p.y - NODE_H / 2 - 2}
                className="fill-teal text-[10px]"
              >
                {'●'.repeat(Math.min(room.people, 4))}
              </text>
            ) : null}
          </g>
        );
      })}
    </svg>
  );
}
