import {
  BODY_CULTIVATION_TRACK_KEYS,
  BODY_CULTIVATION_PACK,
  bodyTrainingLevelCap,
} from '@daoyou/game-content/body-cultivation';
import { bodyCultivationBenefits } from "../../body-cultivation/benefits.js"
import type { BodyCultivationTrackKey } from "@daoyou/game-domain/condition"
import type {
  CharacterPanelV1,
  CombatV6BodyCultivationInput,
  CombatV6ProjectionDiagnostic,
  CombatV6TrainingProjection,
} from '@daoyou/game-domain/combat';

export function compileBodyCultivationV6(
  state: CombatV6BodyCultivationInput,
  characterPanel: CharacterPanelV1,
  pack = BODY_CULTIVATION_PACK,
): CombatV6TrainingProjection {
  const trainingLevelCap = bodyTrainingLevelCap(pack)
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
      levels[key] = Math.min(trainingLevelCap, level)
      if (level > trainingLevelCap) {
        diagnostics.push({
          severity: "warning",
          code: "TRAINING_LEVEL_CLAMPED",
          message: `${key} 的 combat-v6 投影等级已夹取到 ${trainingLevelCap}`,
          path,
        })
      }
    }
  }

  const projection: CombatV6TrainingProjection = {
    ...bodyCultivationBenefits(levels, characterPanel.maxHp, pack),
    diagnostics,
  }

  return projection
}
