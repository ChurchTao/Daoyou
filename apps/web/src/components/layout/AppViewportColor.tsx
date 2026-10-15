import { useLayoutEffect } from 'react';

/** Only the visible non-paper scene owns this; paper is the document default. */
export function AppViewportColor({ color }: { color: string }) {
  useLayoutEffect(() => {
    const root = document.documentElement;
    const previousColor = root.style.getPropertyValue('--app-surface-color');
    const theme = document.querySelector<HTMLMetaElement>(
      'meta[name="theme-color"]',
    );
    const previousTheme = theme?.content;

    root.style.setProperty('--app-surface-color', color);
    if (theme) theme.content = color;

    return () => {
      if (previousColor)
        root.style.setProperty('--app-surface-color', previousColor);
      else root.style.removeProperty('--app-surface-color');
      if (theme && previousTheme !== undefined) theme.content = previousTheme;
    };
  }, [color]);

  return null;
}
