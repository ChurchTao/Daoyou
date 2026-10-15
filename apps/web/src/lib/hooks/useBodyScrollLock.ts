import { useLayoutEffect } from 'react';

let locks = 0;
let previousOverflow = '';

/** Only the last open overlay may restore the body's original scroll policy. */
export function useBodyScrollLock(open: boolean) {
  useLayoutEffect(() => {
    if (!open) return;
    if (locks++ === 0) {
      previousOverflow = document.body.style.overflow;
      document.body.style.overflow = 'hidden';
    }
    return () => {
      if (--locks === 0) document.body.style.overflow = previousOverflow;
    };
  }, [open]);
}
