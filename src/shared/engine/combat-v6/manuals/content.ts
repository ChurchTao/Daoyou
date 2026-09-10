import { SkillTag, TargetSide } from '../core/index.ts';
import data from './data/manual-pack.json';
import { loadManualPack } from './pack.ts';
import type { CharacterManualDefV1 } from './types.ts';

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
