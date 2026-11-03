import type { SectDefinitionV6 } from '@daoyou/game-domain/combat';
import { SECT_METHODS } from './method-pack.js';
import { XIAOYUE_COMBAT } from './xiaoyue-pack.js';
import { XIAOYUE_PATHS } from './xiaoyue-path-pack.js';

export const XIAOYUE_V6_ID = 'xiaoyue' as const;
export const XIAOYUE_PATH_ID = { Blood: 'xiaoyue.path.blood', Bond: 'xiaoyue.path.bond' } as const;
export const XIAOYUE_METHOD_ID = { Canon: 'xiaoyue.method.canon', Onslaught: 'xiaoyue.method.onslaught', Beast: 'xiaoyue.method.beast', Fury: 'xiaoyue.method.fury', Wing: 'xiaoyue.method.wing', Guard: 'xiaoyue.method.guard' } as const;
export const XIAOYUE_SKILL_ID = {
  Transform: 'xiaoyue.skill.transform', LionStrike: 'xiaoyue.skill.lion_strike', EagleStrike: 'xiaoyue.skill.eagle_strike',
  ChainStrike: 'xiaoyue.skill.chain_strike', ElephantSeal: 'xiaoyue.skill.elephant_seal', Intimidate: 'xiaoyue.skill.intimidate',
  Meditate: 'xiaoyue.skill.meditate', Frenzy: 'xiaoyue.skill.frenzy', ManaBreath: 'xiaoyue.skill.mana_breath',
  DemonUnbound: 'xiaoyue.skill.demon_unbound', BestPartners: 'xiaoyue.skill.best_partners',
} as const;
export const XIAOYUE_STATUS_ID = {
  Transform: 'xiaoyue.status.transform', Rest: 'xiaoyue.status.rest',
  Stun: 'xiaoyue.status.stun', StunPending: 'xiaoyue.status.stun_pending',
  SpellRest: 'xiaoyue.status.spell_rest', SpellRestPending: 'xiaoyue.status.spell_rest_pending',
} as const;

export const XIAOYUE_V6_DEFINITION: SectDefinitionV6 = {
  id: XIAOYUE_V6_ID, name: '百兽崖', methods: SECT_METHODS.xiaoyue,
  skills: XIAOYUE_COMBAT.baseSkills, statuses: XIAOYUE_COMBAT.statuses, paths: XIAOYUE_PATHS,
};
