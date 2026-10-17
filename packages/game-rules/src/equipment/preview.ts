import {
  DAO_EQUIPMENT_ARTS_V1,
  DAO_EQUIPMENT_ESSENCES_V1,
} from '@daoyou/game-content/equipment/special';
import type {
  DaoEquipmentInstanceV1,
  DaoEquipmentLoadoutV1,
} from '@daoyou/game-domain/equipment';
import { DAO_RAGE_RESOURCE_ID } from '@daoyou/game-domain/equipment';
import { compileDaoEquipmentSpecialLoadoutV1 } from './compiler.js';

type PreviewInput = { equipment: DaoEquipmentLoadoutV1; level: number };
/** Compare owned equipment facts and effective special abilities without a write. */
export function previewEquipmentReplacement(
  input: PreviewInput,
  candidate: DaoEquipmentInstanceV1,
) {
  const nextEquipment = { ...input.equipment, [candidate.slot]: candidate };
  const oldSpecial = compileDaoEquipmentSpecialLoadoutV1(
    input.equipment,
    input.level,
  );
  const newSpecial = compileDaoEquipmentSpecialLoadoutV1(
    nextEquipment,
    input.level,
  );
  if (!oldSpecial.ok || !newSpecial.ok) {
    const failed = !newSpecial.ok ? newSpecial : oldSpecial;
    const diagnostics = failed.ok
      ? failed.projection.diagnostics
      : failed.diagnostics;
    return {
      ok: false as const,
      reason: diagnostics
        .filter((d) => d.severity === 'error')
        .map((d) => d.message)
        .join('；'),
    };
  }
  const old = oldSpecial.projection,
    next = newSpecial.projection;
  const essenceCount = (equipment: DaoEquipmentLoadoutV1, id: string) =>
    Object.values(equipment).filter((e) => e?.essenceIds.includes(id)).length;
  const essences = DAO_EQUIPMENT_ESSENCES_V1.flatMap((def) => {
    const count = (equipment: DaoEquipmentLoadoutV1) => {
      const n = essenceCount(equipment, def.id);
      return def.stackPolicy === 'stack' ? n : Math.min(1, n);
    };
    const a = count(input.equipment),
      b = count(nextEquipment);
    return a === b
      ? []
      : [
          {
            id: def.id,
            name: def.name,
            before: a,
            after: b,
            description: def.description,
            stackable: def.stackPolicy === 'stack',
          },
        ];
  });
  const cost = (projection: typeof old, id: string) => {
    const def = DAO_EQUIPMENT_ARTS_V1.find((d) => d.id === id)!;
    const skill =
      projection.skillOverrides.find((s) => s.id === def.skill.id) ?? def.skill;
    return Number(
      skill.resourceCosts?.find((c) => c.resourceId === DAO_RAGE_RESOURCE_ID)
        ?.amount ?? 0,
    );
  };
  const arts = DAO_EQUIPMENT_ARTS_V1.flatMap((def) => {
    const a = old.grantedArtIds.includes(def.id),
      b = next.grantedArtIds.includes(def.id);
    const beforeCost = a ? cost(old, def.id) : undefined;
    const afterCost = b ? cost(next, def.id) : undefined;
    return a === b && beforeCost === afterCost
      ? []
      : [
          {
            id: def.id,
            name: def.name,
            before: a,
            after: b,
            beforeCost,
            afterCost,
            description: def.description,
          },
        ];
  });

  return {
    ok: true as const,
    previous: input.equipment[candidate.slot],
    essences,
    arts,
    beforeEssenceIds: old.effectiveEssenceIds,
    beforeArtIds: old.grantedArtIds,
    rageGain:
      old.rageGainFactor !== next.rageGainFactor
        ? { before: old.rageGainFactor, after: next.rageGainFactor }
        : undefined,
  };
}
export type EquipmentReplacementPreview = Extract<
  ReturnType<typeof previewEquipmentReplacement>,
  { ok: true }
>;

/** Each displayed row compares like-for-like equipment facts, never character totals. */
export function equipmentRollDifference(
  current: ReadonlyArray<{ attr: string; value: number }>,
  previous: ReadonlyArray<{ attr: string; value: number }> | undefined,
  attr: string,
) {
  const sum = (rows: ReadonlyArray<{ attr: string; value: number }>) =>
    rows.filter((r) => r.attr === attr).reduce((n, r) => n + r.value, 0);
  return sum(current) - sum(previous ?? []);
}
