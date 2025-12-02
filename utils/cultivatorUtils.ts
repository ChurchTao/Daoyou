import type {
  Attributes,
  Consumable,
  Cultivator,
  CultivationTechnique,
  ElementType,
  PreHeavenFate,
  RealmStage,
  RealmType,
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

  // 装备不由 AI 生成，创建角色时为空，由用户后续手动装备
  const inventory: Cultivator['inventory'] = {
    artifacts: [],
    consumables: [],
  };
  const equipped: Cultivator['equipped'] = {
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
  const realms: RealmType[] = [
    '炼气',
    '筑基',
    '金丹',
    '元婴',
    '化神',
    '炼虚',
    '合体',
    '大乘',
    '渡劫',
  ];
  if (typeof value === 'string' && realms.includes(value as RealmType)) {
    return value as RealmType;
  }
  return '炼气';
}

function asRealmStage(value: unknown): RealmStage {
  const stages: RealmStage[] = ['初期', '中期', '后期', '圆满'];
  if (typeof value === 'string' && stages.includes(value as RealmStage)) {
    return value as RealmStage;
  }
  return '初期';
}

function asElement(value: unknown): ElementType {
  const elements: ElementType[] = ['金', '木', '水', '火', '土', '风', '雷', '冰', '无'];
  if (typeof value === 'string' && elements.includes(value as ElementType)) {
    return value as ElementType;
  }
  return '无';
}

function asAttributes(raw: unknown): Attributes {
  const obj = (raw && typeof raw === 'object'
    ? (raw as Record<string, unknown>)
    : {}) as Record<string, unknown>;

  return {
    vitality: asInteger(obj.vitality, 60, 10, 300),
    spirit: asInteger(obj.spirit, 60, 10, 300),
    wisdom: asInteger(obj.wisdom, 60, 10, 300),
    speed: asInteger(obj.speed, 60, 10, 300),
    willpower: asInteger(obj.willpower, 60, 10, 300),
  };
}

function asSpiritualRoots(raw: unknown): SpiritualRoot[] {
  if (!Array.isArray(raw)) {
    return [{ element: '无', strength: 0 }];
  }
  return raw
    .map((item) => {
      if (!item || typeof item !== 'object') return null;
      const rec = item as Record<string, unknown>;
      const element = asElement(rec.element);
      const strength = asInteger(rec.strength, 50, 0, 100);
      return { element, strength } as SpiritualRoot;
    })
    .filter((r): r is SpiritualRoot => !!r)
    .slice(0, 3);
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
    const modRaw =
      (rec.attribute_mod as Record<string, unknown>) ?? ({} as Record<
        string,
        unknown
      >);
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
      attribute_mod,
      description: asOptionalString(rec.description),
    });
  }
  return list;
}

function asCultivations(raw: unknown): CultivationTechnique[] {
  if (!Array.isArray(raw)) return [];
  return raw
    .map((item) => {
      if (!item || typeof item !== 'object') return null;
      const rec = item as Record<string, unknown>;
      const name = asString(rec.name, '');
      if (!name) return null;
      const bonusRaw =
        (rec.bonus as Record<string, unknown>) ?? ({} as Record<
          string,
          unknown
        >);
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
      return { name, bonus, required_realm };
    })
    .filter((c): c is CultivationTechnique => !!c);
}

function asSkills(raw: unknown): Skill[] {
  if (!Array.isArray(raw)) return [];
  return raw
    .map((item, index) => {
      if (!item || typeof item !== 'object') return null;
      const rec = item as Record<string, unknown>;
      const name = asString(rec.name, '');
      if (!name) return null;
      const type = asSkillType(rec.type);
      const element = asElement(rec.element);
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

function asSkillType(value: unknown): Skill['type'] {
  const types: Skill['type'][] = ['attack', 'heal', 'control', 'debuff', 'buff'];
  if (typeof value === 'string' && types.includes(value as Skill['type'])) {
    return value as Skill['type'];
  }
  return 'attack';
}

function asStatusEffect(value: unknown): Skill['effect'] {
  const effects: Skill['effect'][] = [
    'burn',
    'bleed',
    'poison',
    'stun',
    'silence',
    'root',
    'armor_up',
    'speed_up',
    'crit_rate_up',
    'armor_down',
  ];
  if (typeof value === 'string' && effects.includes(value as Skill['effect'])) {
    return value as Skill['effect'];
  }
  return undefined;
}

function normaliseInventory(raw: unknown): Cultivator['inventory'] {
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

  const artifacts: Cultivator['inventory']['artifacts'] = [];
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
    const bonus: Cultivator['inventory']['artifacts'][number]['bonus'] = {};
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
    const type: Consumable['type'] =
      typeRaw === 'heal' ||
      typeRaw === 'buff' ||
      typeRaw === 'revive' ||
      typeRaw === 'breakthrough'
        ? typeRaw
        : 'heal';
    consumables.push({
      name,
      type,
      effect: rec.effect as Consumable['effect'],
    });
  });

  return {
    artifacts,
    consumables,
  };
}

function normaliseEquipped(
  raw: unknown,
  inventory: Cultivator['inventory'],
): Cultivator['equipped'] {
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

