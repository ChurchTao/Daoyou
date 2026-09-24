import { YOUDU_COMBAT } from "./youdu-pack";
import { YOUDU_PATHS } from "./youdu-path-pack";
import { SECT_METHODS } from "./method-pack";
import type { SectDefinitionV6 } from "./types";

export const YOUDU_V6_ID = "youdu" as const
export const YOUDU_PATH_ID = {
  SoulJudge: "youdu.path.soul_judge",
  PoisonMaster: "youdu.path.poison_master",
} as const
export const YOUDU_METHOD_ID = {
  Canon: "youdu.method.canon",
  Judge: "youdu.method.judge",
  Wither: "youdu.method.wither",
  Shadow: "youdu.method.shadow",
  Asura: "youdu.method.asura",
  Insight: "youdu.method.insight",
} as const
export const YOUDU_SKILL_ID = {
  Edict: "youdu.skill.edict",
  Wither: "youdu.skill.wither",
  Pursuit: "youdu.skill.pursuit",
  SoulSeal: "youdu.skill.soul_seal",
  Insight: "youdu.skill.insight",
  Judge: "youdu.skill.judge",
  Revival: "youdu.skill.revival",
  Dispel: "youdu.skill.dispel",
  Stealth: "youdu.skill.stealth",
  Siphon: "youdu.skill.siphon",
  BloodShadow: "youdu.skill.blood_shadow",
  GhostSwarm: "youdu.skill.ghost_swarm",
  PoisonShroud: "youdu.skill.poison_shroud",
  Pardonless: "youdu.skill.pardonless",
  SoulChase: "youdu.skill.soul_chase",
  LifeAndDeath: "youdu.skill.life_and_death",

} as const
export const YOUDU_STATUS_ID = {
  Poison: "youdu.status.poison",
  StrongPoison: "youdu.status.strong_poison",
  Slow: "youdu.status.slow",
  SoulSeal: "youdu.status.soul_seal",
  Insight: "youdu.status.insight",
  Revival: "youdu.status.revival",
  Stealth: "youdu.status.stealth",
} as const

export const YOUDU_V6_DEFINITION: SectDefinitionV6 = {
  id: YOUDU_V6_ID,
  name: "幽都",
  methods: SECT_METHODS.youdu,
  skills: YOUDU_COMBAT.baseSkills,
  statuses: YOUDU_COMBAT.statuses,
  paths: YOUDU_PATHS,
}
