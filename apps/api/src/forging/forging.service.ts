import { Injectable } from '@nestjs/common';
import type { ActiveCultivatorRef } from '@server/lib/auth/types.js';
import {
  forgeEquipment,
  readForge,
  readVault,
  withdrawMaterial,
  withdrawVaultPage,
} from '@server/forging/application/ForgingService.js';
import type {
  ForgeRequest,
  VaultQuerySchema,
  WithdrawMaterialSchema,
  WithdrawVaultPageSchema,
} from '@daoyou/shared/contracts/forging';
import type { z } from 'zod';

@Injectable()
export class ForgingService {
  async read(owner: string) {
    return { success: true, data: await readForge(owner) };
  }

  async forge(actor: ActiveCultivatorRef, input: ForgeRequest) {
    return {
      success: true,
      ...(await forgeEquipment(actor.cultivatorId, input, actor.userId)),
    };
  }

  async vault(owner: string, query: z.infer<typeof VaultQuerySchema>) {
    return { success: true, data: await readVault(owner, query) };
  }

  async withdraw(owner: string, input: z.infer<typeof WithdrawMaterialSchema>) {
    return { success: true, ...(await withdrawMaterial(owner, input)) };
  }

  async withdrawPage(
    owner: string,
    input: z.infer<typeof WithdrawVaultPageSchema>,
  ) {
    return { success: true, ...(await withdrawVaultPage(owner, input)) };
  }
}
