import { YOUDU_COMBAT } from "./youdu-pack";
import { YOUDU_PATHS } from "./youdu-path-pack";
import { SECT_METHODS } from "./method-pack";
import type { SectDefinitionV6 } from "./types";

export const YOUDU_V6_ID = "youdu" as const
export const YOUDU_PATH_ID = {
  SoulJudge: "youdu.path.soul_judge",
  SixPaths: "youdu.path.six_paths",
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
  Sever: "youdu.skill.sever",
  LifeJudge: "youdu.skill.life_judge",
  FinalJudgment: "youdu.skill.final_judgment",
  GhostRift: "youdu.skill.ghost_rift",
  SixPathsRuin: "youdu.skill.six_paths_ruin",
} as const
export const YOUDU_STATUS_ID = {
  Poison: "youdu.status.poison",
  StrongPoison: "youdu.status.strong_poison",
  Slow: "youdu.status.slow",
  SoulSeal: "youdu.status.soul_seal",
  Insight: "youdu.status.insight",
  Rest: "youdu.status.rest",
  NextPhysical: "youdu.status.next_physical",
} as const

export const YOUDU_V6_DEFINITION: SectDefinitionV6 = {
  id: YOUDU_V6_ID,
  name: "幽都",
  methods: SECT_METHODS.youdu,
  skills: YOUDU_COMBAT.baseSkills,
  statuses: YOUDU_COMBAT.statuses,
  paths: YOUDU_PATHS,
}
