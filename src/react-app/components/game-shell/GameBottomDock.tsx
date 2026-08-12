import Link from '@app/components/router/AppLink';
import { InkDetailDrawer } from '@app/components/ui/InkDetailDrawer';
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
  const drawerOpen = dockMode === 'expanded' || isExpanded;
  const coreDockItems = getCoreDockItems();
  const expandedDockGroups = getExpandedDockGroups();

  if (dockMode === 'hidden') {
    return null;
  }

  return (
    <footer className="battle-dock border-battle-rule-strong w-full border-t border-dashed">
      <div className="mx-auto max-w-5xl pt-2 pr-[max(env(safe-area-inset-right),0.75rem)] pb-[calc(env(safe-area-inset-bottom)+0.8rem)] pl-[max(env(safe-area-inset-left),0.75rem)] md:pr-[max(env(safe-area-inset-right),1.5rem)] md:pl-[max(env(safe-area-inset-left),1.5rem)]">
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
            [{drawerOpen ? '收起' : '展开'}]
          </button>
        </nav>
      </div>

      <InkDetailDrawer
        isOpen={drawerOpen}
        onClose={onToggleExpanded}
        title="万界行止"
        description="前往修行、历练、造物与交易等次级场景。"
        size="md"
        closeOnEscape={dockMode !== 'expanded'}
        closeOnOverlayClick={dockMode !== 'expanded'}
      >
        <nav
          aria-label="全部游戏场景"
          className="grid grid-cols-2 gap-x-4 gap-y-5 text-sm"
        >
          {expandedDockGroups.map((group) => (
            <section key={group.key} className="min-w-0">
              <h3 className="text-battle-muted border-ink/15 mb-2 border-b border-dashed pb-1 text-xs tracking-[0.18em]">
                {group.title}
              </h3>
              <div className="grid gap-1 leading-7">
                {group.actions.map((action) => (
                  <Link
                    key={action.id}
                    href={action.href}
                    onClick={
                      dockMode === 'expanded' ? undefined : onToggleExpanded
                    }
                    className={cn(
                      'hover:text-crimson min-w-0 leading-6 transition',
                      sceneId === action.id ? 'text-crimson' : '',
                    )}
                  >
                    [{action.label}]
                  </Link>
                ))}
              </div>
            </section>
          ))}
        </nav>
      </InkDetailDrawer>
    </footer>
  );
}
