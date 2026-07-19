import {
  hasSectRank,
  SECT_RANK_LABELS,
  type SectDiscipleRank,
} from '../domain/organization';
import {
  SECT_PERMISSIONS,
  type SectPermission,
  type SectPermissionPolicy,
  type SectPermissionState,
} from './contracts';

export class StandardSectPermissionPolicy implements SectPermissionPolicy {
  constructor(
    private readonly minimumRanks: Readonly<
      Record<SectPermission, SectDiscipleRank>
    >,
    private readonly lockedPermissions: ReadonlySet<SectPermission> = new Set(),
  ) {}

  minimumRank(permission: SectPermission): SectDiscipleRank {
    return this.minimumRanks[permission];
  }

  allows(rank: SectDiscipleRank, permission: SectPermission): boolean {
    return (
      !this.lockedPermissions.has(permission) &&
      hasSectRank(rank, this.minimumRank(permission))
    );
  }

  snapshot(
    rank: SectDiscipleRank,
  ): Record<SectPermission, SectPermissionState> {
    return Object.fromEntries(
      SECT_PERMISSIONS.map((permission) => {
        const requiredRank = this.minimumRank(permission);
        const granted = this.allows(rank, permission);
        return [
          permission,
          {
            granted,
            requiredRank,
            ...(!granted
              ? {
                  reason: this.lockedPermissions.has(permission)
                    ? '首版尚未开放'
                    : `须晋升${SECT_RANK_LABELS[requiredRank]}后开放`,
                }
              : {}),
          },
        ];
      }),
    ) as Record<SectPermission, SectPermissionState>;
  }
}
