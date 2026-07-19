import type { DbExecutor, DbTransaction } from '@server/lib/drizzle/db';
import type { SectRepositoryPort } from '@server/lib/repositories/sectRepository';
import type { SectAbilitySlots, SectRuntime } from '@shared/engine/sect';
import { SectAdmissionApplicationService } from '../SectAdmissionApplicationService';
import { SectTraditionApplicationService } from '../SectTraditionApplicationService';

/** Bridges legacy in-memory test fixtures to the transaction-bound application ports. */
export function createSectTestApplication(args: {
  runtime: SectRuntime;
  repository: SectRepositoryPort;
  methodLevelCap?: number;
}) {
  const bind = (q: DbExecutor | DbTransaction) => {
    const state = {
      load: (cultivatorId: string) =>
        args.repository.loadCultivatorSectState(cultivatorId, q),
      loadForSect: (cultivatorId: string, sectId: string) =>
        args.repository.loadCultivatorSectStateForSect(cultivatorId, sectId, q),
      listMemberships: (cultivatorId: string) =>
        args.repository.listMemberships(cultivatorId, q),
    };
    const resources = {
      load: (cultivatorId: string) =>
        args.repository.loadCultivatorProgress(cultivatorId, q),
      spend: (cultivatorId: string, cost: Parameters<SectRepositoryPort['spendTrainingResources']>[1]) =>
        args.repository.spendTrainingResources(cultivatorId, cost, q as DbTransaction),
      methodLevelCap: async () => args.methodLevelCap ?? 20,
    };
    const admission = new SectAdmissionApplicationService(
      args.runtime,
      {
        ...state,
        findActiveMembership: (cultivatorId) => args.repository.findMembership(cultivatorId, q),
        findMembershipForSect: (cultivatorId, sectId) =>
          args.repository.findMembershipForSect(cultivatorId, sectId, q),
        async recordExperience(cultivatorId, sectId, configVersion) {
          await args.repository.recordExperience(
            cultivatorId,
            sectId,
            configVersion,
            q as DbTransaction,
          );
        },
        activateMembership: (membershipId, definition) =>
          args.repository.activateMembership(membershipId, definition, q as DbTransaction),
        ensureFacilities: async () => undefined,
      },
      resources,
    );
    const tradition = new SectTraditionApplicationService(
      args.runtime,
      {
        ...state,
        setMethodLevel: (membershipId, methodId, level) =>
          args.repository.setMethodLevel(membershipId, methodId, level, q as DbTransaction),
        createPathWithFirstLayer: (membershipId, pathId, tacticId, layerId) =>
          args.repository.createPathWithFirstLayer(
            membershipId,
            pathId,
            tacticId,
            layerId,
            q as DbTransaction,
          ),
        appendUnlockedPathLayer: (membershipId, pathId, layerId, expectedCount) =>
          args.repository.appendUnlockedPathLayer(
            membershipId,
            pathId,
            layerId,
            expectedCount,
            q as DbTransaction,
          ),
        activatePathIfNone: (membershipId, pathId) =>
          args.repository.activatePathIfNone(membershipId, pathId, q as DbTransaction),
        activatePath: (membershipId, pathId) =>
          args.repository.activatePath(membershipId, pathId, q as DbTransaction),
        replaceMeridianLoadout: (membershipId, pathId, slot, nodeIds) =>
          args.repository.replaceMeridianLoadout(
            membershipId,
            pathId,
            slot,
            nodeIds,
            q as DbTransaction,
          ),
        activateMeridianLoadout: (membershipId, pathId, slot) =>
          args.repository.activateMeridianLoadout(
            membershipId,
            pathId,
            slot,
            q as DbTransaction,
          ),
        replaceAbilityLoadout: (membershipId, slots: SectAbilitySlots) =>
          args.repository.replaceAbilityLoadout(membershipId, slots, q as DbTransaction),
        setPathTactic: (membershipId, pathId, tacticId) =>
          args.repository.setPathTactic(membershipId, pathId, tacticId, q as DbTransaction),
      },
      resources,
    );
    return { admission, tradition };
  };
  return {
    listAvailableDefinitions: (context: Parameters<SectAdmissionApplicationService['listAvailableDefinitions']>[0]) =>
      bind({} as DbExecutor).admission.listAvailableDefinitions(context),
    createTrialScenario: (...input: Parameters<SectAdmissionApplicationService['createTrialScenario']>) =>
      bind({} as DbExecutor).admission.createTrialScenario(...input),
    recordExperience: (cultivatorId: string, sectId: string, tx: DbTransaction) =>
      bind(tx).admission.recordExperience(cultivatorId, sectId),
    join: (cultivatorId: string, sectId: string, tx: DbTransaction) =>
      bind(tx).admission.join(cultivatorId, sectId),
    trainMethod: (input: Parameters<SectTraditionApplicationService['trainMethod']>[0], tx: DbTransaction) =>
      bind(tx).tradition.trainMethod(input),
    unlockPathLayer: (input: Parameters<SectTraditionApplicationService['unlockPathLayer']>[0], tx: DbTransaction) =>
      bind(tx).tradition.unlockPathLayer(input),
    activatePath: (cultivatorId: string, pathId: string, tx: DbTransaction) =>
      bind(tx).tradition.activatePath(cultivatorId, pathId),
    setMeridianLoadout: (cultivatorId: string, pathId: string, slot: number, nodeIds: string[], tx: DbTransaction) =>
      bind(tx).tradition.setMeridianLoadout(cultivatorId, pathId, slot, nodeIds),
    activateMeridianLoadout: (cultivatorId: string, pathId: string, slot: number, tx: DbTransaction) =>
      bind(tx).tradition.activateMeridianLoadout(cultivatorId, pathId, slot),
    setAbilityLoadout: (cultivatorId: string, slots: Array<string | null>, tx: DbTransaction) =>
      bind(tx).tradition.setAbilityLoadout(cultivatorId, slots),
    setPathTactic: (cultivatorId: string, pathId: string, tacticId: string, tx: DbTransaction) =>
      bind(tx).tradition.setPathTactic(cultivatorId, pathId, tacticId),
  };
}
