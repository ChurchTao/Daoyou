import type { ReactNode } from 'react';
import type { GameHudSnapshot } from './useGameHudModel';

export function InfoTable({
  rows,
}: {
  rows: Array<{ label: string; value: ReactNode }>;
}) {
  return (
    <div className="border-ink/10 overflow-hidden border border-dashed">
      <table className="w-full border-collapse text-xs leading-5">
        <tbody className="divide-ink/10 divide-y">
          {rows.map((row) => (
            <tr key={row.label}>
              <th className="text-ink-secondary w-24 px-3 py-1.5 text-left font-medium">
                {row.label}
              </th>
              <td className="text-ink px-3 py-1.5 text-right">{row.value}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

export function StatusDetailBlock({
  status,
}: {
  status: GameHudSnapshot['activeStatuses'][number];
}) {
  return (
    <div className="border-ink/10 bg-bgpaper/70 space-y-2 border border-dashed px-3 py-2">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="text-ink text-sm font-medium">
            <span aria-hidden="true">{status.icon}</span> {status.label}
          </p>
          <p className="text-ink-secondary text-xs leading-5">
            {status.shortDesc}
          </p>
        </div>
        <div className="text-ink-secondary shrink-0 text-right text-xs leading-5">
          {status.durationText ? <p>{status.durationText}</p> : null}
          {status.usesRemaining !== null && status.usesRemaining > 0 ? (
            <p>{status.usesRemaining}次</p>
          ) : null}
        </div>
      </div>
      {status.details.length > 0 ? (
        <div className="text-ink-secondary space-y-1 text-xs leading-5">
          {status.details.map((detail) => (
            <p key={detail}>{detail}</p>
          ))}
        </div>
      ) : null}
    </div>
  );
}
