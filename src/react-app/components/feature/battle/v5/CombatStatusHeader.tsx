import { InkButton } from '@app/components/ui/InkButton';
import { InkDetailDrawer } from '@app/components/ui/InkDetailDrawer';
import { cn } from '@shared/lib/cn';
import { getResourceLabel } from '@shared/lib/gameConceptDisplay';
import type { PublicBattleUnitSnapshotV1 } from '@shared/types/battle';
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
  return (
    <div className="space-y-0.5">
      <div className="flex items-center gap-1.5 text-[11px] leading-4 md:text-xs md:leading-5">
        <span className="text-battle-muted w-7 shrink-0">{label}</span>
        <span className="text-ink min-w-0 flex-1 truncate text-right font-mono">
          {fmtInt(current)} / {fmtInt(max)}
          {!!shield && shield > 0 && (
            <span className="text-resource-shield"> ({fmtInt(shield)})</span>
          )}
        </span>
      </div>
      <div className="bg-battle-faint relative h-[3px] overflow-hidden">
        <div
          className={cn(
            'h-full transition-all duration-500 ease-out',
            tone === 'hp' ? 'bg-resource-hp' : 'bg-resource-mp',
          )}
          style={{ width: `${percent}%` }}
        />
        {!!shield && shield > 0 && (
          <div
            className="bg-resource-shield-soft absolute top-0 h-full transition-all duration-500 ease-out"
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

function UnitSummary({ unit }: { unit: PublicBattleUnitSnapshotV1 }) {
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
                style={display.iconStyle}
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
          <div className="flex min-w-0 flex-wrap items-baseline gap-x-2 gap-y-1">
            {statusTags.map((tag) => (
              <span
                key={tag.key}
                title={tag.title}
                className={cn(
                  'whitespace-nowrap',
                  tag.tone === 'buff' && 'text-teal',
                  tag.tone === 'debuff' && 'text-crimson',
                  tag.tone === 'default' && 'text-ink-secondary',
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
  statusActions = [],
}: {
  player: PublicBattleUnitSnapshotV1;
  opponent: PublicBattleUnitSnapshotV1;
  onShowPlayerDetails?: () => void;
  onShowOpponentDetails?: () => void;
  controls?: ReactNode;
  statusActions?: Array<{
    label: string;
    onClick?: () => void;
    href?: string;
  }>;
}) {
  const dockRef = useRef<HTMLDivElement | null>(null);
  const [drawerOpen, setDrawerOpen] = useState(false);
  const hasSkills = player.cooldowns.length > 0;

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

  const openUnitDetails = (callback?: () => void) => {
    if (!callback) return;
    setDrawerOpen(false);
    callback();
  };

  return (
    <>
      <section
        aria-label="交战双方状态"
        className="battle-module grid grid-cols-2 gap-3 px-3 py-2 md:px-4 md:py-3"
      >
        <UnitSummary unit={player} />
        <UnitSummary unit={opponent} />
      </section>

      <div
        ref={dockRef}
        className="battle-dock fixed inset-x-0 bottom-0 z-40 select-none"
      >
        <div className="mx-auto max-w-4xl space-y-1.5 pt-1.5 pr-[max(env(safe-area-inset-right),0.75rem)] pb-[calc(env(safe-area-inset-bottom)+0.7rem)] pl-[max(env(safe-area-inset-left),0.75rem)] md:pt-2 md:pr-[max(env(safe-area-inset-right),1.5rem)] md:pb-[calc(env(safe-area-inset-bottom)+0.9rem)] md:pl-[max(env(safe-area-inset-left),1.5rem)]">
          <div className="flex items-center justify-between gap-3 text-xs">
            <div className="flex min-w-0 items-center gap-2">
              <span className="text-ink min-w-0 truncate font-semibold">
                {player.name}
              </span>
              <span className="text-battle-muted shrink-0 font-mono">
                {Math.round(player.hp.percent)}%
              </span>
              <span className="text-battle-muted shrink-0">对</span>
              <span className="text-ink min-w-0 truncate font-semibold">
                {opponent.name}
              </span>
              <span className="text-battle-muted shrink-0 font-mono">
                {Math.round(opponent.hp.percent)}%
              </span>
            </div>
            <div className="flex shrink-0 items-center gap-2.5">
              {statusActions.map((action) => (
                <DockAction key={action.label} {...action} />
              ))}
              <button
                type="button"
                onClick={() => setDrawerOpen(true)}
                className="text-battle-muted hover:text-ink text-[13px] leading-5 transition"
              >
                [战术详情]
              </button>
            </div>
          </div>
          {controls ? <div className="battle-module">{controls}</div> : null}
        </div>
      </div>

      <InkDetailDrawer
        isOpen={drawerOpen}
        onClose={() => setDrawerOpen(false)}
        title="战术状态"
        description={`${player.name} 对 ${opponent.name}`}
        size="lg"
      >
        <div className="space-y-5">
          {hasSkills ? (
            <section>
              <h3 className="battle-caption border-ink/15 mb-2 border-b border-dashed pb-1 text-xs">
                当前技能
              </h3>
              <CombatSkillBar unit={player} />
            </section>
          ) : null}

          {onShowPlayerDetails || onShowOpponentDetails ? (
            <section>
              <h3 className="battle-caption border-ink/15 mb-2 border-b border-dashed pb-1 text-xs">
                单位详情
              </h3>
              <div className="flex flex-wrap gap-3">
                {onShowPlayerDetails ? (
                  <InkButton
                    variant="secondary"
                    onClick={() => openUnitDetails(onShowPlayerDetails)}
                  >
                    查看{player.name}属性
                  </InkButton>
                ) : null}
                {onShowOpponentDetails ? (
                  <InkButton
                    variant="secondary"
                    onClick={() => openUnitDetails(onShowOpponentDetails)}
                  >
                    查看{opponent.name}状态
                  </InkButton>
                ) : null}
              </div>
            </section>
          ) : null}

          {!hasSkills && !onShowPlayerDetails && !onShowOpponentDetails ? (
            <p className="text-battle-muted text-sm">当前暂无更多战术信息。</p>
          ) : null}
        </div>
      </InkDetailDrawer>
    </>
  );
}
