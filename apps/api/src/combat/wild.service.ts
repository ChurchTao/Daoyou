import { Injectable } from '@nestjs/common';
import type { ActiveCultivatorRef } from '@server/lib/auth/types.js';
import { toPlayerStateMutationResponse } from '@server/player/application/state/ResourceMutationResponse.js';
import { wildSessions } from '@server/combat/application/CombatV6WildSessionService.js';
import type { CombatV6TrainingCommandRequestSchema } from '@daoyou/shared/contracts/combatV6';
import type { WildExploreRequestSchema } from '@daoyou/shared/contracts/combatV6Wild';
import type { z } from 'zod';

@Injectable()
export class WildService {
  async region(actor: ActiveCultivatorRef, nodeId: string) {
    return { success: true, data: await wildSessions.region(actor, nodeId) };
  }
  async explore(
    actor: ActiveCultivatorRef,
    input: z.infer<typeof WildExploreRequestSchema>,
  ) {
    return toPlayerStateMutationResponse(
      await wildSessions.explore(actor, input.nodeId, input.requestId),
    );
  }
  async start(actor: ActiveCultivatorRef, encounterId: string) {
    return {
      success: true,
      data: await wildSessions.start(actor, encounterId),
    };
  }
  async current(actor: ActiveCultivatorRef) {
    return { success: true, data: await wildSessions.current(actor) };
  }
  async read(actor: ActiveCultivatorRef, id: string, after: number) {
    return { success: true, data: await wildSessions.get(actor, id, after) };
  }
  async submit(
    actor: ActiveCultivatorRef,
    id: string,
    unitId: string,
    input: z.infer<typeof CombatV6TrainingCommandRequestSchema>,
  ) {
    return {
      success: true,
      data: await wildSessions.submit(
        actor,
        id,
        input.expectedRevision,
        unitId,
        input.commands,
      ),
    };
  }
  async resolve(
    actor: ActiveCultivatorRef,
    id: string,
    revision: number,
    round?: number,
  ) {
    return {
      success: true,
      data: await wildSessions.resolve(actor, id, revision, round),
    };
  }
  async abandon(actor: ActiveCultivatorRef, id: string, revision: number) {
    return {
      success: true,
      data: await wildSessions.abandon(actor, id, revision),
    };
  }
}
