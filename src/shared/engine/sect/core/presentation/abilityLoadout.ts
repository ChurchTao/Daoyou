import { StandardSectRules, type SectAbilityId, type SectAbilitySlots } from '../domain';

export function createAbilitySlots(
  loadout: readonly (SectAbilityId | null)[],
): SectAbilitySlots {
  return Array.from(
    { length: StandardSectRules.activeAbilitySlotCount },
    (_, index) => loadout[index] ?? null,
  ) as SectAbilitySlots;
}

export function fillFirstEmptyAbilitySlots(
  slots: SectAbilitySlots,
  unlockedAbilityIds: SectAbilityId[],
): SectAbilitySlots {
  const next = createAbilitySlots(slots);
  for (const abilityId of unlockedAbilityIds) {
    if (next.includes(abilityId)) continue;
    const empty = next.indexOf(null);
    if (empty < 0) break;
    next[empty] = abilityId;
  }
  return next;
}
