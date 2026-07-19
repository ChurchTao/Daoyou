import type { DbExecutor, DbTransaction } from '@server/lib/drizzle/db';
import type { SectBenefitService } from './SectBenefitService';
import type { SectConstructionApplicationService } from './SectConstructionApplicationService';
import type { SectEconomyApplicationService } from './SectEconomyApplicationService';
import type { SectMembershipApplicationService } from './SectMembershipApplicationService';
import type { SectTaskApplicationService } from './SectTaskApplicationService';

export interface SectOrganizationServices {
  membership: SectMembershipApplicationService;
  tasks: SectTaskApplicationService;
  economy: SectEconomyApplicationService;
  construction: SectConstructionApplicationService;
  benefits: SectBenefitService;
  getExecutor(): DbExecutor;
}

/** Route-facing composition only; domain decisions remain in the injected services. */
export class SectOrganizationFacade {
  readonly membership: SectMembershipApplicationService;
  readonly tasks: SectTaskApplicationService;
  readonly economy: SectEconomyApplicationService;
  readonly construction: SectConstructionApplicationService;

  constructor(private readonly services: SectOrganizationServices) {
    this.membership = services.membership;
    this.tasks = services.tasks;
    this.economy = services.economy;
    this.construction = services.construction;
  }

  getFacilityBonuses(
    cultivatorId: string,
    q?: DbExecutor | DbTransaction,
  ) {
    return this.services.benefits.getBonuses(
      cultivatorId,
      q ?? this.services.getExecutor(),
    );
  }

  applyCraftDiscount(
    cultivatorId: string,
    cost: number,
    q?: DbExecutor | DbTransaction,
  ) {
    return this.services.benefits.applyCraftDiscount(
      cultivatorId,
      cost,
      q ?? this.services.getExecutor(),
    );
  }
}

export type SectOrganizationFacadeInstance = SectOrganizationFacade;
