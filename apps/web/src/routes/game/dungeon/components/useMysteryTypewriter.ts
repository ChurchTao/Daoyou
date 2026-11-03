import { useCallback, useEffect, useState } from 'react';

/** 逐字显示的速度：每秒字数。 */
const CHARS_PER_SECOND = 35;
const STORAGE_KEY = 'daoyou:mystery-typewriter';

function readEnabled() {
  try {
    return window.localStorage.getItem(STORAGE_KEY) !== 'off';
  } catch {
    return true;
  }
}

/** 玩家的“文字逐字显示”偏好，默认开启，记在本机。 */
export function useTypewriterPreference() {
  const [enabled, setEnabled] = useState(readEnabled);
  const toggle = useCallback(() => {
    setEnabled((prev) => {
      try {
        window.localStorage.setItem(STORAGE_KEY, prev ? 'off' : 'on');
      } catch {
        // 本机存储不可用时只在本次页面内生效。
      }
      return !prev;
    });
  }, []);
  return { enabled, toggle };
}

function prefersReducedMotion() {
  return (
    typeof window !== 'undefined' &&
    window.matchMedia('(prefers-reduced-motion: reduce)').matches
  );
}

/**
 * 本回合新段落逐字显出：返回已显出的字数，以及立即显示全文的 skip。
 * 只在回合变化时从零开始；刚载入页面、关闭偏好或减少动态效果时直接显示全文。
 */
export function useTypewriter(turn: number, total: number, enabled: boolean) {
  const [state, setState] = useState({ turn, shown: Infinity });
  if (state.turn !== turn)
    setState({
      turn,
      shown: enabled && !prefersReducedMotion() ? 0 : Infinity,
    });
  const shown = state.turn === turn ? state.shown : Infinity;
  const typing = shown < total;

  useEffect(() => {
    if (!typing) return;
    const started = performance.now() - (shown / CHARS_PER_SECOND) * 1000;
    let frame = 0;
    const tick = (now: number) => {
      const next = Math.floor(((now - started) / 1000) * CHARS_PER_SECOND);
      setState((prev) =>
        prev.turn === turn ? { turn, shown: Math.max(prev.shown, next) } : prev,
      );
      frame = requestAnimationFrame(tick);
    };
    frame = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(frame);
    // shown 只用来续接起点，不随每帧重启计时。
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [typing, turn]);

  const skip = useCallback(
    () => setState((prev) => ({ ...prev, shown: Infinity })),
    [],
  );
  return { shown, typing, skip };
}
