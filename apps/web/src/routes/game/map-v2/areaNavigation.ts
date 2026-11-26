const locationParams = [
  'area',
  'nodeId',
  'site',
  'place',
  'from',
  'hunt',
  'wanderer',
  'guide',
] as const;

type AtlasDestination = Partial<
  Record<(typeof locationParams)[number] | 'region', string>
>;

export function atlasAreaHref(
  params: URLSearchParams,
  destination: AtlasDestination,
): string {
  const next = new URLSearchParams(params);
  for (const key of locationParams) next.delete(key);
  for (const [key, value] of Object.entries(destination)) {
    if (value !== undefined) next.set(key, value);
  }
  return `/game/map-v2?${next}`;
}
