import { SkillTag, TargetSide } from '@daoyou/combat-core/enums';
import data from './data/manual-pack.json' with { type: 'json' };
import { loadManualPack } from '@daoyou/game-domain/manuals/authoring';
import type { CharacterManualDefV1 } from '@daoyou/game-domain/manuals';

export const MANUAL_PACK = loadManualPack(data);
export const CHARACTER_MANUALS_V1: readonly CharacterManualDefV1[] =
  MANUAL_PACK.manuals.map((manual) => ({
    ...manual,
    skill: {
      id: `${manual.id}.passive`,
      name: manual.name,
      tags: [SkillTag.Passive],
      targeting: { side: TargetSide.Self },
      effects: [],
    },
  }));
export function manualRule(manual: CharacterManualDefV1) {
  return MANUAL_PACK.progressions[manual.progressionId];
}
