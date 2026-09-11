import { COMBAT_V6_PHASE_6A_VERSIONS } from "../version.ts"
import { projectCultivatorWithEquipmentSpecialInternal } from "./project-cultivator-with-equipment-special.ts"
import { composeCharacterManuals } from "./compose-character-manuals.ts"
import type { ProjectCultivatorMultiSectToCombatV6Input, CombatV6ProjectionResult } from "./types.ts"

/** 历史阶段适配器；当前业务使用 projectCharacterToCombatV6。 */
export function projectCultivatorMultiSectToCombatV6(input: ProjectCultivatorMultiSectToCombatV6Input): CombatV6ProjectionResult {
  const versions = { ...COMBAT_V6_PHASE_6A_VERSIONS }
  return composeCharacterManuals(input, versions, (personal) => projectCultivatorWithEquipmentSpecialInternal(personal, versions, "two-sects"))
}
