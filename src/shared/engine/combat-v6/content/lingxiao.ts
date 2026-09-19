import { LINGXIAO_COMBAT } from "./lingxiao-pack";
import { LINGXIAO_PATHS } from "./lingxiao-path-pack";
import { SECT_METHODS } from "./method-pack";
import type { SectDefinitionV6 } from "./types";

export const LINGXIAO_V6_ID = "lingxiao" as const
export const LINGXIAO_PATH_ID = {
  Zhanchen: "lingxiao.path.zhanchen",
  Guiyi: "lingxiao.path.guiyi",
} as const
export const LINGXIAO_RESOURCE_ID = "lingxiao.resource.sword_intent"

export const LINGXIAO_METHOD_ID = {
  Canon: "lingxiao.method.canon",
  SwordAura: "lingxiao.method.sword_aura",
  Waiting: "lingxiao.method.waiting",
  Shadow: "lingxiao.method.shadow",
  Formation: "lingxiao.method.formation",
  Clarity: "lingxiao.method.clarity",
} as const

export const LINGXIAO_SKILL_ID = {
  Triple: "lingxiao.skill.triple",
  Waiting: "lingxiao.skill.waiting",
  Formation: "lingxiao.skill.formation",
  SwordAura: "lingxiao.skill.sword_aura",
  Clarity: "lingxiao.skill.clarity",
  Confuse: "lingxiao.skill.confuse",
  BloodStrike: "lingxiao.skill.blood_strike",
  ZhanchenUltimate: "lingxiao.skill.zhanchen_ultimate",
  ShadowStrike: "lingxiao.skill.shadow_strike",
  GuiyiUltimate: "lingxiao.skill.guiyi_ultimate",
} as const


export const LINGXIAO_V6_DEFINITION: SectDefinitionV6 = {
  id: LINGXIAO_V6_ID,
  name: "红尘剑宗",
  methods: SECT_METHODS.lingxiao,
  skills: LINGXIAO_COMBAT.baseSkills,
  statuses: LINGXIAO_COMBAT.statuses,
  paths: LINGXIAO_PATHS,
}
