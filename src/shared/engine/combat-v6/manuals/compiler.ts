import { REALM_VALUES, type RealmType } from '@shared/types/constants';
import type {
  CombatV6ProjectionDiagnostic,
  CultivatorBaseCombatInput,
} from '../projection/types.ts';
import { CHARACTER_MANUALS_V1, manualRule } from './content.ts';
import { MANUAL_REALMS } from './pack.ts';
import type {
  CharacterManualDefV1,
  CharacterManualProjectionV1,
  CompileCharacterManualsV1Result,
  CultivatorManualStateV1,
  ManualSlotV1,
} from './types.ts';

export const MAX_MANUALS_PER_SLOT = 3;

export function getManualSlotCount(realm: RealmType): number {
  return Math.min(4, REALM_VALUES.indexOf(realm) + 1);
}
export function isManualSlotV1(value: number): value is ManualSlotV1 {
  return Number.isInteger(value) && value >= 1 && value <= 4;
}
export function manualSlot(definition: CharacterManualDefV1): ManualSlotV1 {
  return (MANUAL_REALMS.indexOf(definition.realm) + 1) as ManualSlotV1;
}
export function validateManualStateV1(
  state: CultivatorManualStateV1,
  realm: RealmType,
  definitions: readonly CharacterManualDefV1[] = CHARACTER_MANUALS_V1,
): CombatV6ProjectionDiagnostic[] {
  const diagnostics: CombatV6ProjectionDiagnostic[] = [];
  const fail = (message: string) =>
    diagnostics.push({
      severity: 'error',
      code: 'INVALID_MANUAL_STATE',
      message,
    });
  if (
    !state ||
    state.version !== 1 ||
    !Array.isArray(state.learned) ||
    !Array.isArray(state.build?.slots)
  ) {
    fail('功法状态缺少已学记录或激活槽位');
    return diagnostics;
  }
  if (!Number.isSafeInteger(state.revision) || state.revision < 0)
    fail('功法版本无效');
  const byId = new Map(definitions.map((d) => [d.id, d]));
  const learned = new Set<string>();
  const learnedCounts = new Map<ManualSlotV1, number>();
  for (const entry of state.learned) {
    const def = entry && byId.get(entry.manualId);
    if (!def || learned.has(entry.manualId)) {
      fail('已学功法未知或重复');
      continue;
    }
    learned.add(entry.manualId);
    const slot = manualSlot(def);
    const count = (learnedCounts.get(slot) ?? 0) + 1;
    learnedCounts.set(slot, count);
    if (count > MAX_MANUALS_PER_SLOT) fail('每个境界位最多学习三种功法');
    const rule = manualRule(def);
    if (manualSlot(def) > getManualSlotCount(realm))
      fail('当前境界不能修炼该功法');
    if (
      !Number.isInteger(entry.level) ||
      entry.level < 1 ||
      entry.level > entry.unlockedLevel ||
      ![...rule.bottlenecks, rule.maxLevel].includes(entry.unlockedLevel)
    )
      fail('功法层数或瓶颈进度无效');
    const previousCap =
      [...rule.bottlenecks].reverse().find((n) => n < entry.unlockedLevel) ?? 1;
    if (entry.level < previousCap) fail('不能提前解锁功法瓶颈');
  }
  const occupied = new Set<number>();
  for (const entry of state.build.slots) {
    const def = entry && byId.get(entry.manualId);
    if (
      !def ||
      !learned.has(entry.manualId) ||
      !isManualSlotV1(entry.slot) ||
      manualSlot(def) !== entry.slot ||
      occupied.has(entry.slot)
    )
      fail('激活功法必须已学且归属对应境界位，每位只能一本');
    if (entry) occupied.add(entry.slot);
  }
  return diagnostics;
}
export function compileCharacterManualsV1(
  input: { state: CultivatorManualStateV1; realm: RealmType },
  definitions: readonly CharacterManualDefV1[] = CHARACTER_MANUALS_V1,
): CompileCharacterManualsV1Result {
  const diagnostics = validateManualStateV1(
    input.state,
    input.realm,
    definitions,
  );
  if (diagnostics.length) return { ok: false, diagnostics };
  const projection: CharacterManualProjectionV1 = {
    attributeBonuses: {},
    skills: [],
    passiveSkillIds: [],
    skillLevels: {},
    panel: [],
    unitTags: [],
    capabilities: [],
    diagnostics,
  };
  for (const entry of [...input.state.build.slots].sort(
    (a, b) => a.slot - b.slot,
  )) {
    const def = definitions.find((d) => d.id === entry.manualId)!;
    const level = input.state.learned.find(
      (d) => d.manualId === entry.manualId,
    )!.level;
    for (const effect of def.effects)
      projection.attributeBonuses[effect.attribute] =
        (projection.attributeBonuses[effect.attribute] ?? 0) +
        effect.valuePerLevel * level;
    projection.skills.push(def.skill);
    projection.passiveSkillIds.push(def.skill.id);
    projection.skillLevels[def.skill.id] = level;
    projection.capabilities.push({
      capabilityKey: def.id,
      sourceType: 'manual',
      sourceId: def.id,
      stackPolicy: 'stack',
      priority: 0,
      passiveIds: [def.skill.id],
    });
  }
  return { ok: true, projection };
}
/** Apply before panel derivation; never mutate permanent attributes or apply the passive twice. */
export function withManualAttributes(
  cultivator: CultivatorBaseCombatInput,
  projection: CharacterManualProjectionV1,
): CultivatorBaseCombatInput {
  const attributes = { ...cultivator.attributes };
  for (const [key, value] of Object.entries(projection.attributeBonuses))
    attributes[key as keyof typeof attributes] += value;
  return { ...cultivator, attributes };
}
