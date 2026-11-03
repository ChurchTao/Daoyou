import { cn } from '@app/lib/cn';
import type { MysteryPlayerView } from '@daoyou/game-domain/dungeon/mystery';

const RECENT = 5;

/**
 * 宽屏右栏：只列最近几条线索与人物数，平时压低存在感，
 * 有新线索或鼠标移入时才变清晰；完整内容在案情板里。
 */
export function MysteryClueRail({
  view,
  seen,
  onOpen,
}: {
  view: MysteryPlayerView;
  seen: readonly string[];
  onOpen: (tab: 'clues' | 'people') => void;
}) {
  const recent = [...view.clues, ...view.items].slice(-RECENT).reverse();
  const unread = new Set(
    view.clues.filter((c) => !seen.includes(c.id)).map((c) => c.id),
  );
  const fresh = unread.size > 0;

  return (
    <div
      className={cn(
        'space-y-4 text-sm transition-opacity duration-500 focus-within:opacity-100 hover:opacity-100',
        fresh ? 'opacity-100' : 'opacity-60',
      )}
    >
      <div className="text-ink-secondary flex gap-3">
        <button
          type="button"
          className="hover:text-ink"
          onClick={() => onOpen('clues')}
        >
          线索 <span className="font-mono">{view.clues.length}</span>
        </button>
        <span>·</span>
        <button
          type="button"
          className="hover:text-ink"
          onClick={() => onOpen('people')}
        >
          人物 <span className="font-mono">{view.knownNpcs.length}</span>
        </button>
      </div>

      {recent.length === 0 ? (
        <p className="text-ink-secondary leading-7">
          还没有线索。调查物件、与人交谈都可能有所收获。
        </p>
      ) : (
        <ul className="space-y-3">
          {recent.map((clue) => (
            <li key={clue.id} className="border-ink/20 border-l-2 pl-3">
              <button
                type="button"
                className="hover:text-crimson text-left leading-6"
                onClick={() => onOpen('clues')}
              >
                {clue.name}
                {unread.has(clue.id) ? (
                  <span className="text-crimson ml-1 text-xs">新</span>
                ) : null}
              </button>
              {clue.source ? (
                <div className="text-ink-secondary text-xs">
                  来自{clue.source.name}
                </div>
              ) : null}
            </li>
          ))}
        </ul>
      )}

      <button
        type="button"
        className="text-ink-secondary hover:text-ink"
        onClick={() => onOpen('clues')}
      >
        展开完整案情板 →
      </button>
    </div>
  );
}
