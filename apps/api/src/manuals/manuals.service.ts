import { Injectable } from '@nestjs/common';
import {
  mutateManuals,
  readManuals,
} from '@server/combat/application/CombatV6ManualService.js';
import type { ManualActionSchema } from '@daoyou/shared/contracts/combatV6Manuals';
import type { z } from 'zod';

@Injectable()
export class ManualsService {
  async read(owner: string) {
    return { success: true, data: await readManuals(owner) };
  }
  async mutate(owner: string, action: z.infer<typeof ManualActionSchema>) {
    return { success: true, ...(await mutateManuals(owner, action)) };
  }
}
