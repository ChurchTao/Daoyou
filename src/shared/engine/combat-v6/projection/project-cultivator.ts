import { COMBAT_V6_PHASE_5A_VERSIONS } from "../version.ts"
import { projectCultivatorWithEquipmentSpecialToCombatV6 } from "./project-cultivator-with-equipment-special.ts"
import { composeCharacterManuals } from "./compose-character-manuals.ts"
import type { ProjectCultivatorToCombatV6Input, CombatV6ProjectionResult } from "./types.ts"

/** 历史阶段适配器；当前业务使用 projectCharacterToCombatV6。 */
export function projectCultivatorToCombatV6(input: ProjectCultivatorToCombatV6Input): CombatV6ProjectionResult {
  const versions = { ...COMBAT_V6_PHASE_5A_VERSIONS }
  return composeCharacterManuals(input, versions, projectCultivatorWithEquipmentSpecialToCombatV6)
}
