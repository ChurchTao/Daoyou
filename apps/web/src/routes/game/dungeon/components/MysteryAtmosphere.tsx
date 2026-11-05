import { GameIcon } from '@app/components/ui/GameIcon';
import { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import './mystery-scenes.css';
import { mysteryPortraitIcon } from './mysteryArt';

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

/**
 * 结尾对决前的“现形”转场：暗场中对手的名字压出，再淡入其情状；
 * 点一下或数秒后进入迎战准备。
 */
export function MysteryReveal({
  name,
  description,
  portrait,
  eyebrow = '真相既明',
  surface = 'ink',
  onDone,
}: {
  name: string;
  description: string;
  /** 对手立绘键；没有素材时只显示名字。 */
  portrait?: string;
  /** 名字上方的一行小字。 */
  eyebrow?: string;
  /** 底色。除祟用纸底，立绘直接落在纸上。 */
  surface?: 'ink' | 'paper';
  onDone: () => void;
}) {
  const icon = mysteryPortraitIcon(portrait);
  const paper = surface === 'paper';
  useEffect(() => {
    const timer = window.setTimeout(onDone, 4200);
    return () => window.clearTimeout(timer);
  }, [onDone]);
  return createPortal(
    <button
      type="button"
      aria-label="跳过"
      className={`mystery-scene fixed inset-0 z-50 flex flex-col items-center justify-center gap-6 px-8 text-center ${paper ? 'bg-paper text-ink' : 'bg-ink text-paper'}`}
      onClick={onDone}
    >
      <span
        className={`text-sm tracking-[0.6em] ${paper ? 'text-ink-secondary' : 'text-paper/60'}`}
      >
        {eyebrow}
      </span>
      {icon ? (
        <span
          className={`mystery-reveal-name ${paper ? '' : 'bg-paper/90 rounded-full p-4'}`}
        >
          <GameIcon
            value={icon}
            purpose="artwork"
            className="size-40 md:size-56"
          />
        </span>
      ) : null}
      <span className="mystery-reveal-name text-crimson text-4xl font-semibold tracking-[0.3em] md:text-5xl">
        {name}
      </span>
      <span
        className={`mystery-reveal-text max-w-xl leading-8 ${paper ? 'text-ink/80' : 'text-paper/80'}`}
      >
        {description}
      </span>
      <span className={`text-xs ${paper ? 'text-ink/45' : 'text-paper/40'}`}>
        点一下继续
      </span>
    </button>,
    document.body,
  );
}
