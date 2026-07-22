export const YOUDU_SECT_ID = 'youdu';
export const YOUDU_SOUL_FIRE = 'sect.youdu.soul-fire';

export const YOUDU_SOUL_EROSION = 'sect.youdu.soul-erosion';
export const YOUDU_SOUL_LOST = 'sect.youdu.soul-lost';
export const YOUDU_RETURNING_SOUL = 'sect.youdu.returning-soul';
export const YOUDU_FORGETFUL_RIVER = 'sect.youdu.forgetful-river';
export const YOUDU_SOUL_PINNING_NAIL = 'sect.youdu.soul-pinning-nail';
export const YOUDU_NO_RETURN = 'sect.youdu.no-return';
export const YOUDU_SHADOW_REVEALED = 'sect.youdu.shadow-revealed';

export const YOUDU_TIDE_PATH_ID = 'tide';
export const YOUDU_DECREE_PATH_ID = 'decree';

export const YOUDU_VISIBLE_ABILITY_IDS = [
  'one-sigh',
  'soul-severing-call',
  'reveal-shadow',
  'forgetful-river-tide',
  'seize-soul',
  'pin-soul',
  'soul-shall-not-return',
] as const;

export const youduAbilityTag = (abilityId: string) =>
  GameplayTags.ABILITY.SECT.ability(YOUDU_SECT_ID, abilityId);
import { GameplayTags } from '@shared/engine/shared/tag-domain';

