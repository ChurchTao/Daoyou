import { useLayoutEffect, useState, type RefObject } from 'react';

/** Size from independent chrome and document coordinates, never the chat's own height. */
export function useWorldChatViewport(ref: RefObject<HTMLDivElement | null>) {
  const [height, setHeight] = useState(420);
  const [keyboardViewport, setKeyboardViewport] = useState<{
    top: number;
    height: number;
  } | null>(null);
  useLayoutEffect(() => {
    const node = ref.current;
    if (!node) return;
    const slot = node.parentElement!;
    const shell = node.closest<HTMLElement>('[data-game-viewport]');
    const main = node.closest('main');
    const viewport = window.visualViewport;
    let fullHeight = window.innerHeight;
    let fullWidth = window.innerWidth;
    let keyboardOpen = false;
    let frame = 0;
    const measure = () => {
      if (window.innerWidth !== fullWidth) {
        fullWidth = window.innerWidth;
        fullHeight = window.innerHeight;
      }
      const focused = node.contains(document.activeElement);
      // Blur may precede the keyboard's closing animation. Keep the same mode
      // until the viewport recovers, instead of treating its small height as full.
      keyboardOpen =
        (focused || keyboardOpen) &&
        matchMedia('(pointer: coarse)').matches &&
        !!viewport &&
        viewport.scale === 1 &&
        viewport.height < fullHeight - 120;
      shell?.toggleAttribute('data-chat-keyboard', keyboardOpen);
      if (keyboardOpen && viewport) {
        const top = viewport.offsetTop;
        const height = viewport.height;
        setKeyboardViewport((current) =>
          current?.top === top && current.height === height
            ? current
            : { top, height },
        );
        // Preserve the normal-flow slot and dock reservation while WebKit pans
        // to the focused input. Only the chat surface follows visual coordinates.
        return;
      }
      setKeyboardViewport(null);
      fullHeight = window.innerHeight;
      const bottom = main
        ? parseFloat(getComputedStyle(main).paddingBottom) || 0
        : 0;
      const visibleHeight = viewport?.height ?? window.innerHeight;
      // clientTop changes when the document scrolls; this offset must not.
      const documentTop = slot.getBoundingClientRect().top + window.scrollY;
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
    node.addEventListener('focusin', schedule);
    node.addEventListener('focusout', schedule);
    window.addEventListener('resize', schedule);
    window.addEventListener('scroll', schedule, { passive: true });
    viewport?.addEventListener('resize', schedule);
    viewport?.addEventListener('scroll', schedule);
    main?.addEventListener('animationend', settleEntrance);
    return () => {
      cancelAnimationFrame(frame);
      observer.disconnect();
      node.removeEventListener('focusin', schedule);
      node.removeEventListener('focusout', schedule);
      window.removeEventListener('resize', schedule);
      window.removeEventListener('scroll', schedule);
      viewport?.removeEventListener('resize', schedule);
      viewport?.removeEventListener('scroll', schedule);
      main?.removeEventListener('animationend', settleEntrance);
      shell?.removeAttribute('data-chat-keyboard');
    };
  }, [ref]);
  return { height, keyboardViewport };
}
