import type {
  AbilityConfig,
  AbilityCostConfig,
  AbilityEffectLayerConfig,
  AbilityEffectPlanConfig,
} from '../core/configs';
import {
  resolveAbilityEffectPlan,
  type ResolvedAbilityEffectPlan,
} from '../core/abilityEffectPlan';
import { executeEffectConfigs } from '../core/effectExecutor';
import { advanceAbilityMode } from '../core/runtimeState';
import type { AbilityId } from '../core/types';
import type { Unit } from '../units/Unit';
import { ActiveSkill, type ActiveSkillConfig } from './ActiveSkill';
import type { AbilityContext } from './Ability';

/** 固定目标、费用和 AI 意图，只允许按计划追加效果层的主动技能。 */
export class LayeredDataDrivenActiveSkill extends ActiveSkill {
  private preparedPlan?: ResolvedAbilityEffectPlan;
  private readonly baseCosts: AbilityCostConfig[];
  private readonly baseName: string;
  private readonly baseDescription?: string;
  private readonly baseEffects: NonNullable<AbilityConfig['effects']>;
  private readonly baseCompletionEffects: NonNullable<AbilityConfig['completionEffects']>;
  private readonly baseCastEffects: NonNullable<AbilityConfig['castEffects']>;
  private readonly effectLayers: AbilityEffectLayerConfig[];
  private readonly effectPlans: AbilityEffectPlanConfig[];

  constructor(
    id: AbilityId,
    name: string,
    config: ActiveSkillConfig & {
      effects?: AbilityConfig['effects'];
      completionEffects?: AbilityConfig['completionEffects'];
      castEffects?: AbilityConfig['castEffects'];
      effectLayers?: AbilityEffectLayerConfig[];
      effectPlans?: AbilityEffectPlanConfig[];
    },
  ) {
    super(id, name, config);
    this.baseCosts = config.costs?.map((cost) => ({ ...cost })) ?? [];
    this.baseName = name;
    this.baseDescription = config.description;
    this.baseEffects = config.effects ?? [];
    this.baseCompletionEffects = config.completionEffects ?? [];
    this.baseCastEffects = config.castEffects ?? [];
    this.effectLayers = config.effectLayers ?? [];
    this.effectPlans = config.effectPlans ?? [];
  }

  override get name(): string {
    return this.currentPlan()?.name ?? this.baseName;
  }

  override get description(): string | undefined {
    return this.currentPlan()?.description ?? this.baseDescription;
  }

  override get runtimePlanId(): string | undefined {
    return this.currentPlan()?.id;
  }

  override prepareCast(context: AbilityContext): void {
    this.preparedPlan = this.resolvePlan(context.caster, context.target);
    super.prepareCast(context);
  }

  override cancelPreparedCast(): void {
    this.preparedPlan = undefined;
    super.cancelPreparedCast();
  }

  protected override executeSkill(caster: Unit, target: Unit): void {
    const plan = this.preparedPlan ?? this.resolvePlan(caster, target);
    const context = { caster, target, ability: this, castSnapshot: this.castSnapshot };
    executeEffectConfigs(plan.effects, context);
    executeEffectConfigs(plan.completionEffects, context);
    if (plan.consumeModeKey) advanceAbilityMode(caster, plan.consumeModeKey);
  }

  protected override executeCastEffects(caster: Unit, target: Unit): void {
    executeEffectConfigs(this.baseCastEffects, {
      caster,
      target,
      ability: this,
      castSnapshot: this.castSnapshot,
    });
  }

  protected override onCastFinished(): void {
    this.preparedPlan = undefined;
  }

  override clone(): LayeredDataDrivenActiveSkill {
    const cloned = new LayeredDataDrivenActiveSkill(this.id, this.baseName, {
      description: this.baseDescription,
      costs: this.baseCosts,
      cooldown: this.maxCooldown,
      priority: this.priority,
      targetPolicy: super.targetPolicy,
      selectionProfile: super.selectionProfile,
      castConditions: super.castConditions,
      hitPolicy: super.hitPolicy,
      effects: this.baseEffects,
      completionEffects: this.baseCompletionEffects,
      castEffects: this.baseCastEffects,
      effectLayers: this.effectLayers,
      effectPlans: this.effectPlans,
    });
    cloned.tags.addTags(this.tags.getTags());
    if (this.currentCooldown > 0) cloned.modifyCooldown(this.currentCooldown);
    return cloned;
  }

  private currentPlan(): ResolvedAbilityEffectPlan | undefined {
    if (this.preparedPlan) return this.preparedPlan;
    const owner = this.getOwner();
    return owner ? this.resolvePlan(owner, owner) : undefined;
  }

  private resolvePlan(caster: Unit, target: Unit): ResolvedAbilityEffectPlan {
    return resolveAbilityEffectPlan({
      name: this.baseName,
      description: this.baseDescription,
      effects: this.baseEffects,
      completionEffects: this.baseCompletionEffects,
      effectLayers: this.effectLayers,
      effectPlans: this.effectPlans,
    }, { caster, target, ability: this });
  }
}
