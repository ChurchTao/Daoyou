import { syncViewportThemeColor } from '@app/lib/viewportColor';
import { useLayoutEffect } from 'react';

/** Only the visible immersive scene overrides the current theme surface. */
export function AppViewportColor({ color }: { color: string }) {
  useLayoutEffect(() => {
    const root = document.documentElement;
    const previousColor = root.style.getPropertyValue('--app-surface-color');

    root.style.setProperty('--app-surface-color', color);
    syncViewportThemeColor();

    return () => {
      if (previousColor)
        root.style.setProperty('--app-surface-color', previousColor);
      else root.style.removeProperty('--app-surface-color');
      syncViewportThemeColor();
    };
  }, [color]);

  return null;
}
