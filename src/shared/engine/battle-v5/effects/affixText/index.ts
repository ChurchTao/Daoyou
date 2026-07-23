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
import {
  AffixEffectTranslator,
  DEFAULT_AFFIX_REGISTRY,
  type AffixEffectTemplate,
  type AffixListenerSpec,
  type AffixRegistry,
} from '@shared/engine/creation-v2/affixes';
import { GameplayTags } from '@shared/engine/shared/tag-domain';
import type { RolledAffix } from '@shared/engine/creation-v2/types';
import type { Quality } from '@shared/types/constants';
import type {
  AbilityConfig,
  AttributeModifierConfig,
  BuffConfig,
  EffectConfig,
  GlobalUniqueConfig,
} from '../../core/configs';
import { isPercentageAttributeType } from '../../core/attributeMeta';
import { AttributeType, ModifierType } from '../../core/types';
import { attrLabel } from './attributes';
import { describeConditions } from './conditions';
import type { AffixTextRenderContext } from './context';
import { describeEffectCore } from './effectCore';
import { formatAffixNumber, formatAffixPercent } from './format';
import {
  inferDamageTypeLabels,
  labelGameplayTags,
} from './gameplayTagText';
import { describeListener } from './listeners';
import { formatScalableValue } from './values';
import {
  describeApplyBuffText,
  describeBuffListener,
  describeBuffType,
  describeStackRule,
  formatBuffModifier,
} from './buffText';

export interface RenderAffixOptions {
  registry?: AffixRegistry;
  abilityConfig?: AbilityConfig;
  resolvedModifiers?: AttributeModifierConfig[];
  abilityTags?: string[];
}

export type AffixRarity = 'common' | 'uncommon' | 'rare' | 'legendary';

export interface RenderedAffixLine {
  id: string;
  name: string;
  rarity: AffixRarity;
  isPerfect: boolean;
  bodyText: string;
  globalUniqueText?: string;
}

export interface AffixBuffDetailView {
  name: string;
  descriptionText?: string;
  typeText: string;
  durationText: string;
  stackText: string;
  chanceText?: string;
  modifierTexts: string[];
  listenerTexts: string[];
  tagLabels: string[];
}

export interface AffixMechanicView extends RenderedAffixLine {
  intentText?: string;
  triggerText?: string;
  conditionTexts: string[];
  effectText: string;
  formulaText?: string;
  buffDetails: AffixBuffDetailView[];
  damageTypeLabels: string[];
  tagLabels: string[];
  mechanicNotes: string[];
}

const DEFAULT_RARITY: AffixRarity = 'common';

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
  const mechanic = renderAffixMechanic(affix, quality, options);
  return {
    id: mechanic.id,
    name: mechanic.name,
    rarity: mechanic.rarity,
    isPerfect: mechanic.isPerfect,
    bodyText: mechanic.bodyText,
    globalUniqueText: mechanic.globalUniqueText,
  };
}

/**
 * 生成玩家可读的结构化机制说明。详情弹窗使用该对象展示完整解释；
 * 列表与紧凑视图继续读取 bodyText，保持原有信息密度。
 */
export function renderAffixMechanic(
  affix: RolledAffix,
  quality: Quality,
  options: RenderAffixOptions = {},
): AffixMechanicView {
  const registry = options.registry ?? DEFAULT_AFFIX_REGISTRY;
  const definition = registry.queryById(affix.id);

  const rarity =
    ((affix as { rarity?: AffixRarity }).rarity as AffixRarity) ??
    definition?.rarity ??
    DEFAULT_RARITY;
  const name = (affix.name as string) ?? definition?.displayName ?? affix.id;
  const template = affix.effectTemplate ?? definition?.effectTemplate;
  const listenerSpec = definition?.listenerSpec;
  const scopedAbilityTags = buildScopedAbilityTags(affix, options.abilityTags);

  const bodyText = buildBodyText({
    affix,
    quality,
    template,
    listenerSpec,
    abilityConfig: options.abilityConfig,
    resolvedModifiers: options.resolvedModifiers,
    abilityTags: scopedAbilityTags,
  });

  const detail = buildMechanicDetail({
    affix,
    quality,
    template,
    listenerSpec,
    abilityConfig: options.abilityConfig,
    resolvedModifiers: options.resolvedModifiers,
    abilityTags: scopedAbilityTags,
  });

  return {
    id: affix.id,
    name,
    rarity,
    isPerfect: affix.isPerfect,
    bodyText: appendGlobalUniqueText(bodyText, definition?.globalUnique),
    globalUniqueText: formatGlobalUniqueText(definition?.globalUnique),
    intentText: definition?.displayDescription ?? affix.description,
    ...detail,
  };
}

// --- 内部实现 ---

function buildScopedAbilityTags(
  affix: RolledAffix,
  productAbilityTags: string[] | undefined,
): string[] | undefined {
  const affixTags = affix.grantedAbilityTags ?? [];
  if (affixTags.length > 0) {
    return Array.from(new Set(affixTags));
  }
  return productAbilityTags;
}

interface BuildBodyArgs {
  affix: RolledAffix;
  quality: Quality;
  template?: AffixEffectTemplate;
  listenerSpec?: AffixListenerSpec;
  abilityConfig?: AbilityConfig;
  resolvedModifiers?: AttributeModifierConfig[];
  abilityTags?: string[];
}

function buildBodyText(args: BuildBodyArgs): string {
  const {
    affix,
    quality,
    template,
    listenerSpec,
    abilityConfig,
    resolvedModifiers,
    abilityTags,
  } = args;
  if (!template) return '';

  // 静态属性类词条走 modifier 分支：listener/condition 对它们无意义。
  if (
    template.type === 'attribute_modifier' ||
    template.type === 'random_attribute_modifier'
  ) {
    return describeAttributeModifiers(template, abilityConfig, quality, affix, resolvedModifiers);
  }

  const effect = resolveEffectConfig(affix, template, quality);
  if (!effect) return '';

  const renderContext: AffixTextRenderContext | undefined = listenerSpec
    ? {
        eventType: listenerSpec.eventType,
        listenerScope: listenerSpec.scope,
      }
    : undefined;
  const conditionText = describeConditions(effect.conditions, renderContext);
  const listenerText = shouldOmitListenerText(listenerSpec, conditionText)
    ? ''
    : describeListener(listenerSpec, renderContext);
  const coreText =
    effect.type === 'apply_buff'
      ? describeApplyBuffInline(effect.params.buffConfig, effect.params.chance)
      : describeEffectCore(effect, {
          abilityTags,
          listenerScope: listenerSpec?.scope,
        });

  return joinSegments(listenerText, conditionText, coreText);
}

function formatGlobalUniqueText(
  globalUnique: GlobalUniqueConfig | undefined,
): string | undefined {
  if (!globalUnique) return undefined;
  return globalUnique.label ? `全局唯一：${globalUnique.label}` : '全局唯一';
}

function appendGlobalUniqueText(
  bodyText: string,
  globalUnique: GlobalUniqueConfig | undefined,
): string {
  if (!globalUnique) return bodyText;
  return bodyText ? `${bodyText}（全局唯一）` : '全局唯一';
}

interface MechanicDetail {
  triggerText?: string;
  conditionTexts: string[];
  effectText: string;
  formulaText?: string;
  buffDetails: AffixBuffDetailView[];
  damageTypeLabels: string[];
  tagLabels: string[];
  mechanicNotes: string[];
}

function buildMechanicDetail(args: BuildBodyArgs): MechanicDetail {
  const {
    affix,
    quality,
    template,
    listenerSpec,
    abilityConfig,
    resolvedModifiers,
    abilityTags,
  } = args;

  if (!template) {
    return emptyMechanicDetail();
  }

  if (
    template.type === 'attribute_modifier' ||
    template.type === 'random_attribute_modifier'
  ) {
    const effectText = describeAttributeModifiers(
      template,
      abilityConfig,
      quality,
      affix,
      resolvedModifiers,
    );
    return {
      ...emptyMechanicDetail(),
      effectText,
      formulaText: effectText,
    };
  }

  const effect = resolveEffectConfig(affix, template, quality);
  if (!effect) {
    return emptyMechanicDetail();
  }

  const renderContext: AffixTextRenderContext | undefined = listenerSpec
    ? {
        eventType: listenerSpec.eventType,
        listenerScope: listenerSpec.scope,
      }
    : undefined;
  const conditionText = describeConditions(effect.conditions, renderContext);
  const triggerText = shouldOmitListenerText(listenerSpec, conditionText)
    ? undefined
    : describeListener(listenerSpec, renderContext) || undefined;
  const effectText = describeEffectCore(effect, {
    abilityTags,
    listenerScope: listenerSpec?.scope,
    ...(effect.type === 'apply_buff'
      ? { buffTags: effect.params.buffConfig.tags }
      : {}),
  });

  return {
    triggerText,
    conditionTexts: conditionText ? [conditionText] : [],
    effectText,
    formulaText: describeFormula(effect),
    buffDetails: collectBuffDetails(effect),
    damageTypeLabels:
      effect.type === 'damage'
        ? inferDamageTypeLabels({
            abilityTags,
            explicitDamageType: effect.params.damageType,
            valueAttribute: effect.params.value.attribute,
          })
        : [],
    tagLabels: collectRuntimeTagLabels(affix, effect, abilityTags),
    mechanicNotes: [
      ...buildMechanicNotes(effect),
      ...(formatGlobalUniqueText(affix.globalUnique)
        ? [formatGlobalUniqueText(affix.globalUnique)!]
        : []),
    ],
  };
}

function emptyMechanicDetail(): MechanicDetail {
  return {
    conditionTexts: [],
    effectText: '',
    buffDetails: [],
    damageTypeLabels: [],
    tagLabels: [],
    mechanicNotes: [],
  };
}

function shouldOmitListenerText(
  listenerSpec: AffixListenerSpec | undefined,
  conditionText: string,
): boolean {
  if (!listenerSpec || conditionText.length === 0) return false;

  const isSpecificDamageCondition = /^(造成|受到|将受).+伤害时$/.test(conditionText);
  if (!isSpecificDamageCondition) return false;

  return (
    listenerSpec.eventType === 'DamageRequestEvent' ||
    listenerSpec.eventType === 'DamageTakenEvent'
  );
}

function resolveEffectConfig(
  affix: RolledAffix,
  template: AffixEffectTemplate,
  quality: Quality,
): EffectConfig | null {
  try {
    // 使用已解析的 template（可能来自注册表兜底），而非直接读 affix.effectTemplate
    // 防止精简存储后 affix.effectTemplate 缺失导致翻译抛异常
    const effective: RolledAffix = affix.effectTemplate
      ? affix
      : { ...affix, effectTemplate: template };
    return translator.translate(effective, quality);
  } catch {
    return null;
  }
}

function describeFormula(effect: EffectConfig): string | undefined {
  switch (effect.type) {
    case 'damage':
    case 'shield':
    case 'mana_burn':
      return formatScalableValue(effect.params.value);
    case 'heal':
      return formatScalableValue(effect.params.value);
    case 'percent_damage_modifier': {
      const capText =
        effect.params.cap !== undefined
          ? `，上限 ${formatAffixPercent(effect.params.cap)}`
          : '';
      return `${formatAffixPercent(effect.params.value)}${capText}`;
    }
    case 'resource_drain':
      return formatAffixPercent(effect.params.ratio);
    case 'reflect':
      return formatAffixPercent(effect.params.ratio);
    case 'magic_shield':
      return `吸收 ${formatAffixPercent(effect.params.absorbRatio ?? 0.98)}`;
    case 'cooldown_modify':
      return `${formatAffixNumber(Math.abs(effect.params.cdModifyValue))} 回合`;
    case 'tag_trigger':
      return effect.params.damageRatio !== undefined
        ? `额外伤害系数 ${formatAffixPercent(effect.params.damageRatio)}`
        : undefined;
    case 'damage_memory':
      return effect.params.ratio !== undefined
        ? formatAffixPercent(effect.params.ratio)
        : undefined;
    case 'hp_sacrifice_damage':
      return formatAffixPercent(effect.params.hpRatio);
    case 'damage_defer':
      return formatAffixPercent(effect.params.ratio);
    case 'ability_lock':
      return `${effect.params.rounds} 回合`;
    case 'apply_buff':
      return effect.params.chance !== undefined
        ? `附加概率 ${formatAffixPercent(effect.params.chance)}`
        : undefined;
    case 'death_prevent':
      return effect.params.hpFloorPercent !== undefined
        ? `保留 ${formatAffixPercent(effect.params.hpFloorPercent)} 气血`
        : '保留 1 点气血';
    case 'buff_immunity':
    case 'damage_immunity':
    case 'dispel':
    case 'buff_duration_modify':
    case 'consume_status_trigger':
    case 'delayed_effect':
    case 'buff_layer_modify':
    case 'ability_transform':
    case 'status_spread':
    case 'buff_copy':
    case 'next_hit_rule':
    case 'dynamic_scalar':
    case 'turn_state_counter':
    case 'runtime_counter_modify':
    case 'effect_sequence':
    case 'refund_paid_cost':
    case 'mechanic_log':
      return undefined;
  }
}

function describeBuffDetail(
  buff: BuffConfig,
  chance: number | undefined,
): AffixBuffDetailView {
  const tagLabels = labelGameplayTags([
    ...(buff.tags ?? []),
    ...(buff.statusTags ?? []),
  ]);
  return {
    name: buff.name,
    ...(buff.description ? { descriptionText: buff.description } : {}),
    typeText: describeBuffType(buff.type),
    durationText: buff.duration === -1 ? '常驻' : `${buff.duration} 回合`,
    stackText: describeStackRule(buff.stackRule),
    ...(chance !== undefined
      ? { chanceText: formatAffixPercent(chance) }
      : {}),
    modifierTexts: (buff.modifiers ?? []).map(formatBuffModifier),
    listenerTexts: (buff.listeners ?? []).map((listener) =>
      describeBuffListener(listener, buff.tags, (effect, effectContext) =>
        describeEffectCore(effect, effectContext),
      ),
    ),
    tagLabels,
  };
}

function collectBuffDetails(effect: EffectConfig): AffixBuffDetailView[] {
  switch (effect.type) {
    case 'apply_buff':
      return [describeBuffDetail(effect.params.buffConfig, effect.params.chance)];
    case 'effect_sequence':
    case 'turn_state_counter':
      return effect.params.effects.flatMap(collectBuffDetails);
    case 'runtime_counter_modify':
      return effect.params.effects?.flatMap(collectBuffDetails) ?? [];
    case 'consume_status_trigger':
    case 'delayed_effect':
      return effect.params.effects.flatMap(collectBuffDetails);
    case 'buff_layer_modify':
      return effect.params.effects?.flatMap(collectBuffDetails) ?? [];
    case 'tag_trigger':
      return effect.params.effects?.flatMap(collectBuffDetails) ?? [];
    default:
      return [];
  }
}

function describeApplyBuffInline(
  buff: BuffConfig,
  chance: number | undefined,
): string {
  return describeApplyBuffText(buff, chance, undefined, (effect, effectContext) =>
    describeEffectCore(effect, effectContext),
  );
}

function collectRuntimeTagLabels(
  affix: RolledAffix,
  effect: EffectConfig,
  abilityTags: string[] | undefined,
): string[] {
  const tags = new Set<string>();
  const collect = (tag?: string) => {
    if (!tag) return;
    if (
      tag.startsWith('Ability.') ||
      tag.startsWith('Status.') ||
      tag.startsWith('Buff.') ||
      tag.startsWith('Trait.')
    ) {
      tags.add(tag);
    }
  };

  abilityTags?.forEach(collect);
  affix.grantedAbilityTags?.forEach(collect);
  effect.conditions?.forEach((condition) => collect(condition.params.tag));

  switch (effect.type) {
    case 'apply_buff':
      effect.params.buffConfig.tags?.forEach(collect);
      effect.params.buffConfig.statusTags?.forEach(collect);
      effect.params.buffConfig.listeners?.forEach((listener) =>
        listener.effects.forEach((listenerEffect) => {
          collectEffectTags(listenerEffect).forEach(collect);
        }),
      );
      break;
    case 'cooldown_modify':
      effect.params.tags?.forEach(collect);
      break;
    case 'tag_trigger':
      collect(effect.params.triggerTag);
      break;
    case 'buff_immunity':
    case 'damage_immunity':
      effect.params.tags.forEach(collect);
      break;
    case 'dispel':
      collect(effect.params.targetTag);
      break;
    default:
      break;
  }

  return labelGameplayTags(Array.from(tags));
}

function collectEffectTags(effect: EffectConfig): string[] {
  switch (effect.type) {
    case 'apply_buff':
      return [
        ...(effect.params.buffConfig.tags ?? []),
        ...(effect.params.buffConfig.statusTags ?? []),
        ...(effect.params.buffConfig.listeners?.flatMap((listener) =>
          listener.effects.flatMap(collectEffectTags),
        ) ?? []),
      ];
    case 'cooldown_modify':
      return effect.params.tags ?? [];
    case 'tag_trigger':
      return [
        effect.params.triggerTag,
        ...(effect.params.effects?.flatMap(collectEffectTags) ?? []),
      ];
    case 'consume_status_trigger':
      return [
        ...(effect.params.match.tags ?? []),
        ...effect.params.effects.flatMap(collectEffectTags),
      ];
    case 'delayed_effect':
      return [
        ...(effect.params.tags ?? []),
        ...(effect.params.statusTags ?? []),
        ...effect.params.effects.flatMap(collectEffectTags),
      ];
    case 'buff_layer_modify':
      return [
        ...(effect.params.match.tags ?? []),
        ...(effect.params.effects?.flatMap(collectEffectTags) ?? []),
      ];
    case 'ability_transform':
      return [
        ...(effect.params.appliesToTags ?? []),
        ...(effect.params.addDispel?.targetTag
          ? [effect.params.addDispel.targetTag]
          : []),
      ];
    case 'next_hit_rule':
      return effect.params.appliesToTags ?? [];
    case 'ability_lock':
      return effect.params.tags ?? [];
    case 'status_spread':
      return effect.params.match.tags ?? [];
    case 'buff_copy':
      return effect.params.match?.tags ?? [];
    case 'turn_state_counter':
      return effect.params.effects.flatMap(collectEffectTags);
    case 'runtime_counter_modify':
      return effect.params.effects?.flatMap(collectEffectTags) ?? [];
    case 'effect_sequence':
      return effect.params.effects.flatMap(collectEffectTags);
    case 'buff_immunity':
    case 'damage_immunity':
      return effect.params.tags;
    case 'dispel':
      return effect.params.targetTag ? [effect.params.targetTag] : [];
    default:
      return [];
  }
}

function buildMechanicNotes(effect: EffectConfig): string[] {
  if (effect.type !== 'apply_buff') return [];
  const buff = effect.params.buffConfig;
  const notes: string[] = [];
  if (buff.tags?.includes(GameplayTags.BUFF.DOT.ROOT)) {
    notes.push('DOT 会在行动前结算，并按当前层数放大。');
  }
  if (buff.statusTags?.includes(GameplayTags.STATUS.CONTROL.NO_ACTION)) {
    notes.push('无法行动会跳过该单位的出手机会。');
  }
  if (buff.statusTags?.includes(GameplayTags.STATUS.CONTROL.NO_SKILL)) {
    notes.push('无法施放神通会限制主动技能。');
  }
  return notes;
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
  if (/时$|后$|每回合$/.test(first)) {
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
  resolvedModifiers?: AttributeModifierConfig[],
): string {
  if (resolvedModifiers && resolvedModifiers.length > 0) {
    return resolvedModifiers.map(formatModifier).join('、');
  }

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

function collectTemplateAttrs(
  template: AffixEffectTemplate,
): Set<AttributeType> {
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
      if (isPercentageAttributeType(mod.attrType)) {
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
