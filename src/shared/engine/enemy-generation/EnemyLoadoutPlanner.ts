import { ENEMY_RACE_PROFILES } from './EnemyRaceProfileRegistry';
import { getEnemyPersonas } from './EnemyPersonaRegistry';
import {
  getEnemyCombatPolicy,
  validateEnemySkillRoles,
} from './EnemyCombatPolicy';
import type {
  EnemyDifficultyProfile,
  EnemyLoadoutPlan,
  EnemyPersonaArtifactPlan,
  EnemyPersonaDefinition,
  EnemyPersonaSkillPlan,
  EnemyPlannedProductIntent,
  EnemySkillRole,
  NormalizedEnemyGenerationInput,
} from './types';
import {
  buildStableProductId,
  buildStableSlugSeed,
  buildVariantKey,
  difficultyToBand,
  pickBySeed,
  resolveEnemyProductEnergyBudget,
  resolveEnemyProductQualityFloor,
  resolveUnlockScore,
} from './utils';

function uniqueStrings(values: readonly string[]): string[] {
  return Array.from(new Set(values));
}

function resolveSkillCount(input: NormalizedEnemyGenerationInput): number {
  const baseCount =
    input.difficulty >= 95
      ? 4
      : input.difficulty >= 70
        ? 3
        : input.difficulty >= 20
          ? 2
          : 1;
  const bossBonus = input.isBoss && input.difficulty >= 60 ? 1 : 0;
  const ancientBeastBonus =
    input.race === '古兽' && input.difficulty >= 85 ? 1 : 0;

  return Math.min(
    4,
    baseCount + bossBonus + ancientBeastBonus,
  );
}

function resolveArtifactCount(input: NormalizedEnemyGenerationInput): number {
  const baseCount =
    input.difficulty >= 90
      ? 3
      : input.difficulty >= 65
        ? 2
        : input.difficulty >= 30
          ? 1
          : 0;
  const bossBonus = input.isBoss && input.difficulty >= 75 ? 1 : 0;

  return Math.min(
    3,
    baseCount + bossBonus,
  );
}

function resolveDifficultyProfile(
  input: NormalizedEnemyGenerationInput,
): EnemyDifficultyProfile {
  const effectiveDifficulty =
    input.race === '古兽' ? Math.min(100, input.difficulty + 10) : input.difficulty;
  const band = difficultyToBand(effectiveDifficulty);
  return {
    band,
    skillCount: resolveSkillCount(input),
    artifactCount: resolveArtifactCount(input),
    allowHighTier: band === 'advanced' || band === 'legendary',
  };
}

function resolveMaxAffixCount(
  band: EnemyDifficultyProfile['band'],
  input: NormalizedEnemyGenerationInput,
): number {
  if (input.difficulty >= 95 || (input.isBoss && input.difficulty >= 85)) {
    return 5;
  }

  switch (band) {
    case 'core':
      return 1;
    case 'variant':
      return 2;
    case 'advanced':
      return 3;
    case 'legendary':
      return 4;
  }
}

export class EnemyLoadoutPlanner {
  plan(input: NormalizedEnemyGenerationInput): EnemyLoadoutPlan {
    const variantKey = buildVariantKey(input);
    const profile = ENEMY_RACE_PROFILES[input.race];
    const difficultyProfile = resolveDifficultyProfile(input);
    const personas = getEnemyPersonas(input.race);
    const primaryPersona = pickBySeed(
      personas,
      `${variantKey}:primary-persona`,
    );
    const accentPersona = this.resolveAccentPersona(
      personas,
      primaryPersona,
      variantKey,
      input,
    );
    const primaryElement = pickBySeed(
      profile.elementPool,
      `${variantKey}:primary-element`,
    );
    const secondaryPool = profile.elementPool.filter(
      (element) => element !== primaryElement,
    );
    const secondaryElement =
      secondaryPool.length > 0
        ? pickBySeed(secondaryPool, `${variantKey}:secondary-element`)
        : primaryElement;

    const technique = this.buildTechniqueIntent({
      variantKey,
      input,
      difficultyProfile,
      primaryElement,
      secondaryElement,
      primaryPersona,
    });
    const skills = this.buildSkillIntents({
      variantKey,
      input,
      difficultyProfile,
      primaryElement,
      secondaryElement,
      primaryPersona,
      accentPersona,
    });
    const artifacts = this.buildArtifactIntents({
      variantKey,
      input,
      difficultyProfile,
      primaryElement,
      secondaryElement,
      primaryPersona,
      accentPersona,
    });

    return {
      variantKey,
      primaryElement,
      secondaryElement,
      difficultyProfile,
      primaryPersona,
      ...(accentPersona ? { accentPersona } : {}),
      technique,
      skills,
      artifacts,
    };
  }

  private resolveAccentPersona(
    personas: EnemyPersonaDefinition[],
    primaryPersona: EnemyPersonaDefinition,
    variantKey: string,
    input: NormalizedEnemyGenerationInput,
  ): EnemyPersonaDefinition | undefined {
    if (input.difficulty < 60 && !input.isBoss) {
      return undefined;
    }

    const accentPool = personas.filter(
      (persona) => persona.id !== primaryPersona.id,
    );
    if (accentPool.length === 0) {
      return undefined;
    }

    return pickBySeed(accentPool, `${variantKey}:accent-persona`);
  }

  private buildTechniqueIntent(args: {
    variantKey: string;
    input: NormalizedEnemyGenerationInput;
    difficultyProfile: EnemyDifficultyProfile;
    primaryElement: EnemyLoadoutPlan['primaryElement'];
    secondaryElement: EnemyLoadoutPlan['secondaryElement'];
    primaryPersona: EnemyPersonaDefinition;
  }): EnemyPlannedProductIntent {
    const plan = args.primaryPersona.technique;
    return this.buildPlannedIntent({
      variantKey: args.variantKey,
      input: args.input,
      difficultyProfile: args.difficultyProfile,
      primaryElement: args.primaryElement,
      secondaryElement: args.secondaryElement,
      productType: 'gongfa',
      role: plan.role,
      index: 0,
      candidateArchetypeIds: plan.archetypeIds,
      personaTags: uniqueStrings([
        ...args.primaryPersona.narrativeTags,
        ...plan.narrativeTags,
        ...(plan.tagOverlays ?? []),
      ]),
    });
  }

  private buildSkillIntents(args: {
    variantKey: string;
    input: NormalizedEnemyGenerationInput;
    difficultyProfile: EnemyDifficultyProfile;
    primaryElement: EnemyLoadoutPlan['primaryElement'];
    secondaryElement: EnemyLoadoutPlan['secondaryElement'];
    primaryPersona: EnemyPersonaDefinition;
    accentPersona?: EnemyPersonaDefinition;
  }): EnemyPlannedProductIntent[] {
    const policy = getEnemyCombatPolicy(args.input.race);
    const roleOrder =
      policy.roleOrderBySkillCount[
        args.difficultyProfile.skillCount as 1 | 2 | 3 | 4
      ];
    const selectedPlans = roleOrder.map((role) => ({
      plan: this.resolveSkillPlan(args.primaryPersona, role),
      owner: args.primaryPersona,
    }));

    if (args.accentPersona) {
      const accentPlan =
        args.accentPersona.skills.find(
          (plan) => plan.role === args.accentPersona?.accentSkillRole,
        ) ?? args.accentPersona.skills[0];
      if (accentPlan && selectedPlans.length > 0) {
        const replaceIndex = selectedPlans.findIndex(
          ({ plan }) => plan.role === accentPlan.role,
        );
        const targetIndex =
          replaceIndex >= 0 ? replaceIndex : selectedPlans.length - 1;
        const proposedRoles = selectedPlans.map(({ plan }, index) =>
          index === targetIndex ? accentPlan.role : plan.role,
        );

        if (validateEnemySkillRoles(policy, proposedRoles)) {
          selectedPlans[targetIndex] = {
            plan: accentPlan,
            owner: args.accentPersona,
          };
        }
      }
    }

    return selectedPlans.map(({ plan, owner }, index) =>
      this.buildPlannedIntent({
        variantKey: args.variantKey,
        input: args.input,
        difficultyProfile: args.difficultyProfile,
        primaryElement: args.primaryElement,
        secondaryElement: args.secondaryElement,
        productType: 'skill',
        role: plan.role,
        index,
        candidateArchetypeIds: plan.archetypeIds,
        personaTags: uniqueStrings([
          ...args.primaryPersona.narrativeTags,
          ...(args.accentPersona?.id === owner.id
            ? args.accentPersona.narrativeTags
            : []),
          ...plan.narrativeTags,
          ...(plan.tagOverlays ?? []),
        ]),
      }),
    );
  }

  private resolveSkillPlan(
    persona: EnemyPersonaDefinition,
    role: EnemySkillRole,
  ): EnemyPersonaSkillPlan {
    const plan = persona.skills.find((candidate) => candidate.role === role);
    if (!plan) {
      throw new Error(
        `Enemy persona ${persona.id} is missing required skill role: ${role}`,
      );
    }
    return plan;
  }

  private buildArtifactIntents(args: {
    variantKey: string;
    input: NormalizedEnemyGenerationInput;
    difficultyProfile: EnemyDifficultyProfile;
    primaryElement: EnemyLoadoutPlan['primaryElement'];
    secondaryElement: EnemyLoadoutPlan['secondaryElement'];
    primaryPersona: EnemyPersonaDefinition;
    accentPersona?: EnemyPersonaDefinition;
  }): EnemyPlannedProductIntent[] {
    const profile = ENEMY_RACE_PROFILES[args.input.race];
    const selectedSlots = profile.slotPriority.slice(
      0,
      args.difficultyProfile.artifactCount,
    );
    const selectedPlans = selectedSlots
      .map((slot) => args.primaryPersona.artifacts[slot])
      .filter((plan): plan is EnemyPersonaArtifactPlan => Boolean(plan))
      .map((plan) => ({ plan, owner: args.primaryPersona }));

    if (
      args.accentPersona &&
      (args.input.isBoss || args.input.difficulty >= 85) &&
      selectedPlans.length > 0
    ) {
      const accentSlot = selectedSlots.includes(args.accentPersona.accentArtifactSlot)
        ? args.accentPersona.accentArtifactSlot
        : selectedSlots[selectedSlots.length - 1];
      const accentPlan = args.accentPersona.artifacts[accentSlot];
      if (accentPlan) {
        const replaceIndex = selectedPlans.findIndex(
          ({ plan }) => plan.slot === accentSlot,
        );
        selectedPlans[replaceIndex >= 0 ? replaceIndex : selectedPlans.length - 1] = {
          plan: accentPlan,
          owner: args.accentPersona,
        };
      }
    }

    return selectedPlans.map(({ plan, owner }, index) =>
      this.buildPlannedIntent({
        variantKey: args.variantKey,
        input: args.input,
        difficultyProfile: args.difficultyProfile,
        primaryElement: args.primaryElement,
        secondaryElement: args.secondaryElement,
        productType: 'artifact',
        role: plan.role,
        index,
        slot: plan.slot,
        candidateArchetypeIds: plan.archetypeIds,
        personaTags: uniqueStrings([
          ...args.primaryPersona.narrativeTags,
          ...(args.accentPersona?.id === owner.id
            ? args.accentPersona.narrativeTags
            : []),
          ...plan.narrativeTags,
          ...(plan.tagOverlays ?? []),
        ]),
      }),
    );
  }

  private buildPlannedIntent(args: {
    variantKey: string;
    input: NormalizedEnemyGenerationInput;
    difficultyProfile: EnemyDifficultyProfile;
    primaryElement: EnemyLoadoutPlan['primaryElement'];
    secondaryElement: EnemyLoadoutPlan['secondaryElement'];
    productType: EnemyPlannedProductIntent['productType'];
    role: EnemyPlannedProductIntent['role'];
    index: number;
    slot?: EnemyPlannedProductIntent['slot'];
    candidateArchetypeIds: string[];
    personaTags: string[];
  }): EnemyPlannedProductIntent {
    const profile = ENEMY_RACE_PROFILES[args.input.race];
    const stableId = buildStableProductId(
      args.variantKey,
      args.productType,
      args.role,
      args.index,
      args.slot,
    );
    const stableOutputKey = stableId;
    const slugSeed = buildStableSlugSeed(
      args.variantKey,
      args.productType,
      args.role,
      args.index,
    );
    const dominantTags =
      args.productType === 'gongfa'
        ? profile.techniqueTags
        : args.productType === 'skill'
          ? profile.skillTags
          : profile.artifactTags;

    return {
      stableId,
      stableOutputKey,
      slugSeed,
      productType: args.productType,
      role: args.role,
      ...(args.slot ? { slot: args.slot } : {}),
      primaryElement: args.primaryElement,
      secondaryElement: args.secondaryElement,
      dominantTags: uniqueStrings(dominantTags),
      personaTags: uniqueStrings(args.personaTags),
      candidateArchetypeIds: args.candidateArchetypeIds,
      energyBudget: resolveEnemyProductEnergyBudget({
        difficulty: args.input.difficulty,
        race: args.input.race,
        isBoss: args.input.isBoss,
        productType: args.productType,
      }),
      unlockScore: resolveUnlockScore(
        args.input.difficulty,
        0,
        args.input.isBoss,
      ),
      maxAffixCount: resolveMaxAffixCount(
        args.difficultyProfile.band,
        args.input,
      ),
      qualityFloor: resolveEnemyProductQualityFloor({
        difficulty: args.input.difficulty,
        race: args.input.race,
        isBoss: args.input.isBoss,
      }),
    };
  }
}
