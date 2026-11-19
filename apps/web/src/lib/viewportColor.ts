export function syncViewportThemeColor() {
  const theme = document.querySelector<HTMLMetaElement>(
    'meta[name="theme-color"]',
  );
  if (theme) {
    theme.content = getComputedStyle(document.documentElement)
      .getPropertyValue('--app-surface-color')
      .trim();
  }
}
