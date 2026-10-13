import { useLayoutEffect, useRef, useState, type RefObject } from 'react';

/** Measure the actual space below the scene identity and above the game's dock. */
export function useWorldChatViewport(
  ref: RefObject<HTMLDivElement | null>,
  editing: boolean,
) {
  const [height, setHeight] = useState(420);
  const fullHeight = useRef(window.innerHeight);
  useLayoutEffect(() => {
    const node = ref.current;
    if (!node) return;
    const shell = node.closest<HTMLElement>('[data-game-viewport]');
    const main = node.closest('main');
    const viewport = window.visualViewport;
    if (!editing) fullHeight.current = window.innerHeight;
    let frame = 0;
    const measure = () => {
      const keyboardOpen =
        editing &&
        matchMedia('(pointer: coarse)').matches &&
        !!viewport &&
        viewport.height < fullHeight.current - 120;
      shell?.toggleAttribute('data-chat-keyboard', keyboardOpen);
      const bottom = keyboardOpen
        ? 0
        : main
          ? parseFloat(getComputedStyle(main).paddingBottom) || 0
          : 0;
      const visibleBottom = viewport
        ? viewport.height + viewport.offsetTop
        : window.innerHeight;
      let trailingSpace = 0;
      for (
        let ancestor = node.parentElement;
        ancestor && ancestor !== main;
        ancestor = ancestor.parentElement
      ) {
        const style = getComputedStyle(ancestor);
        trailingSpace +=
          (parseFloat(style.paddingBottom) || 0) +
          (parseFloat(style.borderBottomWidth) || 0);
      }
      setHeight(
        Math.max(
          160,
          Math.floor(
            visibleBottom -
              node.getBoundingClientRect().top -
              bottom -
              trailingSpace,
          ),
        ),
      );
    };
    const schedule = () => {
      cancelAnimationFrame(frame);
      frame = requestAnimationFrame(measure);
    };
    schedule();
    const observer = new ResizeObserver(schedule);
    if (main) observer.observe(main);
    const dock = shell?.querySelector('[data-game-bottom-chrome]');
    if (dock) observer.observe(dock);
    window.addEventListener('resize', schedule);
    window.addEventListener('scroll', schedule, { passive: true });
    viewport?.addEventListener('resize', schedule);
    viewport?.addEventListener('scroll', schedule);
    return () => {
      cancelAnimationFrame(frame);
      observer.disconnect();
      window.removeEventListener('resize', schedule);
      window.removeEventListener('scroll', schedule);
      viewport?.removeEventListener('resize', schedule);
      viewport?.removeEventListener('scroll', schedule);
      shell?.removeAttribute('data-chat-keyboard');
    };
  }, [editing, ref]);
  return height;
}
