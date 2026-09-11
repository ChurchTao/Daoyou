import { WUXIANG_COMBAT } from "./wuxiang-pack";
import { WUXIANG_PATHS } from "./wuxiang-path-pack";
import { SECT_METHODS } from "./method-pack";
import type { SectDefinitionV6 } from "./types";

export const WUXIANG_V6_ID = "wuxiang" as const
export const WUXIANG_PATH_ID = {
  Compassion: "wuxiang.path.compassion",
  Wrath: "wuxiang.path.wrath",
} as const
export const WUXIANG_RESOURCE_ID = "wuxiang.resource.mind"
export const WUXIANG_METHOD_ID = {
  Canon: "wuxiang.method.canon",
  Compassion: "wuxiang.method.compassion",
  Guardian: "wuxiang.method.guardian",
  Wrath: "wuxiang.method.wrath",
  Purity: "wuxiang.method.purity",
  Crossing: "wuxiang.method.crossing",
} as const
export const WUXIANG_SKILL_ID = {
  SingleHeal: "wuxiang.skill.single_heal",
  GroupHeal: "wuxiang.skill.group_heal",
  Barrier: "wuxiang.skill.barrier",
  Spell: "wuxiang.skill.spell",
  Purify: "wuxiang.skill.purify",
  Revive: "wuxiang.skill.revive",
  Formless: "wuxiang.skill.formless",
  GreatBarrier: "wuxiang.skill.great_barrier",
  WrathStrike: "wuxiang.skill.wrath_strike",
  FinalSilence: "wuxiang.skill.final_silence",
} as const
export const WUXIANG_STATUS_ID = {
  Formless: "wuxiang.status.formless",
  GreatBarrierGuard: "wuxiang.status.great_barrier_guard",
  MagicGuard: "wuxiang.status.magic_guard",
  ReviveGuard: "wuxiang.status.revive_guard",
  FormlessGuard: "wuxiang.status.formless_guard",
  Rest: "wuxiang.status.rest",
} as const
export const WUXIANG_BARRIER_ID = {
  Guardian: "wuxiang.barrier.guardian",
  Great: "wuxiang.barrier.great",
  Formless: "wuxiang.barrier.formless",
} as const


export const WUXIANG_V6_DEFINITION: SectDefinitionV6 = {
  id: WUXIANG_V6_ID,
  name: "无相禅宗",
  methods: SECT_METHODS.wuxiang,
  skills: WUXIANG_COMBAT.baseSkills,
  statuses: WUXIANG_COMBAT.statuses,
  paths: WUXIANG_PATHS,
}
