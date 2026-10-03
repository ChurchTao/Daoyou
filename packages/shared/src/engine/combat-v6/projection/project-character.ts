import { COMBAT_V6_CHARACTER_BUILD_VERSIONS } from "../version.ts"
import { projectCharacterEquipment } from "./project-character-equipment.ts"
import { composeCharacterManuals } from "./compose-character-manuals.ts"
import type { CharacterCombatInput, CombatV6ProjectionResult } from "./types.ts"

/** 当前人物完整构筑入口。个人功法、道装和炼体不依赖宗门身份。 */
export function projectCharacterToCombatV6(input: CharacterCombatInput, includeEffectiveAttributes = false): CombatV6ProjectionResult {
  const versions = { ...COMBAT_V6_CHARACTER_BUILD_VERSIONS }
  return composeCharacterManuals(input, versions, (personal) =>
    projectCharacterEquipment(personal, versions, includeEffectiveAttributes), includeEffectiveAttributes)
}
