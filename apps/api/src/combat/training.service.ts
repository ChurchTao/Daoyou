import type {
  CombatV6TrainingCommandRequestSchema,
  CombatV6TrainingCreateRequest,
} from '@daoyou/contracts/combat';
import { Inject, Injectable } from '@nestjs/common';
import {
  COMBAT_V6_TRAINING_CONTENT_VIEW,
  CombatV6TrainingSessionService,
} from '@server/combat/application/CombatV6TrainingSessionService.js';
import type { ActiveCultivatorRef } from '@server/lib/auth/types.js';
import type { z } from 'zod';

@Injectable()
export class TrainingService {
  constructor(
    @Inject(CombatV6TrainingSessionService)
    private readonly sessions: CombatV6TrainingSessionService,
  ) {}

  content() {
    return { success: true, data: COMBAT_V6_TRAINING_CONTENT_VIEW };
  }
  async current(actor: ActiveCultivatorRef, after: number) {
    return {
      success: true,
      data: await this.sessions.current(actor, after),
    };
  }
  async create(
    actor: ActiveCultivatorRef,
    input: CombatV6TrainingCreateRequest,
  ) {
    return {
      success: true,
      data: await this.sessions.create(actor, input.encounterId, input.tier),
    };
  }
  async read(actor: ActiveCultivatorRef, id: string, after: number) {
    return {
      success: true,
      data: await this.sessions.get(actor, id, after),
    };
  }
  async submit(
    actor: ActiveCultivatorRef,
    id: string,
    unitId: string,
    input: z.infer<typeof CombatV6TrainingCommandRequestSchema>,
  ) {
    return {
      success: true,
      data: await this.sessions.submit(
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
      data: await this.sessions.resolve(actor, id, revision, round),
    };
  }
  async abandon(actor: ActiveCultivatorRef, id: string, revision: number) {
    return {
      success: true,
      data: await this.sessions.abandon(actor, id, revision),
    };
  }
  async trace(actor: ActiveCultivatorRef, id: string) {
    return {
      success: true,
      data: await this.sessions.trace(actor, id),
    };
  }
}
