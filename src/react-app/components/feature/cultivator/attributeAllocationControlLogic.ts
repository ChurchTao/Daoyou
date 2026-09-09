import type { Attributes } from '@shared/types/cultivator';

export function createEmptyAttributeDraft(): Attributes {
  return {
    vitality: 0,
    strength: 0,
    spirit: 0,
    endurance: 0,
    speed: 0,
    willpower: 0,
  };
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
