import { JIUJIE_COMBAT } from "./jiujie-pack";
import { JIUJIE_PATHS } from "./jiujie-path-pack";
import { SECT_METHODS } from "./method-pack";
import { StatusCategory } from "../core/index.ts"
import type { CombatV6ProjectionDiagnostic } from "../projection/types.ts"
import type { SectDefinitionV6 } from "./types.ts"

export const JIUJIE_V6_ID = "jiujie" as const
export const JIUJIE_PATH_ID = {
  Law: "jiujie.path.law",
  Thunder: "jiujie.path.thunder",
} as const
export const JIUJIE_METHOD_ID = {
  Canon: "jiujie.method.canon",
  Seal: "jiujie.method.seal",
  Thunder: "jiujie.method.thunder",
  Guardian: "jiujie.method.guardian",
  Pride: "jiujie.method.pride",
  Cloud: "jiujie.method.cloud",
} as const
export const JIUJIE_SKILL_ID = {
  Thunderstorm: "jiujie.skill.thunderstorm",
  FiveThunder: "jiujie.skill.five_thunder",
  ThunderSlash: "jiujie.skill.thunder_slash",
  Suppress: "jiujie.skill.suppress",
  Confuse: "jiujie.skill.confuse",
  MillionWeapons: "jiujie.skill.million_weapons",
  DivineGuardian: "jiujie.skill.divine_guardian",
  HeavenlyPrison: "jiujie.skill.heavenly_prison",
  StartlingThunder: "jiujie.skill.startling_thunder",
  NineHeavensThunder: "jiujie.skill.nine_heavens_thunder",
} as const
export const JIUJIE_STATUS_ID = {
  Electric: "jiujie.status.electric",
  Suppress: "jiujie.status.suppress",
  Confuse: "jiujie.status.confuse",
  ConfuseWeaken: "jiujie.status.confuse_weaken",
  MillionWeapons: "jiujie.status.million_weapons",
  MillionWeaponsWeaken: "jiujie.status.million_weapons_weaken",
  MagicDefBreak: "jiujie.status.magic_def_break",
  MagicDefBreakStrong: "jiujie.status.magic_def_break_strong",
  Guardian: "jiujie.status.guardian",
} as const
export const JIUJIE_MECHANIC_ID = {
  Detonate: "jiujie.mechanic.electric_detonate",
} as const

export const JIUJIE_V6_DEFINITION: SectDefinitionV6 = {
  id: JIUJIE_V6_ID,
  name: "九劫天宫",
  methods: SECT_METHODS.jiujie,
  skills: JIUJIE_COMBAT.baseSkills,
  statuses: JIUJIE_COMBAT.statuses,
  paths: JIUJIE_PATHS,
}

export function validateJiujieContentV1(): CombatV6ProjectionDiagnostic[] {
  const diagnostics: CombatV6ProjectionDiagnostic[] = []
  const electric = JIUJIE_V6_DEFINITION.statuses.find((status) => status.id === JIUJIE_STATUS_ID.Electric)
  if (!electric || electric.kind !== JIUJIE_STATUS_ID.Electric || electric.maxStacks !== 3 || electric.category !== StatusCategory.Debuff) {
    diagnostics.push({ severity: "error", code: "INVALID_ELECTRIC_STATUS_CONTENT", message: "九劫电芒必须是三层协同减益状态" })
  }
  return diagnostics
}
