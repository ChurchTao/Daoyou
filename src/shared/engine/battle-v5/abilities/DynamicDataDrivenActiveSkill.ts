import type {
  AbilityConfig,
  AbilityCostConfig,
  AbilitySelectionProfile,
  AbilityVariantConfig,
  ConditionConfig,
} from '../core/configs';
import { checkConditions } from '../core/conditionEvaluator';
import { executeEffectConfigs } from '../core/effectExecutor';
import type { AbilityId } from '../core/types';
import type { Unit } from '../units/Unit';
import { ActiveSkill, type ActiveSkillConfig } from './ActiveSkill';
import type { AbilityContext } from './Ability';
import { TargetPolicy } from './TargetPolicy';

/** 运行时按单位状态解析完整技能形态，施法前冻结，结算后释放。 */
export class DynamicDataDrivenActiveSkill extends ActiveSkill {
  private preparedVariant?: AbilityVariantConfig;
  private readonly variantPolicies = new Map<string, TargetPolicy>();

  constructor(
    id: AbilityId,
    name: string,
    config: ActiveSkillConfig & {
      effects?: AbilityConfig['effects'];
      castEffects?: AbilityConfig['castEffects'];
      variants: AbilityVariantConfig[];
    },
  ) {
    super(id, name, config);
    this.baseCosts = config.costs?.map((cost) => ({ ...cost })) ?? [];
    this.baseEffects = config.effects ?? [];
    this.baseCastEffects = config.castEffects ?? [];
    this.variants = [...config.variants].sort((a, b) => b.priority - a.priority);
    for (const variant of this.variants) {
      if (variant.targetPolicy) {
        this.variantPolicies.set(variant.id, new TargetPolicy(variant.targetPolicy));
      }
    }
  }

  private readonly baseEffects: NonNullable<AbilityConfig['effects']>;
  private readonly baseCastEffects: NonNullable<AbilityConfig['castEffects']>;
  private readonly baseCosts: AbilityCostConfig[];
  private readonly variants: AbilityVariantConfig[];

  override get name(): string {
    return this.currentVariant()?.name ?? super.name;
  }

  override get runtimeVariantId(): string | undefined {
    return this.currentVariant()?.id;
  }

  override get targetPolicy(): TargetPolicy {
    const variant = this.currentVariant();
    return (variant && this.variantPolicies.get(variant.id)) ?? super.targetPolicy;
  }

  override get selectionProfile(): AbilitySelectionProfile | undefined {
    return this.currentVariant()?.selectionProfile ?? super.selectionProfile;
  }

  override get castConditions(): ConditionConfig[] {
    return this.currentVariant()?.castConditions ?? super.castConditions;
  }

  override prepareCast(context: AbilityContext): void {
    this.preparedVariant = this.resolveVariant(context.caster, context.target);
  }

  override cancelPreparedCast(): void {
    this.preparedVariant = undefined;
  }

  protected override getCostConfigs(caster: Unit): AbilityCostConfig[] {
    const variant = this.preparedVariant ?? this.resolveVariant(caster, caster);
    return variant?.costs ?? super.getCostConfigs(caster);
  }

  protected override executeSkill(caster: Unit, target: Unit): void {
    const variant = this.preparedVariant ?? this.resolveVariant(caster, target);
    executeEffectConfigs(variant?.effects ?? this.baseEffects, {
      caster,
      target,
      ability: this,
    });
  }

  protected override executeCastEffects(caster: Unit, target: Unit): void {
    const variant = this.preparedVariant ?? this.resolveVariant(caster, target);
    executeEffectConfigs(
      variant?.castEffects ?? this.baseCastEffects,
      { caster, target, ability: this },
    );
  }

  protected override onCastFinished(): void {
    this.preparedVariant = undefined;
  }

  override clone(): DynamicDataDrivenActiveSkill {
    const cloned = new DynamicDataDrivenActiveSkill(this.id, super.name, {
      costs: this.baseCosts,
      cooldown: this.maxCooldown,
      priority: this.priority,
      targetPolicy: super.targetPolicy,
      selectionProfile: super.selectionProfile,
      castConditions: super.castConditions,
      effects: this.baseEffects,
      castEffects: this.baseCastEffects,
      variants: this.variants,
    });
    cloned.tags.addTags(this.tags.getTags());
    if (this.currentCooldown > 0) cloned.modifyCooldown(this.currentCooldown);
    return cloned;
  }

  private currentVariant(): AbilityVariantConfig | undefined {
    if (this.preparedVariant) return this.preparedVariant;
    const owner = this.getOwner();
    return owner ? this.resolveVariant(owner, owner) : undefined;
  }

  private resolveVariant(caster: Unit, target: Unit): AbilityVariantConfig | undefined {
    return this.variants.find((variant) =>
      checkConditions(
        { caster, target, ability: this },
        variant.conditions,
      ),
    );
  }
}
