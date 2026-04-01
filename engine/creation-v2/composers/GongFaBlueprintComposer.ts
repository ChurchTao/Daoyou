import {
  AttributeType,
  BuffType,
  ModifierType,
  StackRule,
} from '../contracts/battle';
import { AffixEffectTranslator } from '../affixes/AffixEffectTranslator';
import { AffixRegistry } from '../affixes/AffixRegistry';
import { CREATION_LISTENER_PRIORITIES } from '../config/CreationBalance';
import { CreationTags } from '../core/GameplayTags';
import { CreationSession } from '../CreationSession';
import { GongFaProductModel, projectAbilityConfig } from '../models';
import { CreationBlueprint } from '../types';
import { buildGroupedListeners, getDominantQuality } from './shared';
import { buildAbilitySlug, ProductBlueprintComposer } from './types';

/**
 * 功法蓝图 Composer
 * 领域层产出 gongfa，战斗层投影为 passive ability
 * core 词缀 → attribute_stat_buff 包装在 ActionPreEvent listener（priority=100）
 * prefix/suffix 词缀 → 依 listenerSpec 包装，相同 key 的词缀合并为一个 listener
 */
export class GongFaBlueprintComposer implements ProductBlueprintComposer {
  constructor(
    private readonly registry: AffixRegistry,
    private readonly translator: AffixEffectTranslator,
  ) {}

  compose(session: CreationSession): CreationBlueprint {
    const { intent, energyBudget, rolledAffixes, input } = session.state;
    if (!intent) throw new Error('Cannot compose blueprint before resolving intent');
    if (!energyBudget) throw new Error('Cannot compose blueprint before energy budgeting');

    const quality = getDominantQuality(session.state.materialFingerprints);

    const listeners = buildGroupedListeners({
      registry: this.registry,
      translator: this.translator,
      rolledAffixes,
      quality,
      defaultListenerSpec: {
        eventType: 'ActionPreEvent',
        scope: 'owner_as_actor',
        priority: CREATION_LISTENER_PRIORITIES.actionPreBuff,
      },
    });

    // 保底：若无词缀，添加一个基础灵力属性提升
    if (listeners.length === 0) {
      listeners.push({
        eventType: 'ActionPreEvent',
        scope: 'owner_as_actor',
        priority: CREATION_LISTENER_PRIORITIES.actionPreBuff,
        effects: [
          {
            type: 'apply_buff',
            params: {
              buffConfig: {
                id: 'gongfa-fallback-spirit',
                name: '基础灵脉',
                type: BuffType.BUFF,
                duration: -1,
                stackRule: StackRule.IGNORE,
                modifiers: [
                  {
                    attrType: AttributeType.SPIRIT,
                    type: ModifierType.FIXED,
                    value: 3,
                  },
                ],
              },
            },
          },
        ],
      });
    }

    const name = `${input.materials[0]?.name ?? ''}心法`;

    const productModel: GongFaProductModel = {
      productType: 'gongfa',
      outcomeKind: 'gongfa',
      slug: buildAbilitySlug(session.id, session.state.input.productType),
      name,
      description: `由${input.materials.map((m) => m.name).join('、')}炼制而成`,
      tags: [
        CreationTags.OUTCOME.PASSIVE_ABILITY,
        CreationTags.OUTCOME.GONGFA,
        ...intent.dominantTags,
      ],
      affixes: rolledAffixes,
      abilityTags: ['GongFa'],
      equipPolicy: 'single_manual',
      persistencePolicy: 'inventory_bound',
      progressionPolicy: 'comprehension',
      gongfaConfig: {
        equipPolicy: 'single_manual',
        persistencePolicy: 'inventory_bound',
        progressionPolicy: 'comprehension',
      },
      battleProjection: {
        projectionKind: 'gongfa_passive',
        abilityTags: ['GongFa'],
        listeners,
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
