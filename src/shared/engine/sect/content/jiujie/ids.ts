import { GameplayTags } from '@shared/engine/shared/tag-domain';

export const JIUJIE_SECT_ID = 'jiujie';
export const JIUJIE_CALAMITY = 'sect.jiujie.calamity';
export const JIUJIE_THUNDER = 'sect.jiujie.thunder';
export const JIUJIE_DEBT = 'sect.jiujie.debt';
export const JIUJIE_EYE = 'sect.jiujie.eye';
export const JIUJIE_RECEIVE = 'sect.jiujie.receive-calamity';
export const JIUJIE_BEHELD = 'sect.jiujie.beheld';
export const JIUJIE_REOFFEND = 'sect.jiujie.reoffend';
export const JIUJIE_SIN_DAMAGE = 'sect.jiujie.sin.damage';
export const JIUJIE_SIN_SUPPORT = 'sect.jiujie.sin.support';
export const JIUJIE_SIN_CONTROL = 'sect.jiujie.sin.control';
export const JIUJIE_CRIME_LOCK = 'sect.jiujie.crime-lock';
export const JIUJIE_PENDING_TRIAL = 'sect.jiujie.pending-trial';
export const JIUJIE_FIRST_CRIME_READY = 'sect.jiujie.first-crime-ready';
export const JIUJIE_SETTLEMENT_REOPEN_LOCK = 'sect.jiujie.settlement-reopen-lock';
export const JIUJIE_SETTLEMENT_REOPEN_READY = 'sect.jiujie.settlement-reopen-ready';
export const JIUJIE_DAMAGE_SENTENCE = 'sect.jiujie.sentence.damage';
export const JIUJIE_SUPPORT_SENTENCE = 'sect.jiujie.sentence.support';
export const JIUJIE_CONTROL_SENTENCE = 'sect.jiujie.sentence.control';
export const JIUJIE_CONTROL_OWNER_SENTENCE = 'sect.jiujie.sentence.control-owner';
export const JIUJIE_DAMAGE_PUNISHMENT = 'sect.jiujie.punishment.damage';
export const JIUJIE_SUPPORT_PUNISHMENT = 'sect.jiujie.punishment.support';
export const JIUJIE_CONTROL_TARGET_PUNISHMENT = 'sect.jiujie.punishment.control-target';
export const JIUJIE_CONTROL_OWNER_PUNISHMENT = 'sect.jiujie.punishment.control-owner';
export const JIUJIE_TWO_POINT_SETTLEMENT = 'sect.jiujie.settlement.two-point-full-debt';
export const JIUJIE_THREE_POINT_SETTLEMENT = 'sect.jiujie.settlement.three-point-full-debt';
export const JIUJIE_FULL_SPEND_SETTLEMENT = 'sect.jiujie.settlement.full-spend';

export const JIUJIE_OPENING_SHIELD_MEMORY = 'sect.jiujie.memory.opening-shield';
export const JIUJIE_BORROW_SHIELD_MEMORY = 'sect.jiujie.memory.borrow-shield';
export const JIUJIE_EYE_HIT_COUNTER = 'sect.jiujie.counter.eye-hit';
export const JIUJIE_QUIET_ROUND_COUNTER = 'sect.jiujie.counter.quiet-round';
export const JIUJIE_BASIC_CHAIN_COUNTER = 'sect.jiujie.counter.basic-chain';
export const JIUJIE_CRIME_LOCK_LOG = 'sect.jiujie.log.crime-lock';
export const JIUJIE_PENDING_TRIAL_LOG = 'sect.jiujie.log.pending-trial';
export const JIUJIE_BASIC_CHAIN_LOG = 'sect.jiujie.log.basic-chain';

export const JIUJIE_EYE_PATH_ID = 'calamity-eye';
export const JIUJIE_CONDEMNATION_PATH_ID = 'heavenly-condemnation';

export const jiujieTag = (id: string) =>
  GameplayTags.BUFF.SECT.namespace(JIUJIE_SECT_ID, id);

export const jiujieAbilityTag = (id: string) =>
  GameplayTags.ABILITY.SECT.ability(JIUJIE_SECT_ID, id);
