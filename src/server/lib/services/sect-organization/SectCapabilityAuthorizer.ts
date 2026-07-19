import type {
  CultivatorSectState,
  SectCapabilityKey,
  SectDiscipleRank,
  SectOrganizationModule,
} from '@shared/engine/sect';
import { SectError } from '../SectError';
import type { SectMembershipRecord, SectModuleResolver } from './ports';

type CapabilitySubject = Pick<SectMembershipRecord, 'sectId' | 'discipleRank'> | Pick<
  CultivatorSectState,
  'sectId' | 'discipleRank'
>;

export class SectCapabilityAuthorizer {
  assert(
    subject: CapabilitySubject,
    capability: SectCapabilityKey,
    modules: SectModuleResolver,
  ): void {
    this.assertOrganization(
      modules.require(subject.sectId),
      subject.discipleRank ?? 'registered',
      capability,
    );
  }

  assertOrganization(
    organization: SectOrganizationModule,
    rank: SectDiscipleRank,
    capability: SectCapabilityKey,
  ): void {
    if (organization.capabilities.allows(rank, capability)) return;
    const decision = organization.capabilities.snapshot(rank)[capability];
    throw new SectError(
      'SECT_ORGANIZATION_INVALID',
      decision?.reason ?? '当前弟子职阶尚无此权限',
      403,
    );
  }
}
