import {
  hasSectRank,
  SECT_RANK_LABELS,
  type SectDiscipleRank,
} from '../domain/organization';
import type {
  SectCapabilityKey,
  SectCapabilityPolicy,
  SectPermissionState,
} from './contracts';

export class StandardSectCapabilityPolicy implements SectCapabilityPolicy {
  private readonly capabilityKeys: readonly SectCapabilityKey[];

  constructor(
    private readonly minimumRanks: Readonly<
      Record<SectCapabilityKey, SectDiscipleRank>
    >,
    private readonly lockedCapabilities: ReadonlySet<SectCapabilityKey> = new Set(),
  ) {
    this.capabilityKeys = Object.freeze(Object.keys(minimumRanks));
  }

  keys(): readonly SectCapabilityKey[] {
    return this.capabilityKeys;
  }

  minimumRank(capability: SectCapabilityKey): SectDiscipleRank | undefined {
    return this.minimumRanks[capability];
  }

  allows(rank: SectDiscipleRank, capability: SectCapabilityKey): boolean {
    return (
      !this.lockedCapabilities.has(capability) &&
      Boolean(this.minimumRank(capability)) &&
      hasSectRank(rank, this.minimumRank(capability)!)
    );
  }

  snapshot(
    rank: SectDiscipleRank,
  ): Record<SectCapabilityKey, SectPermissionState> {
    return Object.fromEntries(
      this.capabilityKeys.map((capability) => {
        const requiredRank = this.minimumRank(capability);
        const granted = this.allows(rank, capability);
        return [
          capability,
          {
            granted,
            requiredRank,
            ...(!granted
              ? {
                  reason: this.lockedCapabilities.has(capability)
                    ? '首版尚未开放'
                    : requiredRank
                      ? `须晋升${SECT_RANK_LABELS[requiredRank]}后开放`
                      : '当前宗门未开放此能力',
                  reasonCode: this.lockedCapabilities.has(capability)
                    ? ('version_locked' as const)
                    : requiredRank
                      ? ('rank_locked' as const)
                      : ('content_locked' as const),
                }
              : {}),
          },
        ];
      }),
    ) as Record<SectCapabilityKey, SectPermissionState>;
  }
}
