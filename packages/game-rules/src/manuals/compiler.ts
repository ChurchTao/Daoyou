import { REALM_VALUES, type RealmType } from '@daoyou/constants/realms';
import type {
  CombatV6ProjectionDiagnostic,
  CultivatorBaseCombatInput,
} from '@daoyou/game-domain/combat';
import { DaoyouRule } from '@daoyou/game-content/combat/tuning';
import { manualAttributeValue } from './attributes.js';
import { CHARACTER_MANUALS_V1, manualRule } from '@daoyou/game-content/manuals';
import { compileManualSkill, manualMechanismValue } from './mechanism.js';
import { compileManualStatusDefs } from './later-mechanisms.js';
import { MANUAL_REALMS } from '@daoyou/game-domain/manuals/authoring';
import type {
  CharacterManualDefV1,
  CharacterManualProjectionV1,
  CompileCharacterManualsV1Result,
  CultivatorManualStateV1,
  ManualSlotV1,
} from '@daoyou/game-domain/manuals';

export const MANUAL_SLOT_REALMS = ['炼气', '筑基', '金丹', '元婴', '化神', '合体'] as const;

/** Each slot owns its learned manuals, including a choice of six advanced manuals. */
export const MAX_MANUALS_PER_SLOT = 6;

export function getManualSlotCount(realm: RealmType): number {
  return MANUAL_SLOT_REALMS.filter(
    (slotRealm) => REALM_VALUES.indexOf(slotRealm) <= REALM_VALUES.indexOf(realm),
  ).length;
}
export function isManualSlotV1(value: number): value is ManualSlotV1 {
  return Number.isInteger(value) && value >= 1 && value <= MANUAL_SLOT_REALMS.length;
}
/** Original content realm slot; use canEquipManualInSlot for loadout eligibility. */
export function manualSlot(definition: CharacterManualDefV1): number {
  return MANUAL_REALMS.indexOf(definition.realm) + 1;
}
export function isAdvancedManual(definition: CharacterManualDefV1): boolean {
  return manualSlot(definition) >= 5;
}
/** Earliest opened slot needed to learn this manual, independent of its source realm. */
export function manualLearningSlot(definition: CharacterManualDefV1): ManualSlotV1 {
  return isAdvancedManual(definition) ? 5 : manualSlot(definition) as ManualSlotV1;
}
/** Basic records predate slot ownership; advanced records must explicitly choose a slot. */
export function manualLearnedSlot(
  definition: CharacterManualDefV1,
  entry: CultivatorManualStateV1['learned'][number],
): ManualSlotV1 | undefined {
  if (isAdvancedManual(definition))
    return entry.slot === 5 || entry.slot === 6 ? entry.slot : undefined;
  const slot = manualLearningSlot(definition);
  return entry.slot === undefined || entry.slot === slot ? slot : undefined;
}
export function canEquipManualInSlot(
  definition: CharacterManualDefV1,
  slot: number,
): boolean {
  return isManualSlotV1(slot) &&
    (isAdvancedManual(definition) ? slot >= 5 : manualSlot(definition) === slot);
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
  const learnedSlots = new Map<string, ManualSlotV1>();
  const learnedCounts = new Map<ManualSlotV1, number>();
  for (const entry of state.learned) {
    const def = entry && byId.get(entry.manualId);
    if (!def || learned.has(entry.manualId)) {
      fail('已学功法未知或重复');
      continue;
    }
    learned.add(entry.manualId);
    const slot = manualLearnedSlot(def, entry);
    if (slot === undefined) {
      fail(isAdvancedManual(def)
        ? '高阶功法缺少有效归属位，请先迁移旧功法存档，原学习进度已保留'
        : '基础功法归属位无效');
    } else {
      learnedSlots.set(entry.manualId, slot);
      const count = (learnedCounts.get(slot) ?? 0) + 1;
      learnedCounts.set(slot, count);
      if (count > MAX_MANUALS_PER_SLOT) fail('每个功法位最多学习六种功法');
      if (slot > getManualSlotCount(realm)) fail('当前境界尚未开放该功法归属位');
    }
    const rule = manualRule(def);
    if (
      REALM_VALUES.indexOf(realm) < REALM_VALUES.indexOf(def.realm) ||
      manualLearningSlot(def) > getManualSlotCount(realm)
    )
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
  const activated = new Set<string>();
  for (const entry of state.build.slots) {
    const def = entry && byId.get(entry.manualId);
    if (
      !def ||
      !learned.has(entry.manualId) ||
      !isManualSlotV1(entry.slot) ||
      !canEquipManualInSlot(def, entry.slot) ||
      learnedSlots.get(entry.manualId) !== entry.slot ||
      entry.slot > getManualSlotCount(realm) ||
      occupied.has(entry.slot) ||
      activated.has(entry.manualId)
    )
      fail('激活功法必须已学且符合已开放功法位，同一本功法只能激活一次');
    if (entry) {
      occupied.add(entry.slot);
      activated.add(entry.manualId);
    }
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
    statusDefs: [],
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
        manualAttributeValue(effect, level);
    projection.skills.push(compileManualSkill(def, level));
    projection.statusDefs.push(...compileManualStatusDefs(def, manualMechanismValue(def.mechanism, level)));
    if (def.mechanism.type === 'sealResist')
      projection.panel.push({
        attr: 'sealResist',
        mode: 'add',
        value:
          manualMechanismValue(def.mechanism, level) *
          DaoyouRule.hitChanceScale,
      });
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
