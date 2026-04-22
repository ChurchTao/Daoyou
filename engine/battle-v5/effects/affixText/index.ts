/**
 * 词缀渲染主入口：`renderAffixLine(affix, quality, abilityConfig?)`
 *
 * 流水线：
 *   1. 从 DEFAULT_AFFIX_REGISTRY 拉取 AffixDefinition（提供 listenerSpec + 最新的 effectTemplate）。
 *   2. 针对 attribute_modifier / random_attribute_modifier：走 abilityConfig.modifiers 匹配真实数值。
 *   3. 其它类型：用 AffixEffectTranslator 按品质重新解析 effectTemplate，得到等价于战斗运行时
 *      使用的 EffectConfig；再由 describeEffectCore 格式化。
 *   4. 组合：`[监听前缀] [条件] [效果核心]`。
 */
import type { RolledAffix } from '@/engine/creation-v2/types';
import type { Quality } from '@/types/constants';
import type {
  AbilityConfig,
  AttributeModifierConfig,
  EffectConfig,
} from '../../core/configs';
import { AttributeType, ModifierType } from '../../core/types';
import {
  AffixEffectTranslator,
  DEFAULT_AFFIX_REGISTRY,
  type AffixEffectTemplate,
  type AffixListenerSpec,
  type AffixRegistry,
} from '@/engine/creation-v2/affixes';
import type { AffixDefinition } from '@/engine/creation-v2/affixes';
import { attrLabel } from './attributes';
import { describeConditions } from './conditions';
import { describeEffectCore } from './effectCore';
import { describeListener } from './listeners';
import { formatAffixNumber, formatAffixPercent } from './format';

export interface RenderAffixOptions {
  registry?: AffixRegistry;
  abilityConfig?: AbilityConfig;
}

export type AffixRarity = 'common' | 'uncommon' | 'rare' | 'legendary';

export interface RenderedAffixLine {
  id: string;
  name: string;
  rarity: AffixRarity;
  isPerfect: boolean;
  bodyText: string;
}

const DEFAULT_RARITY: AffixRarity = 'common';

const PERCENT_ATTRS = new Set<AttributeType>([
  AttributeType.CRIT_RATE,
  AttributeType.CRIT_DAMAGE_MULT,
  AttributeType.EVASION_RATE,
  AttributeType.CONTROL_HIT,
  AttributeType.CONTROL_RESISTANCE,
  AttributeType.ARMOR_PENETRATION,
  AttributeType.MAGIC_PENETRATION,
  AttributeType.CRIT_RESIST,
  AttributeType.CRIT_DAMAGE_REDUCTION,
  AttributeType.ACCURACY,
  AttributeType.HEAL_AMPLIFY,
]);

const translator = new AffixEffectTranslator();

/**
 * 根据 RolledAffix + 品质（+ 可选的 abilityConfig）渲染一条词缀展示信息。
 *
 * 设计目标：让展示层拿到一个已经"完全准备好"的对象，视图只做颜色与布局。
 */
export function renderAffixLine(
  affix: RolledAffix,
  quality: Quality,
  options: RenderAffixOptions = {},
): RenderedAffixLine {
  const registry = options.registry ?? DEFAULT_AFFIX_REGISTRY;
  const definition = registry.queryById(affix.id);

  const rarity =
    ((affix as { rarity?: AffixRarity }).rarity as AffixRarity) ??
    definition?.rarity ??
    DEFAULT_RARITY;
  const name = (affix.name as string) ?? definition?.displayName ?? affix.id;
  const template = affix.effectTemplate ?? definition?.effectTemplate;
  const listenerSpec = definition?.listenerSpec;

  const bodyText = buildBodyText({
    affix,
    quality,
    template,
    listenerSpec,
    abilityConfig: options.abilityConfig,
  });

  return {
    id: affix.id,
    name,
    rarity,
    isPerfect: affix.isPerfect,
    bodyText,
  };
}

// --- 内部实现 ---

interface BuildBodyArgs {
  affix: RolledAffix;
  quality: Quality;
  template?: AffixEffectTemplate;
  listenerSpec?: AffixListenerSpec;
  abilityConfig?: AbilityConfig;
}

function buildBodyText(args: BuildBodyArgs): string {
  const { affix, quality, template, listenerSpec, abilityConfig } = args;
  if (!template) return '';

  // 静态属性类词条走 modifier 分支：listener/condition 对它们无意义。
  if (
    template.type === 'attribute_modifier' ||
    template.type === 'random_attribute_modifier'
  ) {
    return describeAttributeModifiers(template, abilityConfig, quality, affix);
  }

  const effect = resolveEffectConfig(affix, quality);
  if (!effect) return '';

  const listenerText = describeListener(listenerSpec);
  const conditionText = describeConditions(effect.conditions);
  const coreText = describeEffectCore(effect);

  return joinSegments(listenerText, conditionText, coreText);
}

function resolveEffectConfig(
  affix: RolledAffix,
  quality: Quality,
): EffectConfig | null {
  try {
    return translator.translate(affix, quality);
  } catch {
    return null;
  }
}

/**
 * 把多段文本用"，"拼接为自然句，自动忽略空段。
 * 最后一段若以 "时" 结尾则不额外添加标点。
 */
function joinSegments(...parts: string[]): string {
  const cleaned = parts.map((p) => p.trim()).filter((p) => p.length > 0);
  if (cleaned.length === 0) return '';
  if (cleaned.length === 1) return cleaned[0];

  // 监听前缀以 "时" / "每回合" 收尾时，与后续段落用一个空格分开即可
  // 其它情况用 "，" 分隔。
  const first = cleaned[0];
  const rest = cleaned.slice(1).join('，');
  if (/时$|每回合$/.test(first)) {
    return `${first} ${rest}`;
  }
  return `${first}，${rest}`;
}

// --- 静态属性词条处理 ---

function describeAttributeModifiers(
  template: AffixEffectTemplate,
  abilityConfig: AbilityConfig | undefined,
  quality: Quality,
  affix: RolledAffix,
): string {
  const pickedAttrs = collectTemplateAttrs(template);

  // 优先使用 abilityConfig.modifiers 中真实落地的数值（已含随机选择结果）
  const modifiersFromConfig = (abilityConfig?.modifiers ?? []).filter((m) =>
    pickedAttrs.has(m.attrType),
  );
  if (modifiersFromConfig.length > 0) {
    return modifiersFromConfig.map(formatModifier).join('、');
  }

  // 兜底：无 abilityConfig 时按 template 解析
  return resolveTemplateModifiers(template, quality, affix)
    .map(formatModifier)
    .join('、');
}

function collectTemplateAttrs(template: AffixEffectTemplate): Set<AttributeType> {
  const attrs = new Set<AttributeType>();
  if (template.type === 'attribute_modifier') {
    const params = template.params;
    const mods = 'modifiers' in params ? params.modifiers : [params];
    mods.forEach((m) => attrs.add(m.attrType));
  } else if (template.type === 'random_attribute_modifier') {
    template.params.pool.forEach((m) => attrs.add(m.attrType));
  }
  return attrs;
}

function resolveTemplateModifiers(
  template: AffixEffectTemplate,
  quality: Quality,
  affix: RolledAffix,
): AttributeModifierConfig[] {
  const q = qualityOrder(quality);

  if (template.type === 'attribute_modifier') {
    const params = template.params;
    const mods = 'modifiers' in params ? params.modifiers : [params];
    return mods.map((m) => ({
      attrType: m.attrType,
      type: m.modType,
      value: translator.resolveParam(m.value, q, affix.finalMultiplier),
    }));
  }

  if (template.type === 'random_attribute_modifier') {
    // 无 abilityConfig 兜底：展示整个候选池（便于规划/预览）
    return template.params.pool.map((m) => ({
      attrType: m.attrType,
      type: m.modType,
      value: translator.resolveParam(m.value, q, affix.finalMultiplier),
    }));
  }

  return [];
}

function qualityOrder(quality: Quality): number {
  // 局部 import 避免循环依赖：直接用字符串映射
  const ORDER: Record<Quality, number> = {
    凡品: 0,
    灵品: 1,
    玄品: 2,
    真品: 3,
    地品: 4,
    天品: 5,
    仙品: 6,
    神品: 7,
  };
  return ORDER[quality] ?? 0;
}

function formatModifier(mod: AttributeModifierConfig): string {
  const label = attrLabel(mod.attrType);
  const value = mod.value;
  const abs = Math.abs(value);
  const sign = value >= 0 ? '+' : '-';

  switch (mod.type) {
    case ModifierType.ADD:
      // ADD 语义：final *= 1 + sum（百分比加法）
      return `${label} ${sign}${formatAffixPercent(abs)}`;
    case ModifierType.MULTIPLY:
      return `${label} ×${formatAffixNumber(value)}`;
    case ModifierType.BASE:
    case ModifierType.FIXED:
    default: {
      if (PERCENT_ATTRS.has(mod.attrType)) {
        return `${label} ${sign}${formatAffixPercent(abs)}`;
      }
      return `${label} ${sign}${formatAffixNumber(abs)}`;
    }
  }
}

/**
 * 给视图层使用的文字稀有度 tone（与现有 AffixView.rarityTone 保持兼容）
 */
export function rarityToTone(
  rarity: AffixRarity,
): 'muted' | 'info' | 'rare' | 'legendary' {
  switch (rarity) {
    case 'legendary':
      return 'legendary';
    case 'rare':
      return 'rare';
    case 'uncommon':
      return 'info';
    case 'common':
    default:
      return 'muted';
  }
}
