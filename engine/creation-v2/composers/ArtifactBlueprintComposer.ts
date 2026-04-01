import { AffixEffectTranslator } from '../affixes/AffixEffectTranslator';
import { AffixRegistry } from '../affixes/AffixRegistry';
import {
  CREATION_LISTENER_PRIORITIES,
  CREATION_PASSIVE_DEFAULTS,
} from '../config/CreationBalance';
import { ELEMENT_TO_ABILITY_TAG } from '../config/CreationMappings';
import { CreationTags } from '../core/GameplayTags';
import { CreationSession } from '../CreationSession';
import { ArtifactProductModel, projectAbilityConfig } from '../models';
import { CreationBlueprint } from '../types';
import { buildGroupedListeners, getDominantQuality } from './shared';
import { buildAbilitySlug, ProductBlueprintComposer } from './types';

/**
 * 法宝蓝图 Composer
 * 领域层产出 artifact，战斗层投影为 passive ability
 * 每个词缀依 listenerSpec 包装为独立 listener；无 listenerSpec 则默认 DamageTakenEvent
 * slot 来自 intent.slotBias，写入 artifact 领域字段
 */
export class ArtifactBlueprintComposer implements ProductBlueprintComposer {
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

    const listeners = buildGroupedListeners({
      registry: this.registry,
      translator: this.translator,
      rolledAffixes,
      quality,
      defaultListenerSpec: {
        eventType: 'DamageTakenEvent',
        scope: 'owner_as_target',
        priority: CREATION_LISTENER_PRIORITIES.damageTaken,
      },
    });

    // 如果没有词缀，生成一个保底护盾 listener
    if (listeners.length === 0) {
      listeners.push({
        eventType: 'DamageTakenEvent',
        scope: 'owner_as_target',
        priority: CREATION_LISTENER_PRIORITIES.damageTaken,
        effects: [
          {
            type: 'shield',
            params: {
              value: {
                base: Math.max(
                  CREATION_PASSIVE_DEFAULTS.minArtifactShieldBase,
                  Math.round(energyBudget.remaining / 1.5),
                ),
              },
            },
          },
        ],
      });
    }

    const slotBias = intent.slotBias;
    const name = slotBias ? `${slotBias}法宝` : '灵器';

    const productModel: ArtifactProductModel = {
      productType: 'artifact',
      outcomeKind: 'artifact',
      slug: buildAbilitySlug(session.id, session.state.input.productType),
      name,
      description: `由${input.materials.map((m) => m.name).join('、')}炼制而成`,
      tags: [
        CreationTags.OUTCOME.PASSIVE_ABILITY,
        CreationTags.OUTCOME.ARTIFACT,
        ...(elementTag ? [elementTag] : []),
        ...intent.dominantTags,
      ],
      affixes: rolledAffixes,
      abilityTags: [...(elementTag ? [elementTag] : []), 'Artifact'],
      slot: slotBias,
      equipPolicy: 'single_slot',
      persistencePolicy: 'inventory_bound',
      progressionPolicy: 'reforgeable',
      artifactConfig: {
        slot: slotBias,
        equipPolicy: 'single_slot',
        persistencePolicy: 'inventory_bound',
        progressionPolicy: 'reforgeable',
      },
      battleProjection: {
        projectionKind: 'artifact_passive',
        abilityTags: [...(elementTag ? [elementTag] : []), 'Artifact'],
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
