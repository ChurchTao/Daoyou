import { InkButton } from '@app/components/ui/InkButton';
import type { UnitStateSnapshot } from '@shared/engine/battle-v5/systems/state/types';
import { cn } from '@shared/lib/cn';
import { getResourceLabel } from '@shared/lib/gameConceptDisplay';
import { format } from 'd3-format';
import {
  useEffect,
  useRef,
  useState,
  type CSSProperties,
  type ReactNode,
} from 'react';

import { CombatSkillBar } from './CombatSkillBar';
import {
  getCombatResourceDisplay,
  getCompactStatusTags,
} from './combatStatusPresentation';

const fmtInt = format(',d');
const STATUS_DOCK_COLLAPSED_STORAGE_KEY = 'daoyou:battle-status-dock-collapsed';
const COMPACT_DOCK_MEDIA_QUERY = '(max-width: 767px)';

function isCompactViewport() {
  if (
    typeof window === 'undefined' ||
    typeof window.matchMedia !== 'function'
  ) {
    return false;
  }

  return window.matchMedia(COMPACT_DOCK_MEDIA_QUERY).matches;
}

function readStoredDockCollapsed() {
  if (typeof window === 'undefined') {
    return false;
  }

  try {
    const stored = window.localStorage.getItem(
      STATUS_DOCK_COLLAPSED_STORAGE_KEY,
    );

    return stored === null ? true : stored === 'true';
  } catch {
    return true;
  }
}

function ResourceRow({
  label,
  current,
  max,
  shield,
  percent,
  tone,
}: {
  label: string;
  current: number;
  max: number;
  shield?: number;
  percent: number;
  tone: 'hp' | 'mp';
}) {
  const shieldPercent =
    shield && max > 0 ? Math.min(100, (shield / max) * 100) : 0;
  const shieldStyle: CSSProperties = {
    width: `${shieldPercent}%`,
    left: `${Math.max(0, percent - shieldPercent)}%`,
  };
  const shieldLabel = !!shield && shield > 0 ? ` (${fmtInt(shield)})` : '';

  return (
    <div className="space-y-0.5">
      <div className="flex items-center gap-1.5 text-[11px] leading-4 md:text-xs md:leading-5">
        <span className="text-battle-muted w-7 shrink-0">{label}</span>
        <span className="text-ink min-w-0 flex-1 truncate text-right font-mono">
          {fmtInt(current)} / {fmtInt(max)}
          {shieldLabel}
        </span>
      </div>
      <div className="bg-battle-faint relative h-[3px] overflow-hidden">
        <div
          className={cn(
            'h-full transition-all duration-500 ease-out',
            tone === 'hp' ? 'bg-crimson' : 'bg-teal',
          )}
          style={{ width: `${percent}%` }}
        />
        {!!shield && shield > 0 && (
          <div
            className="bg-battle-gold-soft absolute top-0 h-full transition-all duration-500 ease-out"
            style={shieldStyle}
          />
        )}
      </div>
    </div>
  );
}

function SummaryInfoRow({
  label,
  children,
  title,
  ariaLabel,
}: {
  label: string;
  children: ReactNode;
  title?: string;
  ariaLabel?: string;
}) {
  return (
    <div
      className="flex min-w-0 items-start gap-1.5 py-0.5 text-[11px] leading-4 md:text-xs md:leading-5"
      title={title}
      aria-label={ariaLabel}
    >
      <span className="text-battle-muted w-7 shrink-0">{label}</span>
      <div className="min-w-0 flex-1">{children}</div>
    </div>
  );
}

function UnitSummary({ unit }: { unit: UnitStateSnapshot }) {
  const statusTags = getCompactStatusTags(unit);

  return (
    <div className="min-w-0 space-y-1.5">
      <div className="flex min-w-0 items-center gap-1.5">
        <span className="font-heading text-ink min-w-0 flex-1 truncate text-xl leading-none">
          {unit.name}
        </span>
        {!unit.alive && (
          <span className="text-crimson shrink-0 text-[11px] leading-none">
            已结束
          </span>
        )}
      </div>

      <ResourceRow
        label={getResourceLabel('hp')}
        current={unit.hp.current}
        max={unit.hp.max}
        shield={unit.shield}
        percent={unit.hp.percent}
        tone="hp"
      />
      <ResourceRow
        label={getResourceLabel('mp')}
        current={unit.mp.current}
        max={unit.mp.max}
        percent={unit.mp.percent}
        tone="mp"
      />
      {unit.combatResources.map((resource) => {
        const display = getCombatResourceDisplay(resource);
        return (
          <SummaryInfoRow
            key={resource.id}
            label={resource.name}
            title={display.accessibleLabel}
            ariaLabel={display.accessibleLabel}
          >
            {display.mode === 'pips' ? (
              <span
                className={cn(
                  'whitespace-nowrap',
                  resource.current > 0
                    ? 'tracking-[0.08em]'
                    : 'text-battle-muted',
                )}
              >
                {display.value}
              </span>
            ) : (
              <div className="flex min-w-0 items-center gap-1.5">
                <div className="bg-ink/10 h-1.5 min-w-0 flex-1 overflow-hidden">
                  <div
                    className="bg-battle-gold-soft h-full transition-all duration-300"
                    style={{
                      width: `${resource.max > 0 ? (resource.current / resource.max) * 100 : 0}%`,
                    }}
                  />
                </div>
                <span className="text-ink-secondary tabular-nums">
                  {display.value}
                </span>
              </div>
            )}
          </SummaryInfoRow>
        );
      })}
      {statusTags.length > 0 && (
        <SummaryInfoRow label="状态">
          <div className="flex min-w-0 flex-wrap gap-x-2 gap-y-1">
            {statusTags.map((tag) => (
              <span
                key={tag.key}
                title={tag.title}
                className={cn(
                  'whitespace-nowrap',
                  tag.tone === 'buff' && 'text-teal',
                  tag.tone === 'debuff' && 'text-crimson',
                  tag.tone === 'default' && 'text-ink',
                )}
              >
                {tag.label}
              </span>
            ))}
          </div>
        </SummaryInfoRow>
      )}
    </div>
  );
}

function DockAction({
  label,
  onClick,
  href,
}: {
  label: string;
  onClick?: () => void;
  href?: string;
}) {
  return (
    <InkButton
      variant="ghost"
      onClick={onClick}
      href={href}
      className="px-0 py-0 text-[13px] leading-5"
    >
      {label}
    </InkButton>
  );
}

export function CombatStatusHeader({
  player,
  opponent,
  onShowPlayerDetails,
  onShowOpponentDetails,
  controls,
  statusAction,
}: {
  player: UnitStateSnapshot;
  opponent: UnitStateSnapshot;
  onShowPlayerDetails?: () => void;
  onShowOpponentDetails?: () => void;
  controls?: ReactNode;
  statusAction?: {
    label: string;
    onClick?: () => void;
    href?: string;
  };
}) {
  const dockRef = useRef<HTMLDivElement | null>(null);
  const [isCompact, setIsCompact] = useState(() => isCompactViewport());
  const [isCollapsed, setIsCollapsed] = useState(() =>
    isCompactViewport() ? readStoredDockCollapsed() : false,
  );
  const hasActions = onShowPlayerDetails || onShowOpponentDetails;
  const hasSkills = player.cooldowns.length > 0;
  const isDockCollapsed = isCompact && isCollapsed;

  useEffect(() => {
    if (
      typeof window === 'undefined' ||
      typeof window.matchMedia !== 'function'
    ) {
      return;
    }

    const mediaQuery = window.matchMedia(COMPACT_DOCK_MEDIA_QUERY);
    const syncDockMode = () => {
      const compact = mediaQuery.matches;
      setIsCompact(compact);
      setIsCollapsed(compact ? readStoredDockCollapsed() : false);
    };

    syncDockMode();

    if (typeof mediaQuery.addEventListener === 'function') {
      mediaQuery.addEventListener('change', syncDockMode);

      return () => {
        mediaQuery.removeEventListener('change', syncDockMode);
      };
    }

    mediaQuery.addListener(syncDockMode);
    return () => {
      mediaQuery.removeListener(syncDockMode);
    };
  }, []);

  useEffect(() => {
    const node = dockRef.current;
    const layoutRoot = node?.closest<HTMLElement>('[data-battle-layout-root]');
    if (!node || !layoutRoot) {
      return;
    }

    const syncDockHeight = () => {
      layoutRoot.style.setProperty(
        '--battle-dock-height',
        `${Math.ceil(node.getBoundingClientRect().height)}px`,
      );
    };

    syncDockHeight();

    if (typeof ResizeObserver === 'undefined') {
      return () => {
        layoutRoot.style.removeProperty('--battle-dock-height');
      };
    }

    const observer = new ResizeObserver(syncDockHeight);
    observer.observe(node);

    return () => {
      observer.disconnect();
      layoutRoot.style.removeProperty('--battle-dock-height');
    };
  }, []);

  const toggleCollapsed = () => {
    if (!isCompact) {
      return;
    }

    setIsCollapsed((current) => {
      const next = !current;

      try {
        window.localStorage.setItem(
          STATUS_DOCK_COLLAPSED_STORAGE_KEY,
          String(next),
        );
      } catch {
        // ignore local persistence failures
      }

      return next;
    });
  };

  return (
    <>
      <section className="shrink-0 space-y-3">
        <div className="grid grid-cols-2 gap-2 md:gap-3">
          <UnitSummary unit={player} />
          <UnitSummary unit={opponent} />
        </div>
      </section>

      <div
        ref={dockRef}
        className="battle-dock fixed inset-x-0 bottom-0 z-40 select-none"
      >
        <div className="mx-auto max-w-4xl px-3 pt-1.5 pb-[calc(env(safe-area-inset-bottom)+0.7rem)] md:px-6 md:pt-2 md:pb-[calc(env(safe-area-inset-bottom)+0.9rem)]">
          {isDockCollapsed ? (
            <div className="flex items-center justify-between gap-3">
              <div className="min-w-0">
                <p className="battle-caption text-[11px] tracking-[0.08em]">
                  战术状态
                </p>
              </div>
              <div className="flex shrink-0 items-center gap-2.5">
                {statusAction && <DockAction {...statusAction} />}
                <button
                  type="button"
                  onClick={toggleCollapsed}
                  className="text-battle-muted hover:text-ink text-[13px] leading-5 transition"
                >
                  [展开]
                </button>
              </div>
            </div>
          ) : (
            <div className="space-y-1.5">
              <div className="flex items-center justify-between gap-3">
                <div className="min-w-0">
                  <p className="battle-caption text-[11px] tracking-[0.08em]">
                    战术状态
                  </p>
                </div>
                <div className="flex shrink-0 flex-wrap items-center justify-end gap-x-2.5 gap-y-0.5">
                  {statusAction && <DockAction {...statusAction} />}
                  {onShowPlayerDetails && (
                    <button
                      type="button"
                      onClick={onShowPlayerDetails}
                      className="text-battle-muted hover:text-ink text-[13px] leading-5 transition"
                    >
                      [详细属性]
                    </button>
                  )}
                  {onShowOpponentDetails && (
                    <button
                      type="button"
                      onClick={onShowOpponentDetails}
                      className="text-battle-muted hover:text-ink text-[13px] leading-5 transition"
                    >
                      [敌方状态]
                    </button>
                  )}
                  {isCompact && (
                    <button
                      type="button"
                      onClick={toggleCollapsed}
                      className="text-battle-muted hover:text-ink text-[13px] leading-5 transition"
                    >
                      [收起]
                    </button>
                  )}
                </div>
              </div>

              {hasSkills && (
                <div className="battle-module">
                  <CombatSkillBar unit={player} />
                </div>
              )}

              {controls && <div className="battle-module">{controls}</div>}
              {!controls && !hasSkills && !hasActions && !statusAction && (
                <div className="battle-module text-battle-muted text-[13px] leading-5">
                  当前暂无技能和操作项
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </>
  );
}
