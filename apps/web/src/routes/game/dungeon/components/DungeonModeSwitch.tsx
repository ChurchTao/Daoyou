import { cn } from '@app/lib/cn';
import { useEffect, useRef, useState, type PointerEvent } from 'react';
import { createPortal } from 'react-dom';
import './dungeon-mode.css';

type Mode = 'mystery' | 'exorcism';

const MODES: Record<Mode, { title: string; note: string; seal: string }> = {
  mystery: {
    title: '云游·探秘',
    note: '每处秘境都藏着一桩悬案',
    seal: '探',
  },
  exorcism: {
    title: '云游·除祟',
    note: '祟物盘踞此地，四战除之',
    seal: '祟',
  },
};

/** 拖过这个比例松手才切换，否则弹回。 */
const SWITCH_AT = 0.55;
/** 墨盖满整屏的时刻，内容在这时切换，玩家看不到跳变。 */
const SWAP_AT_MS = 530;
const WASH_DONE_MS = 1040;

const position = (mode: Mode) => (mode === 'exorcism' ? 1 : 0);

function prefersReducedMotion() {
  return window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
}

/**
 * 云游首页的切换器，同时是这一页的身份。通栏长卷两端写两种玩法，
 * 中间一枚墨色转轮：拖到另一端、点另一端的大字或用方向键都能切换。
 * 切换时浓墨从转轮落点晕开盖满整屏，内容在墨后更换，再退去并落下题字。
 */
export function DungeonModeSwitch({
  mode,
  onChange,
}: {
  mode: Mode;
  onChange: (mode: Mode) => void;
}) {
  const railRef = useRef<HTMLDivElement>(null);
  const wheelRef = useRef<HTMLButtonElement>(null);
  const timers = useRef<number[]>([]);
  const drag = useRef<{ pointerId: number; moved: boolean } | null>(null);
  const [progress, setProgress] = useState<number | null>(null);
  const [wash, setWash] = useState<{ to: Mode; x: number; y: number } | null>(
    null,
  );

  useEffect(() => {
    const pending = timers.current;
    return () => pending.forEach((timer) => window.clearTimeout(timer));
  }, []);

  const switchTo = (next: Mode) => {
    if (next === mode || wash) return;
    setProgress(null);
    if (prefersReducedMotion()) {
      onChange(next);
      return;
    }
    const rect = wheelRef.current?.getBoundingClientRect();
    setWash({
      to: next,
      x: rect ? rect.left + rect.width / 2 : window.innerWidth / 2,
      y: rect ? rect.top + rect.height / 2 : window.innerHeight / 2,
    });
    navigator.vibrate?.(15);
    timers.current.push(
      window.setTimeout(() => onChange(next), SWAP_AT_MS),
      window.setTimeout(() => setWash(null), WASH_DONE_MS),
    );
  };

  const other: Mode = mode === 'exorcism' ? 'mystery' : 'exorcism';

  const progressAt = (clientX: number) => {
    const rail = railRef.current?.getBoundingClientRect();
    const wheel = wheelRef.current?.getBoundingClientRect();
    if (!rail || !wheel) return position(mode);
    const span = rail.width - wheel.width;
    return span > 0
      ? Math.min(1, Math.max(0, (clientX - rail.left - wheel.width / 2) / span))
      : position(mode);
  };

  const onPointerDown = (event: PointerEvent<HTMLButtonElement>) => {
    if (wash) return;
    event.currentTarget.setPointerCapture(event.pointerId);
    drag.current = { pointerId: event.pointerId, moved: false };
  };
  const onPointerMove = (event: PointerEvent<HTMLButtonElement>) => {
    if (drag.current?.pointerId !== event.pointerId) return;
    const next = progressAt(event.clientX);
    if (Math.abs(next - position(mode)) > 0.03) drag.current.moved = true;
    if (drag.current.moved) setProgress(next);
  };
  const onPointerUp = (event: PointerEvent<HTMLButtonElement>) => {
    if (drag.current?.pointerId !== event.pointerId) return;
    const { moved } = drag.current;
    drag.current = null;
    if (!moved) {
      switchTo(other);
      return;
    }
    const travelled = Math.abs(progressAt(event.clientX) - position(mode));
    if (travelled >= SWITCH_AT) switchTo(other);
    else setProgress(null);
  };
  const onPointerCancel = () => {
    drag.current = null;
    setProgress(null);
  };

  // 切换时转轮提前滑到目标端，内容等墨盖住再换。
  const shown = progress ?? (wash ? position(wash.to) : position(mode));
  const dark = shown;

  const titleButton = (target: Mode, share: number) => (
    <button
      key={target}
      type="button"
      role="radio"
      aria-checked={mode === target}
      tabIndex={mode === target ? 0 : -1}
      onClick={() => switchTo(target)}
      onKeyDown={(event) => {
        if (
          ['ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown'].includes(
            event.key,
          )
        ) {
          event.preventDefault();
          switchTo(other);
        }
      }}
      className={cn(
        'min-w-0 flex-1 px-3 py-4 transition-opacity md:px-6 md:py-6',
        target === 'exorcism' ? 'text-right' : 'text-left',
      )}
      style={{ opacity: 0.32 + 0.68 * share }}
    >
      <span
        className={cn(
          'font-heading block text-[1.65rem] leading-tight sm:text-4xl md:text-5xl',
          target === 'exorcism' && 'text-crimson',
        )}
      >
        {MODES[target].title}
      </span>
      <span className="text-ink-secondary mt-1 block text-xs leading-5 md:mt-2 md:text-sm">
        {MODES[target].note}
      </span>
    </button>
  );

  return (
    <div className="bg-paper-2/70 border-ink/15 relative overflow-hidden rounded-lg border shadow-[inset_0_0_40px_rgba(44,24,16,0.08)]">
      {/* 除祟一侧的墨色随转轮位置变浓。 */}
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_at_right,rgba(44,24,16,0.32),transparent_72%)] transition-opacity duration-300"
        style={{ opacity: dark }}
      />
      <div
        role="radiogroup"
        aria-label="云游玩法"
        className="relative flex items-start"
      >
        {titleButton('mystery', 1 - shown)}
        {titleButton('exorcism', shown)}
      </div>
      <div
        ref={railRef}
        className="relative mx-3 mb-3 h-16 [--wheel-size:4rem] md:mx-6 md:mb-5 md:h-20 md:[--wheel-size:5rem]"
      >
        <div
          aria-hidden
          className="border-ink/25 absolute inset-x-0 top-1/2 border-t border-dashed"
        />
        <button
          ref={wheelRef}
          type="button"
          // 键盘操作走上面的两个单选，转轮只给指针用。
          tabIndex={-1}
          aria-hidden
          data-dragging={progress !== null}
          className="dungeon-mode-wheel absolute top-0 size-16 md:size-20"
          style={{ left: `calc((100% - var(--wheel-size)) * ${shown})` }}
          onPointerDown={onPointerDown}
          onPointerMove={onPointerMove}
          onPointerUp={onPointerUp}
          onPointerCancel={onPointerCancel}
        >
          <span
            className="dungeon-mode-wheel-disc absolute inset-0 rounded-full shadow-[0_4px_14px_rgba(44,24,16,0.4)]"
            style={{ transform: `rotate(${shown * 180}deg)` }}
          />
          <span className="font-heading text-paper relative text-3xl md:text-4xl">
            {shown >= 0.5 ? MODES.exorcism.seal : MODES.mystery.seal}
          </span>
        </button>
      </div>
      {wash
        ? createPortal(
            <div
              aria-hidden
              className="dungeon-mode-wash"
              data-to={wash.to}
              style={{
                ['--wash-x' as string]: `${wash.x}px`,
                ['--wash-y' as string]: `${wash.y}px`,
              }}
            >
              <span className="dungeon-mode-stamp">
                {wash.to === 'exorcism' ? '除祟' : '探秘'}
              </span>
            </div>,
            document.body,
          )
        : null}
    </div>
  );
}
