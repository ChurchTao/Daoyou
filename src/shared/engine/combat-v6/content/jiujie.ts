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
  Protection: "jiujie.skill.protection",
  Calm: "jiujie.skill.calm",
  Charge: "jiujie.skill.charge",
  Edict: "jiujie.skill.edict",
  SixThunder: "jiujie.skill.six_thunder",
  Insight: "jiujie.skill.insight",
  Absorb: "jiujie.skill.absorb",
  Tribulation: "jiujie.skill.tribulation",
} as const
export const JIUJIE_STATUS_ID = {
  Electric: "jiujie.status.electric",
  Red: "jiujie.status.red",
  Suppress: "jiujie.status.suppress",
  Confuse: "jiujie.status.confuse",
  MillionWeapons: "jiujie.status.million_weapons",
  Guardian: "jiujie.status.guardian",
  RestMinor: "jiujie.status.rest_minor",
  RestMajor: "jiujie.status.rest_major",
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
  if (!electric || electric.kind !== JIUJIE_STATUS_ID.Electric || (electric.maxStacks ?? 1) !== 1 || electric.category !== StatusCategory.Debuff) {
    diagnostics.push({ severity: "error", code: "INVALID_ELECTRIC_STATUS_CONTENT", message: "九劫雷印必须是不可叠层的减益状态" })
  }
  return diagnostics
}
