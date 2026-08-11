import type { BattlePublicUnitStateV1 } from '@shared/engine/battle-v5/match/BattlePublicSnapshot';
import type { CSSProperties, ReactNode } from 'react';
import { Link } from 'react-router';

export type RealtimeBattleConnectionStatus =
  'connected' | 'disconnected' | 'connecting';

export type RealtimeBattleRoundPhase =
  | 'connecting'
  | 'waiting'
  | 'planning'
  | 'committed'
  | 'resolving'
  | 'presenting'
  | 'finished';

interface BattleRoundHudProps {
  round?: number;
  phase: RealtimeBattleRoundPhase;
  remainingSeconds?: number;
}

const ROUND_SECONDS = 30;

function phaseLabel(phase: RealtimeBattleRoundPhase) {
  switch (phase) {
    case 'connecting':
      return '连接战局';
    case 'waiting':
      return '等待入阵';
    case 'planning':
      return '选择行动';
    case 'committed':
      return '本方已定';
    case 'resolving':
      return '统一演算';
    case 'presenting':
      return '行动播放';
    case 'finished':
      return '战局已定';
  }
}

function phaseMark(phase: RealtimeBattleRoundPhase, remaining?: number) {
  if (phase === 'planning') return remaining ?? '—';
  if (phase === 'committed') return '定';
  if (phase === 'resolving') return '演';
  if (phase === 'presenting') return '战';
  if (phase === 'finished') return '终';
  return '候';
}

export function BattleRoundHud({
  round,
  phase,
  remainingSeconds,
}: BattleRoundHudProps) {
  const remaining = Math.max(0, remainingSeconds ?? ROUND_SECONDS);
  const progress = phase === 'planning' ? remaining / ROUND_SECONDS : 1;
  const urgency =
    phase !== 'planning'
      ? 'neutral'
      : remaining <= 5
        ? 'danger'
        : remaining <= 10
          ? 'warning'
          : 'normal';
  const style = {
    '--battle-round-progress': `${Math.max(0, Math.min(1, progress)) * 360}deg`,
  } as CSSProperties;
  const mark = phaseMark(phase, remainingSeconds);
  const numericMark = typeof mark === 'number';

  return (
    <section
      className="battle-round-hud pointer-events-none absolute top-[calc(env(safe-area-inset-top)+0.75rem)] left-1/2 z-30 -translate-x-1/2 text-center"
      aria-label={`第 ${round ?? '未知'} 回合，${phaseLabel(phase)}${phase === 'planning' && remainingSeconds !== undefined ? `，剩余 ${remainingSeconds} 秒` : ''}`}
    >
      <p
        key={round}
        className="battle-round-caption mb-1 text-[0.68rem] font-semibold tracking-[0.24em] sm:text-xs"
      >
        第 {round ?? '—'} 回合
      </p>
      <div
        className={`battle-round-seal battle-round-seal--${urgency} relative grid size-[4.75rem] place-items-center rounded-full shadow-[0_8px_30px_rgba(44,24,16,0.16)] sm:size-[5.75rem]`}
        style={style}
      >
        <div className="battle-round-seal__inner relative z-[1] grid size-[calc(100%_-_6px)] place-items-center rounded-full shadow-inner backdrop-blur-md">
          <strong
            className={`battle-round-seal__mark ${numericMark ? 'battle-round-seal__mark--numeric' : 'battle-round-seal__mark--phase'}`}
          >
            {mark}
          </strong>
        </div>
      </div>
      <p className="battle-round-phase mt-1.5 text-[0.68rem] font-semibold tracking-[0.18em] sm:text-xs">
        {phaseLabel(phase)}
      </p>
    </section>
  );
}

interface BattleUtilityHudProps {
  connectionStatus: RealtimeBattleConnectionStatus;
  debugOpen: boolean;
  onToggleDebug: () => void;
}

export function BattleUtilityHud({
  connectionStatus,
  debugOpen,
  onToggleDebug,
}: BattleUtilityHudProps) {
  const connectionLabel =
    connectionStatus === 'connected'
      ? '战局连接正常'
      : connectionStatus === 'disconnected'
        ? '连接中断，正在重连'
        : '正在连接战局';

  return (
    <>
      <div className="absolute top-[calc(env(safe-area-inset-top)+0.85rem)] left-[calc(env(safe-area-inset-left)+0.85rem)] z-30">
        <Link
          to="/game/battle/history"
          className="battle-utility-chip inline-flex min-h-10 items-center rounded-full px-3 text-xs shadow-sm backdrop-blur-md transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#efbf04]"
        >
          离阵
        </Link>
      </div>

      <div className="absolute top-[calc(env(safe-area-inset-top)+0.85rem)] right-[calc(env(safe-area-inset-right)+0.85rem)] z-30 flex items-center gap-2">
        <button
          type="button"
          onClick={onToggleDebug}
          className="battle-utility-chip inline-flex min-h-10 items-center rounded-full px-3 text-xs shadow-sm backdrop-blur-md transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#efbf04]"
        >
          {debugOpen ? '收起日志' : '战斗日志'}
        </button>
        <span
          className="battle-utility-chip grid size-10 place-items-center rounded-full shadow-sm backdrop-blur-md"
          title={connectionLabel}
          aria-label={connectionLabel}
        >
          <span
            className={`size-2.5 rounded-full ${connectionStatus === 'connected' ? 'bg-[#3f6b56]' : connectionStatus === 'disconnected' ? 'bg-[#8f2433]' : 'bg-[#946718]'}`}
            aria-hidden="true"
          />
        </span>
      </div>
    </>
  );
}

interface BattleCommandDockProps {
  expanded: boolean;
  actions: ReactNode;
  units: ReactNode;
  summary: ReactNode;
  guidance?: ReactNode;
}

export function BattleCommandDock({
  expanded,
  actions,
  units,
  summary,
  guidance,
}: BattleCommandDockProps) {
  return (
    <section
      className={`battle-command-dock absolute inset-x-0 bottom-0 z-30 flex justify-center px-[calc(env(safe-area-inset-left)+0.65rem)] pb-[calc(env(safe-area-inset-bottom)+0.65rem)] transition-[transform,opacity] duration-300 motion-reduce:transition-none ${expanded ? 'translate-y-0' : 'pointer-events-none translate-y-[calc(100%_-_4.4rem)]'}`}
      aria-label="战斗指令台"
      data-expanded={expanded}
    >
      <div className="battle-command-dock__surface pointer-events-auto w-full max-w-[72rem] overflow-hidden rounded-t-2xl border border-b-0 px-3 pt-2.5 pb-2 backdrop-blur-lg sm:rounded-2xl sm:border-b sm:px-4">
        <div className="flex min-h-10 items-center justify-between gap-3">
          <div className="min-w-0 flex-1">{summary}</div>
          {!expanded && (
            <span className="shrink-0 text-[0.68rem] tracking-[0.12em] text-[#2c1810]/50">
              指令台已收起
            </span>
          )}
        </div>
        <div
          className={`grid transition-[grid-template-rows,opacity] duration-300 motion-reduce:transition-none ${expanded ? 'grid-rows-[1fr] opacity-100' : 'grid-rows-[0fr] opacity-0'}`}
          aria-hidden={!expanded}
        >
          <div className="min-h-0 overflow-hidden">
            <div className="mt-1.5 flex gap-2 overflow-x-auto pb-1">
              {actions}
            </div>
            <div className="mt-1.5 flex gap-2 overflow-x-auto border-t border-[#2c1810]/10 pt-1.5">
              {units}
            </div>
            {guidance ? (
              <div className="mt-1 min-h-4 text-[0.68rem] leading-4 text-[#2c1810]/58">
                {guidance}
              </div>
            ) : null}
          </div>
        </div>
      </div>
    </section>
  );
}

interface BattleTargetPromptProps {
  abilityName: string;
  targetLabel: string;
  onCancel: () => void;
}

export function BattleTargetPrompt({
  abilityName,
  targetLabel,
  onCancel,
}: BattleTargetPromptProps) {
  return (
    <div className="battle-target-prompt pointer-events-none absolute inset-x-0 bottom-[var(--battle-command-safe)] z-30 flex justify-center px-4 transition-[bottom] duration-300 motion-reduce:transition-none">
      <div className="battle-floating-panel pointer-events-auto flex max-w-[min(92vw,36rem)] items-center gap-3 rounded-full px-4 py-2.5 text-sm shadow-lg backdrop-blur-md">
        <span className="min-w-0 truncate">
          <strong>「{abilityName}」</strong> · 请选择{targetLabel}目标
        </span>
        <button
          type="button"
          className="shrink-0 border-b border-dashed border-[#2c1810]/40 px-1 text-xs text-[#2c1810]/65"
          onClick={onCancel}
        >
          换招
        </button>
      </div>
    </div>
  );
}

interface BattleStatusNoticeProps {
  tone: 'danger' | 'warning';
  children: ReactNode;
}

export function BattleStatusNotice({
  tone,
  children,
}: BattleStatusNoticeProps) {
  return (
    <div
      className={`battle-status-notice battle-floating-panel pointer-events-auto absolute top-[calc(env(safe-area-inset-top)+7.75rem)] left-1/2 z-40 w-[min(92vw,42rem)] -translate-x-1/2 rounded-lg px-4 py-2 text-center text-sm shadow-lg backdrop-blur-md ${tone === 'danger' ? 'battle-floating-panel--danger' : 'battle-floating-panel--warning'}`}
      role="status"
    >
      {children}
    </div>
  );
}

interface BattleUnitInspectorProps {
  unit: BattlePublicUnitStateV1;
  isAlly: boolean;
  onClose: () => void;
}

export function BattleUnitInspector({
  unit,
  isAlly,
  onClose,
}: BattleUnitInspectorProps) {
  const visibleEffects = unit.effects.slice(-4);
  return (
    <aside className="battle-unit-inspector battle-floating-panel absolute right-[calc(env(safe-area-inset-right)+0.85rem)] bottom-[calc(var(--battle-command-safe)+0.7rem)] z-30 w-[min(18rem,calc(100vw-1.7rem))] rounded-xl px-3 py-3 shadow-lg backdrop-blur-md transition-[bottom] duration-300 motion-reduce:transition-none">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <span className="text-[0.65rem] tracking-[0.16em] text-[#2c1810]/48">
            {isAlly ? '我方单位' : '敌方单位'}
          </span>
          <strong className="mt-0.5 block truncate text-base">
            {unit.name}
          </strong>
        </div>
        <button
          type="button"
          onClick={onClose}
          className="grid size-8 shrink-0 place-items-center rounded-full text-sm text-[#2c1810]/55 hover:bg-[#2c1810]/6"
          aria-label="关闭单位详情"
        >
          ×
        </button>
      </div>

      <div className="mt-2 grid grid-cols-2 gap-x-4 gap-y-1.5 text-xs">
        <span className="text-[#8f2433]">
          气血 {unit.hp.current}/{unit.hp.max}
        </span>
        <span className="text-[#28758d]">
          真元 {unit.mp.current}/{unit.mp.max}
        </span>
        <span className="text-[#946718]">护盾 {unit.shield}</span>
        <span className="text-[#2c1810]/58">
          {unit.alive ? '仍在阵中' : '已经离阵'}
        </span>
      </div>

      {(unit.actionStates.length > 0 || visibleEffects.length > 0) && (
        <div className="mt-2 flex flex-wrap gap-1.5 border-t border-[#2c1810]/10 pt-2">
          {unit.actionStates.map((state) => (
            <span
              key={state.id}
              className="rounded-full bg-[#735080]/10 px-2 py-1 text-[0.68rem] text-[#735080]"
            >
              {state.label} · {state.remainingActions}
            </span>
          ))}
          {visibleEffects.map((effect) => (
            <span
              key={effect.id}
              className={`rounded-full px-2 py-1 text-[0.68rem] ${effect.statusType === 'buff' ? 'bg-[#3f6b56]/10 text-[#3f6b56]' : 'bg-[#8f2433]/9 text-[#8f2433]'}`}
            >
              {effect.label}
              {effect.layers > 1 ? ` ×${effect.layers}` : ''}
            </span>
          ))}
        </div>
      )}
    </aside>
  );
}
