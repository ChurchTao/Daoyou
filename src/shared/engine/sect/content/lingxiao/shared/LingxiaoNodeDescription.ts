import {
  standardSectMethodGrowthPolicy,
  type SectMethodId,
  type SectProjectionContext,
} from '../../../core';

function level(
  context: SectProjectionContext,
  methodId: SectMethodId,
): number | undefined {
  return context.sect.methods[methodId];
}

export function growthMagnitude(
  context: SectProjectionContext,
  methodId: SectMethodId,
  baseValue: number,
): number {
  return standardSectMethodGrowthPolicy.scaleMagnitude(
    baseValue,
    level(context, methodId),
  );
}

export function growthStatusMagnitude(
  context: SectProjectionContext,
  methodId: SectMethodId,
  baseValue: number,
): number {
  return standardSectMethodGrowthPolicy.scaleStatusMagnitude(
    baseValue,
    level(context, methodId),
  );
}

export function growthDuration(
  context: SectProjectionContext,
  methodId: SectMethodId,
  baseDuration: number,
): number {
  return standardSectMethodGrowthPolicy.growDuration(
    baseDuration,
    level(context, methodId),
  );
}

export function nodePercent(value: number): string {
  return `${Number((value * 100).toFixed(2))}%`;
}
