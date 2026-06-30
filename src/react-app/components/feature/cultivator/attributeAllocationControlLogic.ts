import type { Attributes } from '@shared/types/cultivator';

export function createEmptyAttributeDraft(): Attributes {
  return {
    vitality: 0,
    spirit: 0,
    wisdom: 0,
    speed: 0,
    willpower: 0,
  };
}

export function normalizeAttributeDraftValue(value: number): number {
  return Math.max(0, Math.floor(Number.isFinite(value) ? value : 0));
}

export function sumAttributeDraft(draft: Attributes): number {
  return Object.values(draft).reduce((sum, value) => sum + value, 0);
}

export function canSubmitAttributeAllocation(args: {
  draft: Attributes;
  unallocatedPoints: number;
  loading?: boolean;
}): boolean {
  const pending = sumAttributeDraft(args.draft);
  return pending > 0 && pending <= args.unallocatedPoints && !args.loading;
}

export function setAttributeDraftValue(
  draft: Attributes,
  key: keyof Attributes,
  value: number,
): Attributes {
  return {
    ...draft,
    [key]: normalizeAttributeDraftValue(value),
  };
}

export function adjustAttributeDraftValue(
  draft: Attributes,
  key: keyof Attributes,
  delta: number,
): Attributes {
  return setAttributeDraftValue(draft, key, draft[key] + delta);
}
