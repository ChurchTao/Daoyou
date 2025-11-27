import type {
  Cultivator,
  BattleProfile,
  BattleAttributes,
  Skill,
  Equipment,
  PreHeavenFate,
  ElementType,
} from "../types/cultivator";
import { parseAIResponse } from "./aiClient";
import {
  generateDefaultBattleProfile,
  mapSpiritRootToElement,
} from "./battleProfile";

export function createCultivatorFromAI(
  aiResponse: string,
  userPrompt: string
): Cultivator {
  const data = parseAIResponse(aiResponse);

  const getString = (value: unknown, fallback: string) =>
    typeof value === "string" && value.trim().length ? value : fallback;

  const name = getString(data.name, "未命名");
  const cultivationLevel = getString(
    data.level ?? data.cultivationLevel,
    "炼气一层"
  );
  const spiritRoot = getString(data.spirit_root ?? data.spiritRoot, "无灵根");
  const appearance = getString(data.appearance, "普通修士");
  const backstory = getString(data.background ?? data.backstory, "来历不明");
  const gender = getString(data.gender, "");
  const origin = getString(data.origin, "");
  const personality = getString(data.personality, "");

  const preHeavenFates = parseFates(
    data.pre_heaven_fates ?? data.preHeavenFates
  );
  const cultivator: Cultivator = {
    id: generateUUID(),
    name,
    prompt: userPrompt,
    cultivationLevel,
    spiritRoot,
    appearance,
    backstory,
    gender: gender || undefined,
    origin: origin || undefined,
    personality: personality || undefined,
    preHeavenFates: preHeavenFates.length ? preHeavenFates : undefined,
    battleProfile: undefined,
  };

  cultivator.battleProfile =
    buildBattleProfileFromData(data, name, spiritRoot) ??
    generateDefaultBattleProfile(cultivator);

  return cultivator;
}

export function generateUUID(): string {
  return (
    "cultivator-" + Date.now() + "-" + Math.random().toString(36).slice(2, 11)
  );
}

export function validateCultivator(cultivator: Partial<Cultivator>): boolean {
  return !!(
    cultivator.name &&
    cultivator.cultivationLevel &&
    cultivator.spiritRoot &&
    cultivator.appearance &&
    cultivator.backstory &&
    cultivator.battleProfile
  );
}

function parseFates(raw: unknown): PreHeavenFate[] {
  if (!Array.isArray(raw)) return [];
  return raw
    .map((item) => {
      if (!item || typeof item !== "object") return null;
      const record = item as Record<string, unknown>;
      const name = typeof record.name === "string" ? record.name : null;
      if (!name) return null;
      const type = record.type === "凶" ? "凶" : "吉";
      const effect = typeof record.effect === "string" ? record.effect : "";
      const description =
        typeof record.description === "string" ? record.description : "";
      return { name, type, effect, description };
    })
    .filter((fate): fate is PreHeavenFate => !!fate);
}

function parseAttributes(raw: unknown): BattleAttributes | null {
  if (!raw || typeof raw !== "object") return null;
  const record = raw as Record<string, unknown>;
  const vitality = Number(record.vitality);
  const spirit = Number(record.spirit);
  const wisdom = Number(record.wisdom);
  const speed = Number(record.speed);
  if ([vitality, spirit, wisdom, speed].every((n) => Number.isFinite(n))) {
    return { vitality, spirit, wisdom, speed };
  }
  return null;
}

function parseSkills(raw: unknown): Skill[] {
  if (!Array.isArray(raw)) return [];
  const parsed = raw
    .map((item) => {
      if (!item || typeof item !== "object") return null;
      const record = item as Record<string, unknown>;
      const name = typeof record.name === "string" ? record.name : null;
      const typeValue = typeof record.type === "string" ? record.type : null;
      const power = Number(record.power);
      const elementValue = (record.element as ElementType) ?? "无";
      if (!name || !typeValue || !Number.isFinite(power)) return null;
      const effects = Array.isArray(record.effects)
        ? record.effects.filter(
            (effect: unknown): effect is string => typeof effect === "string"
          )
        : undefined;
      return {
        name,
        type: typeValue as Skill["type"],
        power,
        element: elementValue,
        effects,
      } as Skill;
    })
    .filter((skill): skill is Skill => !!skill);
  return parsed;
}

function parseEquipment(raw: unknown): Equipment[] | undefined {
  if (!Array.isArray(raw)) return undefined;
  const equipments = raw
    .map((item) => {
      if (!item || typeof item !== "object") return null;
      const record = item as Record<string, unknown>;
      const name = typeof record.name === "string" ? record.name : null;
      if (!name) return null;
      const bonus =
        record.bonus && typeof record.bonus === "object"
          ? { ...(record.bonus as Record<string, unknown>) }
          : undefined;
      const result: Equipment = { name, bonus };
      return result;
    })
    .filter((item): item is Equipment => !!item);
  return equipments.length ? equipments : undefined;
}

function buildBattleProfileFromData(
  data: Record<string, unknown>,
  name: string,
  spiritRoot: string
): BattleProfile | null {
  // 获取battle_profile对象
  const battleProfile = data.battle_profile as Record<string, unknown>;

  // 优先解析battle_profile中的attributes，而不是直接在data中的attributes
  const attributes =
    parseAttributes(battleProfile?.attributes) ||
    parseAttributes(data.attributes);

  // 优先解析battle_profile中的skills，而不是直接在data中的skills
  const skills = parseSkills(battleProfile?.skills) || parseSkills(data.skills);

  if (!attributes || skills.length === 0) {
    return null;
  }

  // 解析先天气运（从data中获取，而不是从battle_profile中）
  const preHeavenFates = parseFates(
    data.pre_heaven_fates ?? data.preHeavenFates
  );

  // 应用先天气运效果
  const finalAttributes = applyFateEffects(attributes, preHeavenFates);

  // 计算maxHp，考虑先天气运影响
  const maxHpRaw =
    (battleProfile?.max_hp as number) ??
    (battleProfile?.maxHp as number) ??
    (data.max_hp as number);

  let maxHp =
    Number.isFinite(maxHpRaw) && typeof maxHpRaw === "number"
      ? maxHpRaw
      : Math.round(150 + finalAttributes.vitality * 0.8);

  // 额外处理先天气运中的maxHp加成
  maxHp = applyFateMaxHpBonus(maxHp, preHeavenFates);

  // 优先解析battle_profile中的equipment，而不是直接在data中的equipment
  const equipment =
    parseEquipment(battleProfile?.equipment) || parseEquipment(data.equipment);

  // 优先解析battle_profile中的element，而不是直接在data中的element
  const element =
    (battleProfile?.element as ElementType) ||
    (data.element as ElementType) ||
    mapSpiritRootToElement(spiritRoot);

  return {
    maxHp,
    hp: maxHp,
    attributes: finalAttributes,
    skills,
    equipment,
    element,
  };
}

/**
 * 应用先天气运效果到属性上
 */
function applyFateEffects(
  attributes: BattleAttributes,
  fates: PreHeavenFate[]
): BattleAttributes {
  const finalAttributes = { ...attributes };

  for (const fate of fates) {
    const effect = fate.effect;

    // 解析属性加成
    const vitalityMatch = effect.match(/vitality\s*([+-]\s*\d+)/i);
    if (vitalityMatch) {
      finalAttributes.vitality += parseInt(
        vitalityMatch[1].replace(/\s/g, ""),
        10
      );
    }

    const spiritMatch = effect.match(/spirit\s*([+-]\s*\d+)/i);
    if (spiritMatch) {
      finalAttributes.spirit += parseInt(spiritMatch[1].replace(/\s/g, ""), 10);
    }

    const wisdomMatch = effect.match(/wisdom\s*([+-]\s*\d+)/i);
    if (wisdomMatch) {
      finalAttributes.wisdom += parseInt(wisdomMatch[1].replace(/\s/g, ""), 10);
    }

    const speedMatch = effect.match(/speed\s*([+-]\s*\d+)/i);
    if (speedMatch) {
      finalAttributes.speed += parseInt(speedMatch[1].replace(/\s/g, ""), 10);
    }

    // 解析所有属性加成
    const allAttrMatch = effect.match(/所有属性\s*([+-]\s*\d+)/i);
    if (allAttrMatch) {
      const bonus = parseInt(allAttrMatch[1].replace(/\s/g, ""), 10);
      finalAttributes.vitality += bonus;
      finalAttributes.spirit += bonus;
      finalAttributes.wisdom += bonus;
      finalAttributes.speed += bonus;
    }
  }

  // 确保属性在合理范围内
  finalAttributes.vitality = Math.max(
    50,
    Math.min(100, finalAttributes.vitality)
  );
  finalAttributes.spirit = Math.max(50, Math.min(100, finalAttributes.spirit));
  finalAttributes.wisdom = Math.max(50, Math.min(100, finalAttributes.wisdom));
  finalAttributes.speed = Math.max(50, Math.min(100, finalAttributes.speed));

  return finalAttributes;
}

/**
 * 应用先天气运对maxHp的加成
 */
function applyFateMaxHpBonus(maxHp: number, fates: PreHeavenFate[]): number {
  let finalMaxHp = maxHp;

  for (const fate of fates) {
    const effect = fate.effect;

    // 解析maxHp加成
    const maxHpMatch = effect.match(
      /max_hp\s*([+-]\s*\d+)|maxhp\s*([+-]\s*\d+)|生命值上限\s*([+-]\s*\d+)/i
    );
    if (maxHpMatch) {
      const bonus = parseInt(
        (maxHpMatch[1] || maxHpMatch[2] || maxHpMatch[3]).replace(/\s/g, ""),
        10
      );
      finalMaxHp += bonus;
    }
  }

  // 确保maxHp至少为50
  return Math.max(50, finalMaxHp);
}
