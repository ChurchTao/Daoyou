import { compileTrainingContent, TRAINING_PACK } from "./pack.js";

export const TRAINING_ENCOUNTER_ID = {
  SingleDummy: "combat.training.encounter.single-dummy",
  SingleSparring: "combat.training.encounter.single-sparring",
  TripleDummy: "combat.training.encounter.triple-dummy",
  SupportRecovery: "combat.training.encounter.support-recovery",
  SupportCleanse: "combat.training.encounter.support-cleanse",
  SupportRevive: "combat.training.encounter.support-revive",
} as const

export const TRAINING_PVE_ID = {
  Dummy: "combat.training.npc.dummy",
  Sparring: "combat.training.npc.sparring",
  WoundedAlly: "combat.training.npc.wounded-ally",
  AfflictedAlly: "combat.training.npc.afflicted-ally",
  Afflicter: "combat.training.npc.afflicter",
  FragileAlly: "combat.training.npc.fragile-ally",
  Executioner: "combat.training.npc.executioner",
} as const

export const TRAINING_PVE_ICONS: ReadonlyMap<string, string> = new Map([
  [TRAINING_PVE_ID.Dummy, 'icon:portrait-training-dummy'],
  [TRAINING_PVE_ID.Sparring, 'icon:portrait-disciple-m'],
  [TRAINING_PVE_ID.WoundedAlly, 'icon:portrait-wanderer-m'],
  [TRAINING_PVE_ID.AfflictedAlly, 'icon:portrait-disciple-f'],
  [TRAINING_PVE_ID.Afflicter, 'icon:portrait-elder-f'],
  [TRAINING_PVE_ID.FragileAlly, 'icon:portrait-wanderer-f'],
  [TRAINING_PVE_ID.Executioner, 'icon:portrait-puppet'],
]);

export const COMBAT_V6_TRAINING_CONTENT_V1 = compileTrainingContent(TRAINING_PACK);
export const COMBAT_V6_TRAINING_COMBATANTS_V1 = COMBAT_V6_TRAINING_CONTENT_V1.combatants;
export const COMBAT_V6_TRAINING_ENCOUNTERS_V1 = COMBAT_V6_TRAINING_CONTENT_V1.encounters;
export const COMBAT_V6_TRAINING_SKILLS_V1 = COMBAT_V6_TRAINING_CONTENT_V1.skills;
export const COMBAT_V6_TRAINING_STATUS_DEFS_V1 = COMBAT_V6_TRAINING_CONTENT_V1.statusDefs;
