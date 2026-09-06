import { BODY_CULTIVATION_TRACK_KEYS } from "@shared/lib/bodyCultivation/config"
import type { BodyCultivationTrackKey } from "@shared/types/condition"
import type { CharacterPanelV1 } from "./character-panel-v1.ts"
import type {
  CombatV6BodyCultivationInput,
  CombatV6ProjectionDiagnostic,
  CombatV6TrainingProjection,
} from "./types.ts"

const TRAINING_LEVEL_CAP = 60

export function compileBodyCultivationV6(
  state: CombatV6BodyCultivationInput,
  characterPanel: CharacterPanelV1,
): CombatV6TrainingProjection {
  const diagnostics: CombatV6ProjectionDiagnostic[] = []
  const levels = Object.fromEntries(
    BODY_CULTIVATION_TRACK_KEYS.map((key) => [key, 0]),
  ) as Record<BodyCultivationTrackKey, number>

  if (state) {
    for (const key of BODY_CULTIVATION_TRACK_KEYS) {
      const rawLevel = state.tracks?.[key]?.level
      const path = `cultivator.condition.tracks.bodyCultivation.tracks.${key}.level`
      if (!Number.isFinite(rawLevel) || (rawLevel ?? -1) < 0) {
        diagnostics.push({
          severity: "error",
          code: "INVALID_TRAINING_LEVEL",
          message: `${key} 等级必须是有限非负数`,
          path,
        })
        continue
      }

      const level = Math.floor(rawLevel!)
      levels[key] = Math.min(TRAINING_LEVEL_CAP, level)
      if (level > TRAINING_LEVEL_CAP) {
        diagnostics.push({
          severity: "warning",
          code: "TRAINING_LEVEL_CLAMPED",
          message: `${key} 的 combat-v6 投影等级已夹取到 ${TRAINING_LEVEL_CAP}`,
          path,
        })
      }
    }
  }

  const lifeFoundationLevel = levels.qi_blood
  const projection: CombatV6TrainingProjection = {
    attackCultivate: levels.sinew_bone,
    defenseCultivate: levels.skin,
    spellCultivate: levels.organs,
    resistSpellCultivate: levels.primordial_spirit,
    lifeFoundationLevel,
    maxHpBonus: Math.floor(
      characterPanel.maxHp * lifeFoundationLevel * 0.005,
    ),
    healPowerBonus: Math.floor(lifeFoundationLevel / 2),
    diagnostics,
  }

  return projection
}
