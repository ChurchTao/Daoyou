import type {
  BeastAllocateRequest,
  BeastFusionRequest,
  BeastLineupRequestSchema,
  BeastLockSchema,
  BeastPickerQuerySchema,
  BeastPlaceSchema,
  BeastRenameSchema,
  BeastRestSchema,
} from '@daoyou/contracts/beasts';
import { Inject, Injectable } from '@nestjs/common';
import {
  allocateBeastPoints,
  claimStarterBeast,
  fuseOwnedBeasts,
  placeBeast,
  readBeastFusion,
  releaseBeast,
  renameBeast,
  restBeast,
  setBeastLocked,
  updateBeastLineup,
} from '@server/combat/application/CombatV6BeastService.js';
import { DRIZZLE_DATABASE } from '@server/database/database.service.js';
import type { DbClient } from '@server/lib/drizzle/db.js';
import {
  readBeastPickerPage,
  readBeastRoster,
} from '@server/lib/repositories/combatV6BeastRepository.js';
import type { z } from 'zod';

@Injectable()
export class BeastsService {
  constructor(@Inject(DRIZZLE_DATABASE) private readonly database: DbClient) {}

  async read(owner: string) {
    return { success: true, data: await readBeastRoster(owner, this.database) };
  }
  async picker(owner: string, query: z.infer<typeof BeastPickerQuerySchema>) {
    return {
      success: true,
      data: await readBeastPickerPage(owner, query, this.database),
    };
  }
  async fusion(owner: string, requestId: string) {
    return { success: true, data: await readBeastFusion(owner, requestId) };
  }
  async fuse(owner: string, input: BeastFusionRequest) {
    return { success: true, data: await fuseOwnedBeasts(owner, input) };
  }
  async claim(owner: string, speciesId: string) {
    return { success: true, data: await claimStarterBeast(owner, speciesId) };
  }
  async lineup(owner: string, input: z.infer<typeof BeastLineupRequestSchema>) {
    return { success: true, data: await updateBeastLineup(owner, input) };
  }
  async rest(owner: string, input: z.infer<typeof BeastRestSchema>) {
    return {
      success: true,
      data: await restBeast(owner, input.beastId, input.expectedRevision),
    };
  }
  async allocate(owner: string, input: BeastAllocateRequest) {
    return {
      success: true,
      data: await allocateBeastPoints(
        owner,
        input.beastId,
        input.expectedRevision,
        input.points,
      ),
    };
  }
  async rename(owner: string, input: z.infer<typeof BeastRenameSchema>) {
    return {
      success: true,
      data: await renameBeast(
        owner,
        input.beastId,
        input.expectedRevision,
        input.name,
      ),
    };
  }
  async lock(owner: string, input: z.infer<typeof BeastLockSchema>) {
    return {
      success: true,
      data: await setBeastLocked(
        owner,
        input.beastId,
        input.expectedRevision,
        input.isLocked,
      ),
    };
  }
  async release(owner: string, input: z.infer<typeof BeastRestSchema>) {
    return {
      success: true,
      data: await releaseBeast(owner, input.beastId, input.expectedRevision),
    };
  }
  async place(owner: string, input: z.infer<typeof BeastPlaceSchema>) {
    return {
      success: true,
      data: await placeBeast(
        owner,
        input.beastId,
        input.expectedRevision,
        input.location,
      ),
    };
  }
}
