import Link from '@app/components/router/AppLink';
import { cn } from '@shared/lib/cn';
import {
  getCoreDockItemBadge,
  shouldShowGameDockBadge,
  type GameDockBadge,
} from './gameBottomDockBadge';
import { getCoreDockItems, getExpandedDockGroups } from './gameNavigation';

function DockLink({
  href,
  label,
  active,
  badge,
}: {
  href: string;
  label: string;
  active?: boolean;
  badge?: GameDockBadge;
}) {
  return (
    <Link
      href={href}
      className={cn(
        'hover:text-crimson inline-flex px-1 py-1.5 leading-5 whitespace-nowrap transition',
        active ? 'text-crimson' : 'text-ink',
      )}
    >
      <span className="relative inline-flex items-center">
        [{label}]
        {shouldShowGameDockBadge(badge) ? (
          <span className="absolute -top-0.5 -right-2 flex h-3 w-3">
            <span className="bg-crimson absolute inline-flex h-full w-full animate-ping rounded-full opacity-75" />
            <span className="bg-crimson relative inline-flex h-3 w-3 rounded-full" />
          </span>
        ) : null}
      </span>
    </Link>
  );
}

export function GameBottomDock({
  sceneId,
  unreadMailCount,
  hasUnallocatedAttributePoints,
  isExpanded,
  onToggleExpanded,
  dockMode = 'core',
}: {
  sceneId?: string | null;
  unreadMailCount: number;
  hasUnallocatedAttributePoints: boolean;
  isExpanded: boolean;
  onToggleExpanded: () => void;
  dockMode?: 'core' | 'expanded' | 'hidden';
}) {
  const showExpanded = dockMode === 'expanded' || isExpanded;
  const coreDockItems = getCoreDockItems();
  const expandedDockGroups = getExpandedDockGroups();

  if (dockMode === 'hidden') {
    return null;
  }

  return (
    <footer className="battle-dock border-battle-rule-strong w-full border-t border-dashed">
      <div className="mx-auto max-w-5xl px-3 pt-2 pb-[calc(env(safe-area-inset-bottom)+0.8rem)] md:px-6">
        <nav
          aria-label="核心场景"
          className="flex min-w-0 flex-wrap items-center justify-around text-sm"
        >
          {coreDockItems.map((item) => (
            <DockLink
              key={item.id}
              href={item.href}
              label={item.label}
              active={sceneId === item.id}
              badge={getCoreDockItemBadge(item.id, {
                unreadMailCount,
                hasUnallocatedAttributePoints,
              })}
            />
          ))}
          <button
            type="button"
            onClick={onToggleExpanded}
            className="hover:text-crimson shrink-0 px-1.5 py-1.5 text-center tracking-[0.08em] whitespace-nowrap transition"
          >
            [{isExpanded ? '收起' : '展开'}]
          </button>
        </nav>

        {showExpanded ? (
          <div className="battle-module border-ink/15 mt-2 grid gap-3 border-t border-dashed pt-2.5 text-sm md:grid-cols-2 xl:grid-cols-5">
            {expandedDockGroups.map((group) => (
              <div key={group.key}>
                <div className="text-battle-muted mb-1 text-[0.68rem] tracking-[0.18em]">
                  {group.title}
                </div>
                <div className="flex flex-wrap gap-x-3 gap-y-1 leading-6">
                  {group.actions.map((action) => (
                    <Link
                      key={action.id}
                      href={action.href}
                      className={cn(
                        'hover:text-crimson transition',
                        sceneId === action.id ? 'text-crimson' : '',
                      )}
                    >
                      [{action.label}]
                    </Link>
                  ))}
                </div>
              </div>
            ))}
          </div>
        ) : null}
      </div>
    </footer>
  );
}
