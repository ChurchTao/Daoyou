import { useState } from 'react';
import { createPortal } from 'react-dom';
import './mystery-scenes.css';

/**
 * 事件发生时的整屏暗场：本回合有事件发生、且还没为这一回合播过时播一次。
 * 页面刚载入时不补播。
 */
export function MysteryEventFlash({
  turn,
  happened,
}: {
  turn: number;
  happened: boolean;
}) {
  const [shownTurn, setShownTurn] = useState(turn);
  if (!happened || shownTurn === turn) return null;
  return createPortal(
    <div
      aria-hidden
      className="mystery-event-flash bg-ink pointer-events-none fixed inset-0 z-40 flex items-center justify-center"
      onAnimationEnd={() => setShownTurn(turn)}
    >
      <span className="text-paper/70 text-2xl tracking-[1em]">变</span>
    </div>,
    document.body,
  );
}

/**
 * 异变侵蚀：屏幕四周的墨色随加剧层级向内推进；镇住后墨色退去，
 * 镇住的那一刻压下一方朱印。
 */
export function MysteryAnomalyVeil({
  stage,
  stages,
  contained,
}: {
  stage: number;
  stages: number;
  contained: boolean;
}) {
  // 载入时已经镇住的不补播盖印。
  const [stamped, setStamped] = useState(contained);
  const level = contained || stages === 0 ? 0 : stage / stages;
  return createPortal(
    <>
      <div
        aria-hidden
        className="pointer-events-none fixed inset-0 z-40 transition-[box-shadow] duration-[2000ms]"
        style={{
          boxShadow:
            level > 0
              ? `inset 0 0 ${120 + level * 220}px ${20 + level * 60}px rgba(44, 24, 16, ${0.35 + level * 0.4})`
              : 'inset 0 0 0 0 rgba(44, 24, 16, 0)',
        }}
      />
      {contained && !stamped ? (
        <div
          aria-hidden
          className="pointer-events-none fixed inset-0 z-[60] flex items-center justify-center"
        >
          <div
            className="mystery-ward-stamp border-crimson text-crimson flex size-28 items-center justify-center border-4 text-6xl"
            onAnimationEnd={() => setStamped(true)}
          >
            镇
          </div>
        </div>
      ) : null}
    </>,
    document.body,
  );
}
