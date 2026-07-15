import type {
  AbilityConfig,
  EffectConfig,
} from '@shared/engine/battle-v5/core/configs';
import { AbilityType } from '@shared/engine/battle-v5/core/types';
import { GameplayTags } from '@shared/engine/shared/tag-domain';
import { REALM_ORDER, type RealmType } from '@shared/types/constants';
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
  utility: GameplayTags.ABILITY.SECT.DEFENSIVE,
};

export class StandardSectManaCostPolicy {
  calculate(realm: RealmType, weight: number): number {
    return Math.round((8 + 4 * REALM_ORDER[realm]) * weight);
  }
}

const defaultManaCostPolicy = new StandardSectManaCostPolicy();

export function calculateSectManaCost(
  realm: RealmType,
  weight: number,
): number {
  return defaultManaCostPolicy.calculate(realm, weight);
}

export interface ActiveSectAbilitySpec {
  definition: SectAbilityDefinition;
  name?: string;
  role?: SectAbilityRole;
  manaWeight?: number;
  mpCost?: number;
  cooldown?: number;
  effects: EffectConfig[];
  castEffects?: EffectConfig[];
  pathId?: SectPathId;
  castConditions?: AbilityConfig['castConditions'];
  targetTeam?: 'enemy' | 'self';
  heal?: boolean;
  extraTags?: string[];
  detailRows: string[];
  notes?: string[];
  summary?: string;
}

/** 为单个宗门统一构造 slug、GameplayTag、法力和展示信息。 */
export class SectAbilityFactory {
  constructor(
    private readonly sectId: SectId,
    private readonly realm: RealmType,
    private readonly manaCostPolicy = defaultManaCostPolicy,
  ) {}

  active(spec: ActiveSectAbilitySpec): SectCompiledAbility {
    const role = spec.role ?? spec.definition.role;
    const effectTree = [...spec.effects, ...(spec.castEffects ?? [])];
    for (let index = 0; index < effectTree.length; index += 1) {
      const effect = effectTree[index];
      if ('effects' in effect.params && Array.isArray(effect.params.effects)) {
        effectTree.push(...effect.params.effects);
      }
      if (effect.type === 'apply_buff') {
        effectTree.push(
          ...(effect.params.buffConfig.listeners?.flatMap(
            (listener) => listener.effects,
          ) ?? []),
        );
      }
    }
    const hasDamage = effectTree.some(
      (effect) => effect.type === 'damage' || effect.type === 'resource_scaled_damage',
    );
    const hasHeal =
      spec.heal || effectTree.some((effect) => effect.type === 'heal');
    const config: AbilityConfig = {
      slug: `sect.${this.sectId}.${spec.definition.id}`,
      name: spec.name ?? spec.definition.baseName,
      type: AbilityType.ACTIVE_SKILL,
      mpCost:
        spec.mpCost ??
        this.manaCostPolicy.calculate(
          this.realm,
          spec.manaWeight ?? spec.definition.manaWeight,
        ),
      cooldown: spec.cooldown ?? spec.definition.cooldown,
      tags: [
        ...(hasDamage
          ? [
              GameplayTags.ABILITY.FUNCTION.DAMAGE,
              GameplayTags.ABILITY.CHANNEL.PHYSICAL,
            ]
          : []),
        ...(hasHeal ? [GameplayTags.ABILITY.FUNCTION.HEAL] : []),
        GameplayTags.ABILITY.KIND.SECT,
        GameplayTags.ABILITY.SECT.namespace(this.sectId),
        ...(spec.pathId
          ? [GameplayTags.ABILITY.SECT.path(this.sectId, spec.pathId)]
          : []),
        GameplayTags.ABILITY.SECT.ability(this.sectId, spec.definition.id),
        ROLE_TAGS[role],
        ...(spec.extraTags ?? []),
        GameplayTags.ABILITY.TARGET.SINGLE,
      ],
      targetPolicy: { team: spec.targetTeam ?? 'enemy', scope: 'single' },
      selectionProfile: {
        intents:
          role === 'utility'
            ? ['heal_hp', 'defensive']
            : role === 'defensive'
              ? ['defensive']
              : ['damage'],
      },
      castConditions: spec.castConditions,
      effects: spec.effects,
      castEffects: spec.castEffects,
    };
    return {
      config,
      detailRows: spec.detailRows,
      notes: spec.notes ?? [],
      summary: spec.summary,
    };
  }

  passive(args: {
    id: string;
    name: string;
    pathId: SectPathId;
    listeners: NonNullable<AbilityConfig['listeners']>;
  }): AbilityConfig {
    const effectQueue = args.listeners.flatMap((listener) => listener.effects);
    for (let index = 0; index < effectQueue.length; index += 1) {
      const effect = effectQueue[index];
      if ('effects' in effect.params && Array.isArray(effect.params.effects)) {
        effectQueue.push(...effect.params.effects);
      }
    }
    const hasDamage = effectQueue.some(
      (effect) =>
        effect.type === 'damage' ||
        effect.type === 'resource_scaled_damage' ||
        (effect.type === 'damage_memory' &&
          effect.params.mode === 'release' &&
          effect.params.releaseAs !== 'heal' &&
          effect.params.releaseAs !== 'shield'),
    );
    return {
      slug: `sect.${this.sectId}.${args.id}`,
      name: args.name,
      type: AbilityType.PASSIVE_SKILL,
      tags: [
        ...(hasDamage
          ? [
              GameplayTags.ABILITY.FUNCTION.DAMAGE,
              GameplayTags.ABILITY.CHANNEL.PHYSICAL,
            ]
          : []),
        GameplayTags.ABILITY.KIND.PASSIVE,
        GameplayTags.ABILITY.KIND.SECT,
        GameplayTags.ABILITY.SECT.namespace(this.sectId),
        GameplayTags.ABILITY.SECT.path(this.sectId, args.pathId),
      ],
      listeners: args.listeners,
    };
  }
}
