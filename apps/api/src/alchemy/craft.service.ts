import { HttpException, Injectable } from '@nestjs/common';
import type { ActiveCultivatorRef } from '@server/lib/auth/types.js';
import { assertAlchemyMaterialVersions } from '@server/alchemy/application/inventory/AlchemyInventory.js';
import { previewFormulaCraft } from '@server/alchemy/application/AlchemyFormulaService.js';
import { previewAlchemySelection } from '@server/alchemy/application/alchemyServiceV2.js';
import { executeCraftCommand } from '@server/forging/application/CraftApplicationService.js';
import { readCraftReadinessFacts } from '@server/cultivator/facts.js';
import { getPlayerPreHeavenFates } from '@server/cultivator/application/readers/CultivatorProfileRepository.js';
import { toPlayerStateMutationResponse } from '@server/player/application/state/ResourceMutationResponse.js';
import type { z } from 'zod';
import type { CraftCommandSchema, CraftSchema } from './alchemy-input.js';

@Injectable()
export class CraftService {
  async preview(
    actor: ActiveCultivatorRef,
    input: z.infer<typeof CraftSchema>,
  ) {
    const owner = actor.cultivatorId;
    await assertAlchemyMaterialVersions(
      owner,
      input.materialIds,
      input.materialVersions,
    );
    const [facts, fates] = await Promise.all([
      readCraftReadinessFacts(owner),
      getPlayerPreHeavenFates(actor.userId, owner),
    ]);
    if (input.alchemyMode === 'formula' && !input.formulaId)
      throw new HttpException({ error: '请选择丹方' }, 400);
    const data =
      input.alchemyMode === 'formula'
        ? await previewFormulaCraft(
            owner,
            input.formulaId!,
            input.materialIds,
            facts.spiritStones,
            fates ?? [],
            input.materialQuantities,
          )
        : await previewAlchemySelection(
            owner,
            facts.spiritStones,
            input.materialIds,
            fates ?? [],
            input.materialQuantities,
          );
    return { success: true, data };
  }

  async execute(
    actor: ActiveCultivatorRef,
    input: z.infer<typeof CraftCommandSchema>,
  ) {
    return toPlayerStateMutationResponse(
      await executeCraftCommand({
        userId: actor.userId,
        cultivatorId: actor.cultivatorId,
        input,
      }),
    );
  }
}
