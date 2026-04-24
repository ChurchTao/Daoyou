'use client';

import { cn } from '@/lib/cn';
import type { UnitStateSnapshot } from '@/engine/battle-v5/systems/state/types';
import { format } from 'd3-format';
import type { CSSProperties, ReactNode } from 'react';

import { CombatSkillBar } from './CombatSkillBar';

const fmtInt = format(',d');
const fmtPct = format('.1f');

function formatBuffLabel(buff: UnitStateSnapshot['buffs'][number]) {
  const layers = buff.layers > 1 ? ` x${buff.layers}` : '';
  const duration = buff.remaining === -1 ? '常驻' : `余${buff.remaining}`;
  return `${buff.name}${layers} · ${duration}`;
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
    <div className="space-y-1">
      <div className="flex items-center gap-2 text-xs leading-5 md:text-sm">
        <span className="text-battle-muted shrink-0">{label}</span>
        <span className="text-ink min-w-0 flex-1 truncate text-right font-mono">
          {fmtInt(current)} / {fmtInt(max)}
          {shieldLabel}
        </span>
      </div>
      <div className="bg-battle-faint relative h-[4px] overflow-hidden">
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

function UnitSummary({
  unit,
}: {
  unit: UnitStateSnapshot;
}) {
  return (
    <div className="min-w-0 space-y-2.5">
      <div className="min-w-0">
        <div className="flex min-w-0 items-center gap-2">
          <span className="font-heading text-ink min-w-0 flex-1 truncate text-xl leading-none md:text-2xl">
            {unit.name}
          </span>
          {!unit.alive && (
            <span className="text-crimson shrink-0 text-xs">已结束</span>
          )}
        </div>
      </div>

      <ResourceRow
        label="气血"
        current={unit.hp.current}
        max={unit.hp.max}
        shield={unit.shield}
        percent={unit.hp.percent}
        tone="hp"
      />
      <ResourceRow
        label="灵力"
        current={unit.mp.current}
        max={unit.mp.max}
        percent={unit.mp.percent}
        tone="mp"
      />
    </div>
  );
}

export function CombatStatusHeader({
  player,
  opponent,
  onShowPlayerDetails,
  onShowOpponentDetails,
  controls,
}: {
  player: UnitStateSnapshot;
  opponent: UnitStateSnapshot;
  onShowPlayerDetails?: () => void;
  onShowOpponentDetails?: () => void;
  controls?: ReactNode;
}) {
  const mainAtk = Math.max(player.attrs.atk || 0, player.attrs.magicAtk || 0);
  const critRate = (player.attrs.critRate || 0) * 100;
  const evasionRate = (player.attrs.evasionRate || 0) * 100;
  const statusText =
    player.buffs.length > 0
      ? player.buffs.map((buff) => formatBuffLabel(buff)).join(' ｜ ')
      : '无状态';
  const hasActions = onShowPlayerDetails || onShowOpponentDetails;
  const hasSkills = player.cooldowns.length > 0;

  return (
    <>
      <section className="space-y-4">
        <div className="grid grid-cols-2 gap-4 md:gap-6">
          <UnitSummary unit={player} />
          <UnitSummary unit={opponent} />
        </div>
      </section>

      <div className="battle-dock fixed inset-x-0 bottom-0 z-40 select-none">
        <div className="mx-auto max-w-4xl px-4 pt-3 pb-[calc(env(safe-area-inset-bottom)+1.3rem)] md:px-6">
          <div className="flex items-baseline justify-between gap-3 mb-2">
            <p className="battle-caption min-w-0 text-sm">我的状态</p>

            {hasActions && (
              <div className="flex shrink-0 flex-wrap items-center justify-end gap-x-3 gap-y-1 text-sm">
                {onShowPlayerDetails && (
                  <button
                    type="button"
                    onClick={onShowPlayerDetails}
                    className="text-battle-muted hover:text-ink transition"
                  >
                    [详细属性]
                  </button>
                )}
                {onShowOpponentDetails && (
                  <button
                    type="button"
                    onClick={onShowOpponentDetails}
                    className="text-battle-muted hover:text-ink transition"
                  >
                    [敌方状态]
                  </button>
                )}
              </div>
            )}
          </div>

          <div className="battle-module flex flex-wrap items-center gap-x-3 gap-y-1 text-sm leading-6">
            <span className="min-w-0 truncate">
              <span className="text-battle-muted">攻击</span>
              <span className="text-ink ml-1 font-mono">{fmtInt(mainAtk)}</span>
            </span>
            <span className="text-battle-muted">｜</span>
            <span className="min-w-0 truncate">
              <span className="text-battle-muted">暴击</span>
              <span className="text-ink ml-1 font-mono">{fmtPct(critRate)}%</span>
            </span>
            <span className="text-battle-muted">｜</span>
            <span className="min-w-0 truncate">
              <span className="text-battle-muted">闪避</span>
              <span className="text-ink ml-1 font-mono">{fmtPct(evasionRate)}%</span>
            </span>
          </div>

          <div className="battle-module flex items-start gap-2 text-sm leading-6">
            <span className="text-battle-muted shrink-0">状态</span>
            <span className="text-ink block min-w-0 flex-1 truncate">{statusText}</span>
          </div>

          {hasSkills && (
            <div className="battle-module">
              <CombatSkillBar unit={player} />
            </div>
          )}

          {controls && (
            <div className="battle-module">
              {controls}
            </div>
          )}
          {!controls && !hasSkills && (
            <div className="battle-module text-battle-muted text-sm leading-6">
              当前暂无技能和操作项
            </div>
          )}
        </div>
      </div>
    </>
  );
}
