import type {
  AbilityConfig,
  AbilitySelectionProfile,
  EffectConfig,
} from '@shared/engine/battle-v5/core/configs';
import { AbilityType } from '@shared/engine/battle-v5/core/types';
import { analyzeAbilityCapabilities } from '@shared/engine/battle-v5/factories/AbilityCapabilityAnalyzer';
import { GameplayTags } from '@shared/engine/shared/tag-domain';
import type {
  SectAbilityDefinition,
  SectAbilityRole,
  SectCompiledAbility,
  SectId,
  SectPathId,
} from '../domain';

const ROLE_TAGS: Record<SectAbilityRole, string> = {
  generator: GameplayTags.ABILITY.SECT.GENERATOR,
  combo: GameplayTags.ABILITY.SECT.COMBO,
  defensive: GameplayTags.ABILITY.SECT.DEFENSIVE,
  finisher: GameplayTags.ABILITY.SECT.FINISHER,
  utility: GameplayTags.ABILITY.SECT.UTILITY,
};

export interface ActiveSectAbilitySpec {
  definition: Extract<SectAbilityDefinition, { kind: 'default' | 'active' }>;
  name?: string;
  role?: SectAbilityRole;
  mpCost?: number;
  costs?: AbilityConfig['costs'];
  variants?: AbilityConfig['variants'];
  cooldown?: number;
  effects: EffectConfig[];
  castEffects?: EffectConfig[];
  pathId?: SectPathId;
  castConditions?: AbilityConfig['castConditions'];
  targetPolicy: NonNullable<AbilityConfig['targetPolicy']>;
  selectionProfile?: AbilitySelectionProfile;
  extraTags?: string[];
  detailRows?: string[];
  notes?: string[];
  summary?: string;
}

/** 为单个宗门统一构造 slug、GameplayTag、法力和展示信息。 */
export class SectAbilityFactory {
  constructor(private readonly sectId: SectId) {}

  active(spec: ActiveSectAbilitySpec): SectCompiledAbility {
    const role = spec.role ?? spec.definition.role;
    const targetPolicy = spec.targetPolicy;
    const capabilities = analyzeAbilityCapabilities({
      effects: spec.effects,
      castEffects: spec.castEffects,
      variants: spec.variants,
      slug: spec.definition.id,
    });
    const selectionProfile =
      spec.selectionProfile ?? capabilities.selectionProfile;
    if (!selectionProfile) {
      throw new Error(
        `宗门能力 ${spec.definition.id} 无法从效果推导 AI 意图，必须显式声明 selectionProfile`,
      );
    }
    const config: AbilityConfig = {
      slug: `sect.${this.sectId}.${spec.definition.id}`,
      name: spec.name ?? spec.definition.baseName,
      type: AbilityType.ACTIVE_SKILL,
      mpCost: spec.mpCost ?? spec.definition.mpCost,
      costs: spec.costs ?? spec.definition.costs,
      cooldown: spec.cooldown ?? spec.definition.cooldown,
      tags: [
        ...(capabilities.hasDamage
          ? [GameplayTags.ABILITY.FUNCTION.DAMAGE]
          : []),
        ...(capabilities.hasHeal ? [GameplayTags.ABILITY.FUNCTION.HEAL] : []),
        ...(capabilities.hasControl
          ? [GameplayTags.ABILITY.FUNCTION.CONTROL]
          : []),
        ...(capabilities.hasBuff ? [GameplayTags.ABILITY.FUNCTION.BUFF] : []),
        ...(capabilities.damageChannels.has('physical')
          ? [GameplayTags.ABILITY.CHANNEL.PHYSICAL]
          : []),
        ...(capabilities.damageChannels.has('magic')
          ? [GameplayTags.ABILITY.CHANNEL.MAGIC]
          : []),
        ...(capabilities.damageChannels.has('true')
          ? [GameplayTags.ABILITY.CHANNEL.TRUE]
          : []),
        GameplayTags.ABILITY.KIND.SECT,
        GameplayTags.ABILITY.SECT.namespace(this.sectId),
        ...(spec.pathId
          ? [GameplayTags.ABILITY.SECT.path(this.sectId, spec.pathId)]
          : []),
        GameplayTags.ABILITY.SECT.ability(this.sectId, spec.definition.id),
        ROLE_TAGS[role],
        ...(spec.extraTags ?? []),
        targetPolicy.scope === 'single'
          ? GameplayTags.ABILITY.TARGET.SINGLE
          : GameplayTags.ABILITY.TARGET.AOE,
      ],
      targetPolicy,
      selectionProfile,
      castConditions: spec.castConditions,
      variants: spec.variants,
      effects: spec.effects,
      castEffects: spec.castEffects,
    };
    return {
      config,
      detailRows: spec.detailRows ?? [],
      notes: spec.notes ?? [],
      summary: spec.summary,
    };
  }

  passive(args: {
    definition: Extract<SectAbilityDefinition, { kind: 'passive' }>;
    name?: string;
    pathId?: SectPathId;
    listeners?: NonNullable<AbilityConfig['listeners']>;
    modifiers?: AbilityConfig['modifiers'];
    extraTags?: string[];
    detailRows?: string[];
    notes?: string[];
  }): SectCompiledAbility {
    const capabilities = analyzeAbilityCapabilities({
      listeners: args.listeners ?? [],
      slug: args.definition.id,
    });
    const config: AbilityConfig = {
      slug: `sect.${this.sectId}.${args.definition.id}`,
      name: args.name ?? args.definition.baseName,
      type: AbilityType.PASSIVE_SKILL,
      tags: [
        ...(capabilities.hasDamage
          ? [GameplayTags.ABILITY.FUNCTION.DAMAGE]
          : []),
        ...(capabilities.hasHeal ? [GameplayTags.ABILITY.FUNCTION.HEAL] : []),
        ...(capabilities.hasControl
          ? [GameplayTags.ABILITY.FUNCTION.CONTROL]
          : []),
        ...(capabilities.hasBuff ? [GameplayTags.ABILITY.FUNCTION.BUFF] : []),
        ...(capabilities.damageChannels.has('physical')
          ? [GameplayTags.ABILITY.CHANNEL.PHYSICAL]
          : []),
        ...(capabilities.damageChannels.has('magic')
          ? [GameplayTags.ABILITY.CHANNEL.MAGIC]
          : []),
        ...(capabilities.damageChannels.has('true')
          ? [GameplayTags.ABILITY.CHANNEL.TRUE]
          : []),
        GameplayTags.ABILITY.KIND.PASSIVE,
        GameplayTags.ABILITY.KIND.SECT,
        GameplayTags.ABILITY.SECT.namespace(this.sectId),
        ...(args.pathId
          ? [GameplayTags.ABILITY.SECT.path(this.sectId, args.pathId)]
          : []),
        GameplayTags.ABILITY.SECT.ability(this.sectId, args.definition.id),
        ROLE_TAGS[args.definition.role],
        ...(args.extraTags ?? []),
      ],
      listeners: args.listeners,
      modifiers: args.modifiers,
    };
    return {
      config,
      detailRows: args.detailRows ?? [],
      notes: args.notes ?? [],
      summary: args.definition.description,
    };
  }
}
