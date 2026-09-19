/** A map-origin hint travels with a gameplay history entry, never a global redirect preference. */
export function resolveMapReturnHref(href: string, state: unknown): string {
  if (!state || typeof state !== 'object' || !('mapReturnTo' in state))
    return href;
  const target = state.mapReturnTo;
  if (typeof target !== 'string' || !/^\/game\/map-v2(?:\?|$)/.test(target))
    return href;
  if (!/^\/game\/map(?:\?|$)/.test(href)) return href;
  const params = new URLSearchParams(target.split('?')[1]);
  const requested = new URLSearchParams(href.split('?')[1]);
  for (const key of ['nodeId', 'intent']) {
    const value = requested.get(key);
    if (value) params.set(key, value);
  }
  return `/game/map-v2?${params}`;
}
