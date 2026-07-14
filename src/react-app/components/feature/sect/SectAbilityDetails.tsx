import type { ResolvedSectAbility } from '@shared/engine/sect';

function DetailRows({ detail }: { detail: ResolvedSectAbility }) {
  const rows = [
    detail.manaCost > 0 ? `法力：${detail.manaCost}` : '法力：不消耗',
    `冷却：${detail.cooldown}回合`,
    ...detail.detailRows,
  ];
  return (
    <>
      <div className="grid gap-1 md:grid-cols-2">
        {rows.map((row) => <p key={row}>{row}</p>)}
      </div>
      {detail.notes.length ? (
        <div className="text-ink-secondary mt-2 space-y-1">
          {detail.notes.map((note) => <p key={note}>{note}</p>)}
        </div>
      ) : null}
    </>
  );
}

export function SectAbilityDetails({ detail, collapsible = true }: { detail: ResolvedSectAbility; collapsible?: boolean }) {
  if (!collapsible) return <div className="border-ink/15 mt-3 border-t border-dashed pt-2 text-sm"><DetailRows detail={detail} /></div>;
  return (
    <details className="border-ink/15 mt-3 border-t border-dashed pt-2 text-sm">
      <summary className="text-ink-secondary hover:text-ink cursor-pointer">查看详情</summary>
      <div className="mt-2"><DetailRows detail={detail} /></div>
    </details>
  );
}
