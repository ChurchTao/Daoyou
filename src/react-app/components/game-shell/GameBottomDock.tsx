import Link from '@app/components/router/AppLink';
import { cn } from '@shared/lib/cn';
import { useLocation } from 'react-router';
import { gameDockGroups } from './gameNavigation';

function DockLink({
  href,
  label,
  active,
  badge,
}: {
  href: string;
  label: string;
  active?: boolean;
  badge?: number;
}) {
  return (
    <Link
      href={href}
      className={cn(
        'hover:text-crimson relative px-1 py-1.5 text-center leading-5 whitespace-nowrap transition',
        active ? 'text-crimson' : 'text-ink',
      )}
    >
      [{label}]
      {badge && badge > 0 ? (
        <span className="bg-crimson text-bgpaper absolute -top-0.5 right-0 inline-flex min-w-4 items-center justify-center rounded-full px-1 text-[0.62rem] leading-4">
          {badge}
        </span>
      ) : null}
    </Link>
  );
}

export function GameBottomDock({
  sceneId,
  unreadMailCount,
  isExpanded,
  onToggleExpanded,
  onOpenCultivator,
  dockMode = 'core',
}: {
  sceneId?: string | null;
  unreadMailCount: number;
  isExpanded: boolean;
  onToggleExpanded: () => void;
  onOpenCultivator: () => void;
  dockMode?: 'core' | 'expanded' | 'hidden';
}) {
  const location = useLocation();
  const showExpanded = dockMode === 'expanded' || isExpanded;

  if (dockMode === 'hidden') {
    return null;
  }

  return (
    <footer className="battle-dock border-battle-rule-strong border-t border-dashed">
      <div className="mx-auto max-w-5xl px-3 pt-2 pb-[calc(env(safe-area-inset-bottom)+0.8rem)] md:px-6">
        <div className="grid grid-cols-[repeat(4,minmax(0,1fr))_4rem] items-center gap-1.5 text-[0.76rem] md:text-sm">
          <button
            type="button"
            onClick={onOpenCultivator}
            className={cn(
              'hover:text-crimson px-1 py-1.5 text-center leading-5 whitespace-nowrap transition',
              sceneId === 'cultivator' ? 'text-crimson' : 'text-ink',
            )}
          >
            [角色]
          </button>
          <DockLink
            href="/game/inventory"
            label="储物袋"
            active={sceneId === 'inventory'}
          />
          <DockLink
            href="/game/mail"
            label="传音"
            active={sceneId === 'mail'}
            badge={unreadMailCount}
          />
          <DockLink href="/game" label="洞府" active={sceneId === 'cave'} />
          <button
            type="button"
            onClick={onToggleExpanded}
            className="hover:text-crimson px-2 py-1.5 text-center tracking-[0.08em] whitespace-nowrap transition"
          >
            [{isExpanded ? '收卷' : '展开'}]
          </button>
        </div>

        {showExpanded ? (
          <div className="battle-module mt-2 grid gap-3 border-t border-dashed pt-2.5 text-sm md:grid-cols-2 xl:grid-cols-5">
            {gameDockGroups.map((group) => (
              <div key={group.key}>
                <div className="text-battle-muted mb-1 text-[0.68rem] tracking-[0.18em]">
                  {group.title}
                </div>
                <div className="flex flex-wrap gap-x-3 gap-y-1 leading-6">
                  {group.actions.map((action) => (
                    <Link
                      key={action.href}
                      href={action.href}
                      className={cn(
                        'hover:text-crimson transition',
                        location.pathname === action.href.split('?')[0]
                          ? 'text-crimson'
                          : '',
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
