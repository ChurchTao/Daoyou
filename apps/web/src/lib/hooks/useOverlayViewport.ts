import { useLayoutEffect, type RefObject } from 'react';

/** Keep a portaled, fixed overlay inside the visible viewport, including panning. */
export function useOverlayViewport(
  ref: RefObject<HTMLElement | null>,
  open: boolean,
) {
  useLayoutEffect(() => {
    const node = ref.current;
    if (!open || !node) return;
    const viewport = window.visualViewport;
    let frame = 0;
    const measure = () => {
      const layout = document.documentElement;
      const top = viewport?.offsetTop ?? 0;
      const left = viewport?.offsetLeft ?? 0;
      const height = viewport?.height ?? layout.clientHeight;
      const width = viewport?.width ?? layout.clientWidth;
      node.style.top = `${top}px`;
      node.style.left = `${left}px`;
      node.style.bottom = `${Math.max(0, layout.clientHeight - top - height)}px`;
      node.style.right = `${Math.max(0, layout.clientWidth - left - width)}px`;
      node.style.setProperty('--overlay-viewport-height', `${height}px`);
      node.style.setProperty('--overlay-viewport-width', `${width}px`);

      // Resizing the surface can clip a field already focused near the bottom.
      // Scroll only its local containers, never the document underneath it.
      const field = document.activeElement;
      if (!(field instanceof HTMLElement) || !node.contains(field)) return;
      for (
        let parent = field.parentElement;
        parent && parent !== node;
        parent = parent.parentElement
      ) {
        if (!['auto', 'scroll'].includes(getComputedStyle(parent).overflowY))
          continue;
        const rect = parent.getBoundingClientRect();
        const visibleTop = Math.max(top, rect.top + parent.clientTop);
        const visibleBottom = Math.min(
          top + height,
          rect.top + parent.clientTop + parent.clientHeight,
        );
        const box = field.getBoundingClientRect();
        const delta =
          box.top < visibleTop || box.height > visibleBottom - visibleTop
            ? box.top - visibleTop
            : Math.max(0, box.bottom - visibleBottom);
        if (Math.abs(delta) > 1) parent.scrollTop += delta;
      }
    };
    const schedule = () => {
      cancelAnimationFrame(frame);
      frame = requestAnimationFrame(measure);
    };
    measure();
    node.addEventListener('focusin', schedule);
    window.addEventListener('resize', schedule);
    window.addEventListener('scroll', schedule, { passive: true });
    viewport?.addEventListener('resize', schedule);
    viewport?.addEventListener('scroll', schedule);
    return () => {
      cancelAnimationFrame(frame);
      node.removeEventListener('focusin', schedule);
      window.removeEventListener('resize', schedule);
      window.removeEventListener('scroll', schedule);
      viewport?.removeEventListener('resize', schedule);
      viewport?.removeEventListener('scroll', schedule);
      for (const property of [
        'top',
        'left',
        'bottom',
        'right',
        '--overlay-viewport-height',
        '--overlay-viewport-width',
      ])
        node.style.removeProperty(property);
    };
  }, [open, ref]);
}
