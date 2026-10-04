import { createDevCultivatorPatchSchema } from '@daoyou/contracts/dev-tools';
import { createDevGrantSchema } from '@daoyou/contracts/forging';
import { COMPREHENSION_INSIGHT_CAP } from '@daoyou/game-content/cultivation';
import { SPIRITUAL_ROOT_EFFECTIVE_STRENGTH_CAP } from '@daoyou/game-rules/body-cultivation/training';
import { ItemGrantSchema } from '@daoyou/game-rules/inventory';
import { MailAttachmentsSchema } from '@daoyou/game-rules/mail';

export const DevCultivatorPatchSchema = createDevCultivatorPatchSchema({
  comprehensionInsightCap: COMPREHENSION_INSIGHT_CAP,
  spiritualRootStrengthCap: SPIRITUAL_ROOT_EFFECTIVE_STRENGTH_CAP,
});
export const DevGrantSchema = createDevGrantSchema({
  ItemGrantSchema,
  MailAttachmentsSchema,
});
