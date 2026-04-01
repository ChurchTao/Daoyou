import { EffectConfig, ListenerConfig } from '../contracts/battle';
import { AffixEffectTranslator } from '../affixes/AffixEffectTranslator';
import { AffixRegistry } from '../affixes/AffixRegistry';
import { CREATION_SKILL_DEFAULTS } from '../config/CreationBalance';
import {
  ELEMENT_NAME_PREFIX,
  ELEMENT_TO_ABILITY_TAG,
} from '../config/CreationMappings';
import { CreationTags } from '../core/GameplayTags';
import { CreationSession } from '../CreationSession';
import { projectAbilityConfig, SkillProductModel } from '../models';
import { CreationBlueprint } from '../types';
import { getDominantQuality } from './shared';
import { buildAbilitySlug, ProductBlueprintComposer } from './types';

/**
 * 技能蓝图 Composer
 * 产出 active_skill（永远）
 * 核心词缀 → effects[0]；prefix/suffix 词缀 → 追加 effects / 独立 listeners
 */
export class SkillBlueprintComposer implements ProductBlueprintComposer {
  constructor(
    private readonly registry: AffixRegistry,
    private readonly translator: AffixEffectTranslator,
  ) {}

  compose(session: CreationSession): CreationBlueprint {
    const { intent, energyBudget, rolledAffixes, input } = session.state;
    if (!intent) throw new Error('Cannot compose blueprint before resolving intent');
    if (!energyBudget) throw new Error('Cannot compose blueprint before energy budgeting');

    const quality = getDominantQuality(session.state.materialFingerprints);
    const elementTag = intent.elementBias ? ELEMENT_TO_ABILITY_TAG[intent.elementBias] : undefined;
    const prefix = intent.elementBias ? ELEMENT_NAME_PREFIX[intent.elementBias] : '玄灵';
    const name = `${prefix}剑法`;

    // 分类词缀：无 listenerSpec 的放 effects[]；有 listenerSpec 的包成 listeners[]
    const directEffects: EffectConfig[] = [];
    const extraListeners: ListenerConfig[] = [];

    for (const rolled of rolledAffixes) {
      const def = this.registry.queryById(rolled.id);
      if (!def) continue;
      const effect = this.translator.translate(def, quality);
      if (def.listenerSpec) {
        extraListeners.push({
          eventType: def.listenerSpec.eventType,
          scope: def.listenerSpec.scope,
          priority: def.listenerSpec.priority,
          ...(def.listenerSpec.mapping
            ? { mapping: def.listenerSpec.mapping }
            : {}),
          ...(def.listenerSpec.guard ? { guard: def.listenerSpec.guard } : {}),
          effects: [effect],
        });
      } else {
        directEffects.push(effect);
      }
    }

    // 如果没有词缀效果，生成一个保底伤害
    if (directEffects.length === 0) {
      directEffects.push({
        type: 'damage',
        params: {
          value: {
            base: Math.max(
              CREATION_SKILL_DEFAULTS.minDamageBase,
              energyBudget.remaining,
            ),
          },
        },
      });
    }

    // 冷却与 mpCost 策略：由 core 词缀类型决定
    const coreAffix = rolledAffixes.find((r) => r.category === 'core');
    const coreDef = coreAffix ? this.registry.queryById(coreAffix.id) : undefined;
    const coreType = coreDef?.effectTemplate.type ?? 'damage';
    const cooldown =
      coreType === 'heal'
        ? CREATION_SKILL_DEFAULTS.healCooldown
        : coreType === 'apply_buff'
          ? CREATION_SKILL_DEFAULTS.buffCooldown
          : CREATION_SKILL_DEFAULTS.damageCooldown;
    const mpCost = Math.max(
      CREATION_SKILL_DEFAULTS.minMpCost,
      Math.round(energyBudget.total / 3),
    );
    const targetPolicy =
      coreType === 'heal'
        ? { team: 'self' as const, scope: 'single' as const }
        : { team: 'enemy' as const, scope: 'single' as const };

    const abilityTags = [
      'Ability.Type.Damage',
      ...(elementTag ? [elementTag] : []),
    ];

    const productModel: SkillProductModel = {
      productType: 'skill',
      outcomeKind: 'active_skill',
      slug: buildAbilitySlug(session.id, session.state.input.productType),
      name,
      description: `由${input.materials.map((m) => m.name).join('、')}炼制而成`,
      tags: [CreationTags.OUTCOME.ACTIVE_SKILL, ...abilityTags, ...intent.dominantTags],
      affixes: rolledAffixes,
      abilityTags,
      mpCost,
      cooldown,
      priority: 10 + rolledAffixes.length,
      targetPolicy,
      effects: directEffects,
      ...(extraListeners.length > 0 ? { listeners: extraListeners } : {}),
      battleProjection: {
        projectionKind: 'active_skill',
        abilityTags,
        mpCost,
        cooldown,
        priority: 10 + rolledAffixes.length,
        targetPolicy,
        effects: directEffects,
        ...(extraListeners.length > 0 ? { listeners: extraListeners } : {}),
      },
    };

    return {
      outcomeKind: productModel.outcomeKind,
      productModel,
      abilityConfig: projectAbilityConfig(productModel),
      name: productModel.name,
      description: productModel.description,
      tags: productModel.tags,
      affixes: productModel.affixes,
    };
  }
}
