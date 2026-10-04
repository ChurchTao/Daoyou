import { HttpException, Injectable } from '@nestjs/common';
import type { ActiveCultivatorRef } from '@server/lib/auth/types.js';
import {
  abandonIdentityReshape,
  confirmIdentityReshape,
  generateIdentityReshape,
  getIdentityReshapeSession,
  getIdentityReshapeTalismanCount,
  saveIdentityReshapeDraft,
  startIdentityReshape,
} from '@server/reshape/application/IdentityReshapeService.js';
import { toPlayerStateMutationResponse } from '@server/player/application/state/ResourceMutationResponse.js';
import { IDENTITY_RESHAPE_DESCRIPTION_MAX_LENGTH, IDENTITY_RESHAPE_DESCRIPTION_MIN_LENGTH } from '@daoyou/game-content/identity-reshape';
import { z } from 'zod';
const AnswerSchema = z.object({
  questionId: z.string().min(1).max(80),
  optionId: z.string().min(1).max(20),
});
const DraftSchema = z.object({
  answers: z.array(AnswerSchema).max(3),
  description: z.string().trim().max(IDENTITY_RESHAPE_DESCRIPTION_MAX_LENGTH),
});
const GenerateSchema = DraftSchema.extend({
  answers: z.array(AnswerSchema).length(3),
  description: z
    .string()
    .trim()
    .min(IDENTITY_RESHAPE_DESCRIPTION_MIN_LENGTH)
    .max(IDENTITY_RESHAPE_DESCRIPTION_MAX_LENGTH),
});
@Injectable()
export class IdentityReshapeService {
  async read(actor: ActiveCultivatorRef) {
    const [session, talismanCount] = await Promise.all([
      getIdentityReshapeSession(actor.cultivatorId),
      getIdentityReshapeTalismanCount(actor.cultivatorId),
    ]);
    return { success: true, data: { session, talismanCount } };
  }
  async start(actor: ActiveCultivatorRef) {
    const result = await startIdentityReshape({
      userId: actor.userId,
      cultivatorId: actor.cultivatorId,
    });
    if (result.committed)
      return toPlayerStateMutationResponse({
        ...result.committed,
        result: {
          session: result.session,
          talismanCount: result.talismanCount,
        },
      });
    return {
      success: true,
      data: { session: result.session, talismanCount: result.talismanCount },
    };
  }
  async draft(actor: ActiveCultivatorRef, input: unknown) {
    const parsed = DraftSchema.safeParse(input);
    if (!parsed.success)
      throw new HttpException(
        { success: false, error: '问答草稿格式错误' },
        400,
      );
    const session = await saveIdentityReshapeDraft({
      cultivatorId: actor.cultivatorId,
      ...parsed.data,
    });
    return { success: true, data: { session } };
  }
  async generate(actor: ActiveCultivatorRef, input: unknown) {
    const parsed = GenerateSchema.safeParse(input);
    if (!parsed.success)
      throw new HttpException(
        { success: false, error: '请完成问答并填写身世描述' },
        400,
      );
    const session = await generateIdentityReshape({
      cultivatorId: actor.cultivatorId,
      ...parsed.data,
    });
    return { success: true, data: { session } };
  }
  async confirm(actor: ActiveCultivatorRef) {
    return toPlayerStateMutationResponse(
      await confirmIdentityReshape({
        userId: actor.userId,
        cultivatorId: actor.cultivatorId,
      }),
    );
  }
  async abandon(actor: ActiveCultivatorRef) {
    await abandonIdentityReshape(actor.cultivatorId);
    return { success: true };
  }
}
