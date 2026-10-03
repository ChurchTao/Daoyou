import { type DbTransaction } from '@server/lib/drizzle/db.js';
import * as organizationRepository from '@server/lib/repositories/sectOrganizationRepository.js';
import type { DomainEventEnvelope } from '@daoyou/shared/contracts/domainEvents';
import type { ResourceChangeDescriptor } from '@daoyou/shared/contracts/resources';
import type { SectInfrastructureData } from '@daoyou/shared/contracts/sect';
import { applySectFacilityConstruction } from '@daoyou/shared/engine/sect';
import { productionSectRuntime } from '@daoyou/shared/engine/sect/content';
import { mapFacilities } from '@server/sects/organization/applicationSupport.js';

export async function projectSectConstructionDonation(
  event: DomainEventEnvelope<'sect.construction.donated'>,
  tx: DbTransaction,
) {
  const payload = event.data;
  const organization = productionSectRuntime.registry.require(
    payload.sectId,
  ).organization;
  const definition = organization.construction.facilities.find(
    (facility) => facility.key === payload.facilityKey,
  );
  if (!definition || !definition.upgradeable)
    throw new Error(`宗门建设消息设施配置无效: ${payload.facilityKey}`);

  const facility = await organizationRepository.lockSectFacility(
    payload.sectId,
    payload.facilityKey,
    tx,
  );
  if (!facility)
    throw new Error(`宗门建设消息设施不存在: ${payload.facilityKey}`);

  if (facility.level >= definition.maxLevel) {
    return {
      result: { status: 'facility_maxed' },
      resourceChanges: [],
    };
  }

  const construction = applySectFacilityConstruction({
    level: facility.level,
    progress: facility.progress,
    maxLevel: definition.maxLevel,
    upgradeable: definition.upgradeable,
    constructionPoints: payload.constructionPoints,
    upgradeTarget: organization.construction.upgradeTarget.bind(
      organization.construction,
    ),
  });
  const saved = await organizationRepository.saveSectFacilityConstruction(
    payload.sectId,
    payload.facilityKey,
    construction.level,
    construction.progress,
    tx,
  );
  if (!saved)
    throw new Error(`宗门建设设施状态更新失败: ${payload.facilityKey}`);

  const infrastructure: SectInfrastructureData = {
    facilities: mapFacilities(
      await organizationRepository.listSectFacilities(payload.sectId, tx),
      organization,
    ),
  };
  return {
    result: { status: 'applied' },
    resourceChanges: [
      {
        scope: { kind: 'sect', id: payload.sectId },
        resourceTopic: 'sect.infrastructure',
        eventType: 'sect.facility_construction_changed',
        operation: 'replace',
        payload: infrastructure,
      },
    ] satisfies ResourceChangeDescriptor[],
  };
}
