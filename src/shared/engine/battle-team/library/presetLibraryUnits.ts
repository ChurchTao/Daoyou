import { AttributeType } from '@shared/engine/battle-v5/core/types';
import type { TeamUnit } from '../TeamUnit';
import { TeamUnit as TeamUnitClass } from '../TeamUnit';
import type { TeamAbility } from '../TeamAbility';
import type { TeamAbilityKind } from '../types';
import { RecoveryAura } from './RecoveryAura';
import { ComboAura } from './ComboAura';
import { Pursuit } from './Pursuit';
import { ChargeAbility } from './ChargeAbility';
import { TauntAbility } from './TauntAbility';

export interface LibraryPresetUnitConfig {
  id: string;
  name: string;
  side: 'A' | 'B';
  position: 'front' | 'back';
  baseAttrs: Partial<Record<AttributeType, number>>;
}

// ===== Roster 展示数据（供前端列出角色属性 + 技能说明） =====

export interface RosterAbilityInfo {
  id: string;
  name: string;
  kind: TeamAbilityKind;
  description: string;
}

export interface RosterUnitInfo {
  id: string;
  name: string;
  side: 'A' | 'B';
  position: 'front' | 'back';
  baseAttrs: Partial<Record<AttributeType, number>>;
  /** 派生：最大气血 = 400 + VITALITY×20 + ENDURANCE×3 */
  maxHp: number;
  abilities: RosterAbilityInfo[];
}

/** 由 6 维基础属性计算最大气血（与 AttributeSet.MAX_HP 公式一致） */
function computeMaxHp(attrs: Partial<Record<AttributeType, number>>): number {
  const vit = attrs[AttributeType.VITALITY] ?? 0;
  const end = attrs[AttributeType.ENDURANCE] ?? 0;
  return 400 + vit * 20 + end * 3;
}

/**
 * 技能库测试存档（2v2）
 *
 * A 队 —— 续航 + 控制 + 爆发：
 * - 前排：盾修·金钟（恢复光环 + 嘲讽）—— 高血高防，每回合治愈全队，嘲讽吸引敌方普攻
 * - 后排：阵法师·天机（蓄力）—— 80% 概率蓄力，下回合对敌方全体造成 300 真实伤害
 *
 * B 队 —— 物理输出 + 团队连携：
 * - 前排：刀客·断水（追击）—— 每次普攻后 60% 概率追加 3 倍物理伤害
 * - 后排：鼓手·雷鸣（连击光环）—— 友方每次普攻后 30% 概率再次普攻（可触发追击链）
 *
 * 对局看点：
 * 1. 嘲讽 vs 追击：A 前排嘲讽后，B 前排的普攻和追击都被强制指向 A 前排
 * 2. 连击光环 + 追击链：B 后排的光环让 B 前排追加普攻，追加的普攻可触发追击
 * 3. 蓄力爆发 vs 恢复续航：A 后排蓄力 300 AoE，A 前排每回合恢复 100 血
 */
export const LIBRARY_PRESET_UNITS: LibraryPresetUnitConfig[] = [
  {
    id: 'a_front_guardian',
    name: '盾修·金钟',
    side: 'A',
    position: 'front',
    baseAttrs: {
      [AttributeType.VITALITY]: 28,
      [AttributeType.STRENGTH]: 16,
      [AttributeType.SPIRIT]: 10,
      [AttributeType.ENDURANCE]: 26,
      [AttributeType.SPEED]: 16,
      [AttributeType.WILLPOWER]: 14,
    },
  },
  {
    id: 'a_back_charger',
    name: '阵法师·天机',
    side: 'A',
    position: 'back',
    baseAttrs: {
      [AttributeType.VITALITY]: 16,
      [AttributeType.STRENGTH]: 8,
      [AttributeType.SPIRIT]: 28,
      [AttributeType.ENDURANCE]: 12,
      [AttributeType.SPEED]: 20,
      [AttributeType.WILLPOWER]: 18,
    },
  },
  {
    id: 'b_front_blade',
    name: '刀客·断水',
    side: 'B',
    position: 'front',
    baseAttrs: {
      [AttributeType.VITALITY]: 20,
      [AttributeType.STRENGTH]: 28,
      [AttributeType.SPIRIT]: 8,
      [AttributeType.ENDURANCE]: 16,
      [AttributeType.SPEED]: 24,
      [AttributeType.WILLPOWER]: 10,
    },
  },
  {
    id: 'b_back_drummer',
    name: '鼓手·雷鸣',
    side: 'B',
    position: 'back',
    baseAttrs: {
      [AttributeType.VITALITY]: 16,
      [AttributeType.STRENGTH]: 10,
      [AttributeType.SPIRIT]: 18,
      [AttributeType.ENDURANCE]: 12,
      [AttributeType.SPEED]: 22,
      [AttributeType.WILLPOWER]: 24,
    },
  },
];

/**
 * 根据单位 ID 构建新技能实例（避免跨战斗状态泄漏）。
 */
function buildFreshLibraryAbilities(unitId: string): TeamAbility[] {
  switch (unitId) {
    case 'a_front_guardian':
      return [new RecoveryAura(), new TauntAbility()];
    case 'a_back_charger':
      return [new ChargeAbility()];
    case 'b_front_blade':
      return [new Pursuit()];
    case 'b_back_drummer':
      return [new ComboAura()];
    default:
      return [];
  }
}

/**
 * 构建技能库预设的 4 个 TeamUnit 实例。
 * 每次调用都创建新实例（避免跨战斗状态泄漏）。
 */
export function buildLibraryUnits(): [TeamUnit, TeamUnit, TeamUnit, TeamUnit] {
  return LIBRARY_PRESET_UNITS.map((config) => {
    const freshAbilities = buildFreshLibraryAbilities(config.id);
    return new TeamUnitClass({
      id: config.id,
      name: config.name,
      side: config.side,
      position: config.position,
      baseAttrs: config.baseAttrs,
      abilities: freshAbilities,
    });
  }) as [TeamUnit, TeamUnit, TeamUnit, TeamUnit];
}

// ============================================================
// 5v5 预设：10 个角色，两边技能搭配不同
// ============================================================

/**
 * 5v5 技能库测试存档
 *
 * A 队 —— 续航 + 连携流（2 奶 + 连击链 + 爆发）：
 * - 前排·盾修·金钟（恢复光环 + 嘲讽）—— 主坦克，每回合治愈全队并吸仇恨
 * - 前排·剑客·流云（追击）—— 物理输出，配合连击光环可触发追击链
 * - 后排·琴师·清心（恢复光环）—— 第二奶，双奶保证续航
 * - 后排·鼓手·雷鸣（连击光环）—— 全队普攻 30% 追加，可触发追击
 * - 后排·阵法师·天机（蓄力）—— 80% 蓄力 → 下回合 300 AoE 收割
 *
 * B 队 —— 物理爆发流（3 前排 + 双追击 + 远程爆发）：
 * - 前排·刀客·断水（追击）—— 主力物理输出，60% 3 倍追击
 * - 前排·枪客·破阵（嘲讽 + 追击）—— 副坦克吸火力，同时具备追击反击
 * - 前排·狂战士·血魄（连击光环）—— 前排连击增益，让前排双追击联动
 * - 后排·弓手·穿云（蓄力）—— 远程爆发，80% 蓄力 → 300 AoE
 * - 后排·咒师·蚀骨（恢复光环）—— 续航奶，保障 3 前排站场
 *
 * 对局看点：
 * 1. 阵型差异：A 队 2 前 3 后（保后排爆发），B 队 3 前 2 后（前排压制）
 * 2. 双奶 vs 单奶：A 队双恢复光环每回合回 200，B 队仅 100
 * 3. 双追击 vs 单追击：B 队双追击配合前排连击光环，物理爆发更强
 * 4. 嘲讽博弈：双方均有嘲讽，A 嘲讽保护后排奶/蓄力，B 嘲讽保护后排弓手
 * 5. 蓄力竞速：双方各一蓄力，谁先释放谁占优
 */
export const LIBRARY_5V5_PRESET_UNITS: LibraryPresetUnitConfig[] = [
  // ── A 队（2 前 3 后）──
  {
    id: 'a5_front_guardian',
    name: '盾修·金钟',
    side: 'A',
    position: 'front',
    baseAttrs: {
      [AttributeType.VITALITY]: 30,
      [AttributeType.STRENGTH]: 14,
      [AttributeType.SPIRIT]: 10,
      [AttributeType.ENDURANCE]: 28,
      [AttributeType.SPEED]: 14,
      [AttributeType.WILLPOWER]: 12,
    },
  },
  {
    id: 'a5_front_blade',
    name: '剑客·流云',
    side: 'A',
    position: 'front',
    baseAttrs: {
      [AttributeType.VITALITY]: 18,
      [AttributeType.STRENGTH]: 26,
      [AttributeType.SPIRIT]: 8,
      [AttributeType.ENDURANCE]: 16,
      [AttributeType.SPEED]: 22,
      [AttributeType.WILLPOWER]: 10,
    },
  },
  {
    id: 'a5_back_healer',
    name: '琴师·清心',
    side: 'A',
    position: 'back',
    baseAttrs: {
      [AttributeType.VITALITY]: 16,
      [AttributeType.STRENGTH]: 8,
      [AttributeType.SPIRIT]: 22,
      [AttributeType.ENDURANCE]: 12,
      [AttributeType.SPEED]: 18,
      [AttributeType.WILLPOWER]: 20,
    },
  },
  {
    id: 'a5_back_drummer',
    name: '鼓手·雷鸣',
    side: 'A',
    position: 'back',
    baseAttrs: {
      [AttributeType.VITALITY]: 14,
      [AttributeType.STRENGTH]: 10,
      [AttributeType.SPIRIT]: 16,
      [AttributeType.ENDURANCE]: 10,
      [AttributeType.SPEED]: 24,
      [AttributeType.WILLPOWER]: 18,
    },
  },
  {
    id: 'a5_back_charger',
    name: '阵法师·天机',
    side: 'A',
    position: 'back',
    baseAttrs: {
      [AttributeType.VITALITY]: 16,
      [AttributeType.STRENGTH]: 8,
      [AttributeType.SPIRIT]: 26,
      [AttributeType.ENDURANCE]: 12,
      [AttributeType.SPEED]: 20,
      [AttributeType.WILLPOWER]: 22,
    },
  },
  // ── B 队（3 前 2 后）──
  {
    id: 'b5_front_blade',
    name: '刀客·断水',
    side: 'B',
    position: 'front',
    baseAttrs: {
      [AttributeType.VITALITY]: 20,
      [AttributeType.STRENGTH]: 28,
      [AttributeType.SPIRIT]: 8,
      [AttributeType.ENDURANCE]: 16,
      [AttributeType.SPEED]: 24,
      [AttributeType.WILLPOWER]: 10,
    },
  },
  {
    id: 'b5_front_spear',
    name: '枪客·破阵',
    side: 'B',
    position: 'front',
    baseAttrs: {
      [AttributeType.VITALITY]: 24,
      [AttributeType.STRENGTH]: 20,
      [AttributeType.SPIRIT]: 8,
      [AttributeType.ENDURANCE]: 22,
      [AttributeType.SPEED]: 16,
      [AttributeType.WILLPOWER]: 12,
    },
  },
  {
    id: 'b5_front_berserker',
    name: '狂战士·血魄',
    side: 'B',
    position: 'front',
    baseAttrs: {
      [AttributeType.VITALITY]: 22,
      [AttributeType.STRENGTH]: 24,
      [AttributeType.SPIRIT]: 8,
      [AttributeType.ENDURANCE]: 18,
      [AttributeType.SPEED]: 20,
      [AttributeType.WILLPOWER]: 10,
    },
  },
  {
    id: 'b5_back_archer',
    name: '弓手·穿云',
    side: 'B',
    position: 'back',
    baseAttrs: {
      [AttributeType.VITALITY]: 14,
      [AttributeType.STRENGTH]: 24,
      [AttributeType.SPIRIT]: 10,
      [AttributeType.ENDURANCE]: 10,
      [AttributeType.SPEED]: 26,
      [AttributeType.WILLPOWER]: 12,
    },
  },
  {
    id: 'b5_back_curser',
    name: '咒师·蚀骨',
    side: 'B',
    position: 'back',
    baseAttrs: {
      [AttributeType.VITALITY]: 16,
      [AttributeType.STRENGTH]: 10,
      [AttributeType.SPIRIT]: 20,
      [AttributeType.ENDURANCE]: 12,
      [AttributeType.SPEED]: 18,
      [AttributeType.WILLPOWER]: 22,
    },
  },
];

/**
 * 5v5 各单位的技能配置（id → 技能工厂，返回新实例避免跨战斗状态泄漏）。
 */
function buildFreshLibrary5v5Abilities(unitId: string): TeamAbility[] {
  switch (unitId) {
    // A 队
    case 'a5_front_guardian':
      return [new RecoveryAura(), new TauntAbility()];
    case 'a5_front_blade':
      return [new Pursuit()];
    case 'a5_back_healer':
      return [new RecoveryAura()];
    case 'a5_back_drummer':
      return [new ComboAura()];
    case 'a5_back_charger':
      return [new ChargeAbility()];
    // B 队
    case 'b5_front_blade':
      return [new Pursuit()];
    case 'b5_front_spear':
      return [new TauntAbility(), new Pursuit()];
    case 'b5_front_berserker':
      return [new ComboAura()];
    case 'b5_back_archer':
      return [new ChargeAbility()];
    case 'b5_back_curser':
      return [new RecoveryAura()];
    default:
      return [];
  }
}

/**
 * 构建 5v5 技能库预设的 10 个 TeamUnit 实例。
 * 每次调用都创建新实例（避免跨战斗状态泄漏）。
 */
export function buildLibrary5v5Units(): TeamUnit[] {
  return LIBRARY_5V5_PRESET_UNITS.map((config) => {
    const freshAbilities = buildFreshLibrary5v5Abilities(config.id);
    return new TeamUnitClass({
      id: config.id,
      name: config.name,
      side: config.side,
      position: config.position,
      baseAttrs: config.baseAttrs,
      abilities: freshAbilities,
    });
  });
}

/**
 * 构建 5v5 阵容展示数据（供前端 Roster 面板列出角色属性 + 技能说明）。
 * 静态数据，不依赖战斗实例，可在未开战时展示。
 */
export function buildLibrary5v5Roster(): RosterUnitInfo[] {
  return LIBRARY_5V5_PRESET_UNITS.map((config) => {
    const abilities = buildFreshLibrary5v5Abilities(config.id);
    return {
      id: config.id,
      name: config.name,
      side: config.side,
      position: config.position,
      baseAttrs: config.baseAttrs,
      maxHp: computeMaxHp(config.baseAttrs),
      abilities: abilities.map((a) => ({
        id: a.id,
        name: a.name,
        kind: a.kind,
        description: a.description,
      })),
    };
  });
}
