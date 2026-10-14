import { useLayoutEffect, useRef, useState, type RefObject } from 'react';

/** Size from independent chrome and document coordinates, never the chat's own height. */
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
      const visibleHeight = viewport?.height ?? window.innerHeight;
      // clientTop changes when the document scrolls; this offset must not.
      const documentTop = node.getBoundingClientRect().top + window.scrollY;
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
      const next = Math.max(
        160,
        Math.floor(visibleHeight - documentTop - bottom - trailingSpace),
      );
      setHeight((current) => (Math.abs(current - next) <= 1 ? current : next));
    };
    const schedule = () => {
      cancelAnimationFrame(frame);
      frame = requestAnimationFrame(measure);
    };
    const settleEntrance = (event: AnimationEvent) => {
      if (event.target instanceof Element && event.target.contains(node))
        schedule();
    };
    schedule();
    const observer = new ResizeObserver(schedule);
    const dock = shell?.querySelector('[data-game-bottom-chrome]');
    if (dock) observer.observe(dock);
    if (main?.previousElementSibling)
      observer.observe(main.previousElementSibling);
    // Only preceding content can move the workspace. Observing main would observe
    // the height we write, feeding every adjustment back into the measurement.
    for (
      let ancestor: Element | null = node;
      ancestor && ancestor !== main;
      ancestor = ancestor.parentElement
    ) {
      for (
        let preceding = ancestor.previousElementSibling;
        preceding;
        preceding = preceding.previousElementSibling
      ) {
        observer.observe(preceding);
      }
    }
    window.addEventListener('resize', schedule);
    viewport?.addEventListener('resize', schedule);
    main?.addEventListener('animationend', settleEntrance);
    return () => {
      cancelAnimationFrame(frame);
      observer.disconnect();
      window.removeEventListener('resize', schedule);
      viewport?.removeEventListener('resize', schedule);
      main?.removeEventListener('animationend', settleEntrance);
      shell?.removeAttribute('data-chat-keyboard');
    };
  }, [editing, ref]);
  return height;
}
