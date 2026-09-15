import type { Material } from '@shared/types/cultivator';

export const HIDDEN_MYSTERY_REVEAL_KEY = '__serverHiddenMysteryReveal';

export type HiddenMysteryReveal = Pick<
  Material,
  'name' | 'type' | 'rank' | 'element' | 'description' | 'details' | 'quantity'
> & {
  itemLibraryItemId?: string;
  boundAt: string;
};

export function sanitizeMaterialDetails(
  details: unknown,
): Record<string, unknown> | undefined {
  if (!details || typeof details !== 'object') {
    return undefined;
  }
  const next = { ...(details as Record<string, unknown>) };
  delete next[HIDDEN_MYSTERY_REVEAL_KEY];
  delete next.seedSpec;
  return Object.keys(next).length > 0 ? next : undefined;
}

export function sanitizeMaterialForClient<T extends { details?: unknown }>(
  material: T,
): T {
  return {
    ...material,
    details: sanitizeMaterialDetails(material.details),
  };
}

export function withHiddenMysteryReveal(
  details: unknown,
  reveal: HiddenMysteryReveal,
): Record<string, unknown> {
  const base =
    details && typeof details === 'object'
      ? { ...(details as Record<string, unknown>) }
      : {};
  return {
    ...base,
    [HIDDEN_MYSTERY_REVEAL_KEY]: reveal,
  };
}
