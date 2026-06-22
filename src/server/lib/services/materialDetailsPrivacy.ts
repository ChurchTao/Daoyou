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

export function getHiddenMysteryReveal(
  details: unknown,
): HiddenMysteryReveal | null {
  if (!details || typeof details !== 'object') return null;
  const value = (details as Record<string, unknown>)[HIDDEN_MYSTERY_REVEAL_KEY];
  if (!value || typeof value !== 'object') return null;
  return value as HiddenMysteryReveal;
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
