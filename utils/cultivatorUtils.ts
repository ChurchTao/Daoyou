import {
  CONSUMABLE_TYPE_VALUES,
  ConsumableType,
  ELEMENT_VALUES,
  ElementType,
  FATE_QUALITY_VALUES,
  FateQuality,
  REALM_STAGE_VALUES,
  REALM_VALUES,
  RealmStage,
  RealmType,
  SKILL_GRADE_VALUES,
  SKILL_TYPE_VALUES,
  SkillGrade,
  SkillType,
  SPIRITUAL_ROOT_GRADE_VALUES,
  SpiritualRootGrade,
  STATUS_EFFECT_VALUES,
  StatusEffect,
} from '../types/constants';
import type {
  Artifact,
  ArtifactBonus,
  Attributes,
  Consumable,
  ConsumableEffect,
  CultivationTechnique,
  Cultivator,
  EquippedItems,
  Inventory,
  PreHeavenFate,
  Skill,
  SpiritualRoot,
} from '../types/cultivator';
import { parseAIResponse } from './aiClient';

export function createCultivatorFromAI(
  aiResponse: string,
  userPrompt: string,
): Cultivator {
  const raw = parseAIResponse(aiResponse);

  const name = asString(raw.name, '未命名');
  const gender = asGender(raw.gender);
  const realm = asRealm(raw.realm);
  const realmStage = asRealmStage(raw.realm_stage);
  const age = asInteger(raw.age, 18, 0);
  const lifespan = asInteger(raw.lifespan, 100, 1);

  const attributes = asAttributes(raw.attributes);
  const spiritualRoots = asSpiritualRoots(raw.spiritual_roots);
  const preHeavenFates = asPreHeavenFates(raw.pre_heaven_fates);
  const cultivations = asCultivations(raw.cultivations);
  const skills = asSkills(raw.skills);
  const balance_notes = asOptionalString(raw.balance_notes);

  // 装备不由 AI 生成，创建角色时为空，由用户后续手动装备
  const inventory: Inventory = {
    artifacts: [],
    consumables: [],
  };
  const equipped: EquippedItems = {
    weapon: null,
    armor: null,
    accessory: null,
  };
  const maxSkills = asInteger(raw.max_skills, 4, 2, 6);

  const background = asOptionalString(
    raw.background ?? raw.backstory ?? raw.story,
  );

  const cultivator: Cultivator = {
    name,
    gender,
    origin: asOptionalString(raw.origin),
    personality: asOptionalString(raw.personality),
    realm,
    realm_stage: realmStage,
    age,
    lifespan,
    attributes,
    spiritual_roots: spiritualRoots,
    pre_heaven_fates: preHeavenFates,
    cultivations,
    skills,
    inventory,
    equipped,
    max_skills: maxSkills,
    background,
    prompt: userPrompt,
    balance_notes,
  };

  return cultivator;
}

export function validateCultivator(c: Partial<Cultivator>): boolean {
  if (!c) return false;
  if (!c.name || !c.gender || !c.realm || !c.realm_stage) return false;
  if (!c.attributes || !c.skills || !c.inventory || !c.equipped) return false;
  if (!c.spiritual_roots || c.spiritual_roots.length === 0) return false;
  return true;
}

/**
 * 获取境界属性上限
 */
export function getRealmAttributeCap(realm: RealmType): number {
  const caps: Record<RealmType, number> = {
    炼气: 100,
    筑基: 120,
    金丹: 150,
    元婴: 180,
    化神: 210,
    炼虚: 240,
    合体: 270,
    大乘: 300,
    渡劫: 300,
  };
  return caps[realm] ?? 100;
}

/**
 * 计算最终属性（包含先天命格、功法、装备的加成）
 * 返回最终属性以及各来源的加成明细
 */
export interface FinalAttributesResult {
  final: Required<Attributes>;
  breakdown: {
    base: Required<Attributes>;
    fromFates: Required<Attributes>;
    fromCultivations: Required<Attributes>;
    fromEquipment: Required<Attributes>;
    cap: number;
  };
}

export function calculateFinalAttributes(c: Cultivator): FinalAttributesResult {
  // 基础属性
  const base: Required<Attributes> = {
    vitality: c.attributes.vitality,
    spirit: c.attributes.spirit,
    wisdom: c.attributes.wisdom,
    speed: c.attributes.speed,
    willpower: c.attributes.willpower,
  };

  // 先天命格加成
  const fromFates: Required<Attributes> = {
    vitality: 0,
    spirit: 0,
    wisdom: 0,
    speed: 0,
    willpower: 0,
  };
  for (const fate of c.pre_heaven_fates || []) {
    if (fate.attribute_mod.vitality) {
      fromFates.vitality += fate.attribute_mod.vitality;
    }
    if (fate.attribute_mod.spirit) {
      fromFates.spirit += fate.attribute_mod.spirit;
    }
    if (fate.attribute_mod.wisdom) {
      fromFates.wisdom += fate.attribute_mod.wisdom;
    }
    if (fate.attribute_mod.speed) {
      fromFates.speed += fate.attribute_mod.speed;
    }
    if (fate.attribute_mod.willpower) {
      fromFates.willpower += fate.attribute_mod.willpower;
    }
  }

  // 功法加成
  const fromCultivations: Required<Attributes> = {
    vitality: 0,
    spirit: 0,
    wisdom: 0,
    speed: 0,
    willpower: 0,
  };
  for (const cult of c.cultivations || []) {
    if (cult.bonus.vitality) {
      fromCultivations.vitality += cult.bonus.vitality;
    }
    if (cult.bonus.spirit) {
      fromCultivations.spirit += cult.bonus.spirit;
    }
    if (cult.bonus.wisdom) {
      fromCultivations.wisdom += cult.bonus.wisdom;
    }
    if (cult.bonus.speed) {
      fromCultivations.speed += cult.bonus.speed;
    }
    if (cult.bonus.willpower) {
      fromCultivations.willpower += cult.bonus.willpower;
    }
  }

  // 装备加成
  const fromEquipment: Required<Attributes> = {
    vitality: 0,
    spirit: 0,
    wisdom: 0,
    speed: 0,
    willpower: 0,
  };
  const artifactsById = new Map(
    (c.inventory?.artifacts || []).map((a) => [a.id!, a]),
  );
  const equippedArtifacts = [
    c.equipped.weapon,
    c.equipped.armor,
    c.equipped.accessory,
  ]
    .filter(Boolean)
    .map((id) => artifactsById.get(id!))
    .filter(Boolean) as typeof c.inventory.artifacts;

  for (const art of equippedArtifacts) {
    if (art.bonus.vitality) {
      fromEquipment.vitality += art.bonus.vitality;
    }
    if (art.bonus.spirit) {
      fromEquipment.spirit += art.bonus.spirit;
    }
    if (art.bonus.wisdom) {
      fromEquipment.wisdom += art.bonus.wisdom;
    }
    if (art.bonus.speed) {
      fromEquipment.speed += art.bonus.speed;
    }
    if (art.bonus.willpower) {
      fromEquipment.willpower += art.bonus.willpower;
    }
  }

  // 计算最终属性
  const final: Required<Attributes> = {
    vitality:
      base.vitality +
      fromFates.vitality +
      fromCultivations.vitality +
      fromEquipment.vitality,
    spirit:
      base.spirit +
      fromFates.spirit +
      fromCultivations.spirit +
      fromEquipment.spirit,
    wisdom:
      base.wisdom +
      fromFates.wisdom +
      fromCultivations.wisdom +
      fromEquipment.wisdom,
    speed:
      base.speed +
      fromFates.speed +
      fromCultivations.speed +
      fromEquipment.speed,
    willpower:
      base.willpower +
      fromFates.willpower +
      fromCultivations.willpower +
      fromEquipment.willpower,
  };

  // 境界上限裁剪
  const cap = getRealmAttributeCap(c.realm);
  final.vitality = Math.min(final.vitality, cap);
  final.spirit = Math.min(final.spirit, cap);
  final.wisdom = Math.min(final.wisdom, cap);
  final.speed = Math.min(final.speed, cap);
  final.willpower = Math.min(final.willpower, cap);

  return {
    final,
    breakdown: {
      base,
      fromFates,
      fromCultivations,
      fromEquipment,
      cap,
    },
  };
}

// ===== 内部工具函数 =====

function asString(value: unknown, fallback: string): string {
  return typeof value === 'string' && value.trim().length
    ? value.trim()
    : fallback;
}

function asOptionalString(value: unknown): string | undefined {
  return typeof value === 'string' && value.trim().length
    ? value.trim()
    : undefined;
}

function asInteger(
  value: unknown,
  fallback: number,
  min?: number,
  max?: number,
): number {
  const n = typeof value === 'number' ? Math.round(value) : Number(value);
  if (!Number.isFinite(n)) return fallback;
  let v = n;
  if (typeof min === 'number') v = Math.max(min, v);
  if (typeof max === 'number') v = Math.min(max, v);
  return v;
}

function asGender(value: unknown): Cultivator['gender'] {
  if (value === '男' || value === '女' || value === '无') return value;
  return '无';
}

function asRealm(value: unknown): RealmType {
  const realms: RealmType[] = [...REALM_VALUES];
  if (typeof value === 'string' && realms.includes(value as RealmType)) {
    return value as RealmType;
  }
  return '炼气';
}

function asRealmStage(value: unknown): RealmStage {
  const stages: RealmStage[] = [...REALM_STAGE_VALUES];
  if (typeof value === 'string' && stages.includes(value as RealmStage)) {
    return value as RealmStage;
  }
  return '初期';
}

function asElement(value: unknown): ElementType {
  const elements: ElementType[] = [...ELEMENT_VALUES];
  if (typeof value === 'string' && elements.includes(value as ElementType)) {
    return value as ElementType;
  }
  return '金';
}

function asAttributes(raw: unknown): Attributes {
  const obj = (
    raw && typeof raw === 'object' ? (raw as Record<string, unknown>) : {}
  ) as Record<string, unknown>;

  return {
    vitality: asInteger(obj.vitality, 60, 10, 300),
    spirit: asInteger(obj.spirit, 60, 10, 300),
    wisdom: asInteger(obj.wisdom, 60, 10, 300),
    speed: asInteger(obj.speed, 60, 10, 300),
    willpower: asInteger(obj.willpower, 60, 10, 300),
  };
}

function asSpiritualRootGrade(value: unknown): SpiritualRootGrade | undefined {
  const grades: SpiritualRootGrade[] = [...SPIRITUAL_ROOT_GRADE_VALUES];
  if (
    typeof value === 'string' &&
    grades.includes(value as SpiritualRootGrade)
  ) {
    return value as SpiritualRootGrade;
  }
  return undefined;
}

function asSpiritualRoots(raw: unknown): SpiritualRoot[] {
  if (!Array.isArray(raw)) {
    return [{ element: '金', strength: 50 }];
  }
  return raw
    .map((item) => {
      if (!item || typeof item !== 'object') return null;
      const rec = item as Record<string, unknown>;
      const element = asElement(rec.element);
      const strength = asInteger(rec.strength, 50, 0, 100);
      const grade = asSpiritualRootGrade(rec.grade);
      return { element, strength, grade } as SpiritualRoot;
    })
    .filter((r): r is SpiritualRoot => !!r)
    .slice(0, 4);
}

function asFateQuality(value: unknown): FateQuality | undefined {
  const qualities: FateQuality[] = [...FATE_QUALITY_VALUES];
  if (typeof value === 'string' && qualities.includes(value as FateQuality)) {
    return value as FateQuality;
  }
  return undefined;
}

function asPreHeavenFates(raw: unknown): PreHeavenFate[] {
  if (!Array.isArray(raw)) return [];
  const list: PreHeavenFate[] = [];
  for (const item of raw) {
    if (!item || typeof item !== 'object') continue;
    const rec = item as Record<string, unknown>;
    const name = asString(rec.name, '');
    if (!name) continue;
    const type = rec.type === '凶' ? '凶' : '吉';
    const quality = asFateQuality(rec.quality);
    const modRaw =
      (rec.attribute_mod as Record<string, unknown>) ??
      ({} as Record<string, unknown>);
    const attribute_mod: PreHeavenFate['attribute_mod'] = {};
    if (typeof modRaw.vitality === 'number') {
      attribute_mod.vitality = Math.round(modRaw.vitality);
    }
    if (typeof modRaw.spirit === 'number') {
      attribute_mod.spirit = Math.round(modRaw.spirit);
    }
    if (typeof modRaw.wisdom === 'number') {
      attribute_mod.wisdom = Math.round(modRaw.wisdom);
    }
    if (typeof modRaw.speed === 'number') {
      attribute_mod.speed = Math.round(modRaw.speed);
    }
    if (typeof modRaw.willpower === 'number') {
      attribute_mod.willpower = Math.round(modRaw.willpower);
    }
    list.push({
      name,
      type,
      quality,
      attribute_mod,
      description: asOptionalString(rec.description),
    });
  }
  return list;
}

function asSkillGrade(value: unknown): SkillGrade | undefined {
  const grades: SkillGrade[] = [...SKILL_GRADE_VALUES];
  if (typeof value === 'string' && grades.includes(value as SkillGrade)) {
    return value as SkillGrade;
  }
  return undefined;
}

function asCultivations(raw: unknown): CultivationTechnique[] {
  if (!Array.isArray(raw)) return [];
  return raw
    .map((item) => {
      if (!item || typeof item !== 'object') return null;
      const rec = item as Record<string, unknown>;
      const name = asString(rec.name, '');
      if (!name) return null;
      const grade = asSkillGrade(rec.grade);
      const bonusRaw =
        (rec.bonus as Record<string, unknown>) ??
        ({} as Record<string, unknown>);
      const bonus: CultivationTechnique['bonus'] = {};
      if (typeof bonusRaw.vitality === 'number') {
        bonus.vitality = Math.round(bonusRaw.vitality);
      }
      if (typeof bonusRaw.spirit === 'number') {
        bonus.spirit = Math.round(bonusRaw.spirit);
      }
      if (typeof bonusRaw.wisdom === 'number') {
        bonus.wisdom = Math.round(bonusRaw.wisdom);
      }
      if (typeof bonusRaw.speed === 'number') {
        bonus.speed = Math.round(bonusRaw.speed);
      }
      if (typeof bonusRaw.willpower === 'number') {
        bonus.willpower = Math.round(bonusRaw.willpower);
      }
      const required_realm = asRealm(rec.required_realm);
      const result: CultivationTechnique = { name, bonus, required_realm };
      if (grade) {
        result.grade = grade;
      }
      return result;
    })
    .filter((c): c is CultivationTechnique => c !== null);
}

function asSkills(raw: unknown): Skill[] {
  if (!Array.isArray(raw)) return [];
  return raw
    .map((item) => {
      if (!item || typeof item !== 'object') return null;
      const rec = item as Record<string, unknown>;
      const name = asString(rec.name, '');
      if (!name) return null;
      const type = asSkillType(rec.type);
      const element = asElement(rec.element);
      const grade = asSkillGrade(rec.grade);
      const power = asInteger(rec.power, 60, 30, 150);
      const cost =
        typeof rec.cost === 'number' ? Math.max(0, Math.round(rec.cost)) : 0;
      const cooldown =
        typeof rec.cooldown === 'number'
          ? Math.max(0, Math.round(rec.cooldown))
          : 0;
      const effect = asStatusEffect(rec.effect);
      const duration =
        typeof rec.duration === 'number'
          ? Math.max(1, Math.round(rec.duration))
          : undefined;
      const target_self =
        typeof rec.target_self === 'boolean' ? rec.target_self : undefined;

      return {
        name,
        type,
        element,
        grade,
        power,
        cost,
        cooldown,
        effect,
        duration,
        target_self,
      } as Skill;
    })
    .filter((s): s is Skill => !!s);
}

function asSkillType(value: unknown): SkillType {
  const types: SkillType[] = [...SKILL_TYPE_VALUES];
  if (typeof value === 'string' && types.includes(value as SkillType)) {
    return value as SkillType;
  }
  return 'attack';
}

function asStatusEffect(value: unknown): StatusEffect | undefined {
  const effects: StatusEffect[] = [...STATUS_EFFECT_VALUES];
  if (typeof value === 'string' && effects.includes(value as StatusEffect)) {
    return value as StatusEffect;
  }
  return undefined;
}

// eslint-disable-next-line @typescript-eslint/no-unused-vars
function normaliseInventory(raw: unknown): Inventory {
  const obj =
    raw && typeof raw === 'object'
      ? (raw as Record<string, unknown>)
      : ({} as Record<string, unknown>);

  const artifactsArray = Array.isArray(obj.artifacts)
    ? (obj.artifacts as unknown[])
    : [];
  const consumablesArray = Array.isArray(obj.consumables)
    ? (obj.consumables as unknown[])
    : [];

  const artifacts: Artifact[] = [];
  artifactsArray.forEach((item, idx) => {
    if (!item || typeof item !== 'object') return;
    const rec = item as Record<string, unknown>;
    const name = asString(rec.name, '');
    if (!name) return;
    const slot =
      rec.slot === 'weapon' || rec.slot === 'armor' || rec.slot === 'accessory'
        ? rec.slot
        : 'weapon';
    const id =
      typeof rec.id === 'string' && rec.id.trim().length
        ? rec.id
        : `eq_${idx}_${Date.now().toString(36)}`;
    const element = asElement(rec.element);
    const bonusRaw =
      (rec.bonus as Record<string, unknown>) ?? ({} as Record<string, unknown>);
    const bonus: ArtifactBonus = {};
    if (typeof bonusRaw.vitality === 'number') {
      bonus.vitality = Math.round(bonusRaw.vitality);
    }
    if (typeof bonusRaw.spirit === 'number') {
      bonus.spirit = Math.round(bonusRaw.spirit);
    }
    if (typeof bonusRaw.wisdom === 'number') {
      bonus.wisdom = Math.round(bonusRaw.wisdom);
    }
    if (typeof bonusRaw.speed === 'number') {
      bonus.speed = Math.round(bonusRaw.speed);
    }
    if (typeof bonusRaw.willpower === 'number') {
      bonus.willpower = Math.round(bonusRaw.willpower);
    }
    artifacts.push({
      id,
      name,
      slot,
      element,
      bonus,
      special_effects: [],
      curses: [],
    });
  });

  const consumables: Consumable[] = [];
  consumablesArray.forEach((item) => {
    if (!item || typeof item !== 'object') return;
    const rec = item as Record<string, unknown>;
    const name = asString(rec.name, '');
    if (!name) return;
    const typeRaw = rec.type;
    const type: ConsumableType = CONSUMABLE_TYPE_VALUES.includes(
      typeRaw as ConsumableType,
    )
      ? (typeRaw as ConsumableType)
      : 'heal';
    consumables.push({
      name,
      type,
      effect: rec.effect as ConsumableEffect | undefined,
    });
  });

  return {
    artifacts,
    consumables,
  };
}

// eslint-disable-next-line @typescript-eslint/no-unused-vars
function normaliseEquipped(raw: unknown, inventory: Inventory): EquippedItems {
  const obj =
    raw && typeof raw === 'object'
      ? (raw as Record<string, unknown>)
      : ({} as Record<string, unknown>);

  const ids = new Set(inventory.artifacts.map((a) => a.id));

  const weapon =
    typeof obj.weapon === 'string' && ids.has(obj.weapon) ? obj.weapon : null;
  const armor =
    typeof obj.armor === 'string' && ids.has(obj.armor) ? obj.armor : null;
  const accessory =
    typeof obj.accessory === 'string' && ids.has(obj.accessory)
      ? obj.accessory
      : null;

  return { weapon, armor, accessory };
}
