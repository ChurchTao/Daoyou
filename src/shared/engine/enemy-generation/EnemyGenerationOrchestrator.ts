import { ENEMY_RACE_VALUES, REALM_STAGE_CAPS } from '@shared/types/constants';
import type { Attributes } from '@shared/types/cultivator';
import { EnemyBodyCultivationPlanner } from './EnemyBodyCultivationPlanner';
import { EnemyCraftExecutor } from './EnemyCraftExecutor';
import { EnemyCultivatorAssembler } from './EnemyCultivatorAssembler';
import { EnemyLoadoutPlanner } from './EnemyLoadoutPlanner';
import { ENEMY_RACE_PROFILES } from './EnemyRaceProfileRegistry';
import {
  ATTRIBUTE_KEYS,
  type EnemyGenerationDraft,
  type EnemyGenerationInput,
  type EnemyLoadoutPlan,
  type NormalizedEnemyGenerationInput,
} from './types';
import type { EnemyCopyProvider } from './EnemyCopyProvider';
import {
  buildBackgroundFallback,
  buildDescriptionFallback,
  buildDifficultyFactor,
  buildRaceFallbackName,
  buildTitleFallback,
  normalizeOptionalText,
} from './utils';

function uniqueStrings(values: readonly string[]): string[] {
  return Array.from(new Set(values));
}

export class EnemyGenerationOrchestrator {
  constructor(
    private readonly loadoutPlanner = new EnemyLoadoutPlanner(),
    private readonly craftExecutor = new EnemyCraftExecutor(),
    private readonly cultivatorAssembler = new EnemyCultivatorAssembler(),
    private readonly copyProvider: EnemyCopyProvider,
    private readonly bodyCultivationPlanner = new EnemyBodyCultivationPlanner(),
  ) {}

  buildDraft(input: EnemyGenerationInput): EnemyGenerationDraft {
    const normalized = this.normalizeInput(input);
    const profile = ENEMY_RACE_PROFILES[normalized.race];
    const plan = this.loadoutPlanner.plan(normalized);
    const stats = this.buildStatBudget(normalized, profile.attributeWeights);
    const bodyCultivation = this.bodyCultivationPlanner.plan({
      input: normalized,
      variantKey: plan.variantKey,
    });
    const craftedLoadout = this.craftExecutor.execute({
      input: normalized,
      plan,
    });

    const missingNarrative = {
      name: !normalized.name,
      title: !normalized.title,
      background: !normalized.background,
      description: !normalized.description,
    };

    const fallbackName =
      normalized.name ??
      buildRaceFallbackName(
        normalized.race,
        normalized.realm,
        normalized.realmStage,
        craftedLoadout.primaryElement,
      );
    const fallbackBackground =
      normalized.background ??
      buildBackgroundFallback(
        normalized.race,
        normalized.realm,
        normalized.realmStage,
        craftedLoadout.primaryElement,
        profile.narrativeTags,
      );
    const fallbackDescription =
      normalized.description ??
      buildDescriptionFallback(
        normalized.race,
        normalized.realm,
        normalized.realmStage,
        craftedLoadout.primaryElement,
      );
    const fallbackTitle =
      normalized.title ??
      buildTitleFallback(
        normalized.race,
        normalized.realm,
        normalized.realmStage,
        craftedLoadout.primaryElement,
      );

    const cultivator = this.cultivatorAssembler.assemble({
      variantKey: plan.variantKey,
      input: normalized,
      profile,
      primaryElement: craftedLoadout.primaryElement,
      attributes: stats.attributes,
      name: fallbackName,
      title: fallbackTitle,
      background: fallbackBackground,
      description: fallbackDescription,
      loadout: craftedLoadout,
      bodyCultivation: bodyCultivation.state,
    });

    return {
      input: normalized,
      missingNarrative,
      balance: {
        baseCap: stats.baseCap,
        difficultyFactor: stats.difficultyFactor,
        totalAttributeBudget: stats.totalAttributeBudget,
        band: craftedLoadout.difficultyProfile.band,
        variantKey: plan.variantKey,
        primaryElement: craftedLoadout.primaryElement,
        secondaryElement: craftedLoadout.secondaryElement,
        primaryPersonaId: plan.primaryPersona.id,
        ...(plan.accentPersona
          ? { accentPersonaId: plan.accentPersona.id }
          : {}),
        recoveryTierUsed: craftedLoadout.recoveryTierUsed,
        bodyCultivation: bodyCultivation.summary,
      },
      copyFacts: {
        race: normalized.race,
        realm: normalized.realm,
        realmStage: normalized.realmStage,
        difficulty: normalized.difficulty,
        difficultyFactor: stats.difficultyFactor,
        bodyCultivation: bodyCultivation.summary,
        primaryElement: craftedLoadout.primaryElement,
        secondaryElement: craftedLoadout.secondaryElement,
        profileTags: profile.narrativeTags,
        personaTags: this.buildPersonaTags(plan),
        character: {
          fallbackName,
          fallbackTitle,
          fallbackBackground,
          fallbackDescription,
        },
        products: [
          craftedLoadout.technique.facts,
          ...craftedLoadout.skills.map((entry) => entry.facts),
          ...craftedLoadout.artifacts.map((entry) => entry.facts),
        ],
      },
      cultivator,
    };
  }

  async enrichNarrative(
    draft: EnemyGenerationDraft,
  ): Promise<EnemyGenerationDraft> {
    const payload = await this.copyProvider.enrich(draft);
    if (!payload || !this.matchesExpectedProductIds(draft, payload.products)) {
      return draft;
    }

    const productCopyById = new Map(
      payload.products.map((product) => [product.id, product] as const),
    );

    return {
      ...draft,
      missingNarrative: {
        name: false,
        title: false,
        background: false,
        description: false,
      },
      cultivator: {
        ...draft.cultivator,
        name: draft.missingNarrative.name
          ? payload.character.name
          : draft.cultivator.name,
        title: draft.missingNarrative.title
          ? payload.character.title
          : draft.cultivator.title,
        background: draft.missingNarrative.background
          ? payload.character.background
          : draft.cultivator.background,
        description: draft.missingNarrative.description
          ? payload.character.description
          : draft.cultivator.description,
        cultivations: draft.cultivator.cultivations.map((technique) => {
          const copy = technique.id ? productCopyById.get(technique.id) : undefined;
          if (!copy) return technique;
          return {
            ...technique,
            name: copy.name,
            description: copy.description,
            ...(technique.abilityConfig
              ? {
                  abilityConfig: {
                    ...technique.abilityConfig,
                    name: copy.name,
                  },
                }
              : {}),
          };
        }),
        skills: draft.cultivator.skills.map((skill) => {
          const copy = skill.id ? productCopyById.get(skill.id) : undefined;
          if (!copy) return skill;
          return {
            ...skill,
            name: copy.name,
            description: copy.description,
            ...(skill.abilityConfig
              ? {
                  abilityConfig: {
                    ...skill.abilityConfig,
                    name: copy.name,
                  },
                }
              : {}),
          };
        }),
        inventory: {
          ...draft.cultivator.inventory,
          artifacts: draft.cultivator.inventory.artifacts.map((artifact) => {
            const copy = artifact.id ? productCopyById.get(artifact.id) : undefined;
            if (!copy) return artifact;
            return {
              ...artifact,
              name: copy.name,
              description: copy.description,
              ...(artifact.abilityConfig
                ? {
                    abilityConfig: {
                      ...artifact.abilityConfig,
                      name: copy.name,
                    },
                  }
                : {}),
            };
          }),
        },
      },
    };
  }

  private normalizeInput(
    input: EnemyGenerationInput,
  ): NormalizedEnemyGenerationInput {
    if (!input.realm) {
      throw new Error('EnemyGenerator requires realm');
    }
    if (!input.realmStage) {
      throw new Error('EnemyGenerator requires realmStage');
    }
    if (!ENEMY_RACE_VALUES.includes(input.race)) {
      throw new Error(`EnemyGenerator requires supported race, received: ${input.race}`);
    }

    return {
      realm: input.realm,
      realmStage: input.realmStage,
      race: input.race,
      difficulty: Math.max(0, Math.min(100, Math.round(input.difficulty ?? 50))),
      variantSeed: normalizeOptionalText(input.variantSeed),
      name: normalizeOptionalText(input.name),
      title: normalizeOptionalText(input.title),
      background: normalizeOptionalText(input.background),
      description: normalizeOptionalText(input.description),
      isBoss: Boolean(input.isBoss),
    };
  }

  private buildStatBudget(
    input: NormalizedEnemyGenerationInput,
    attributeWeights: Record<(typeof ATTRIBUTE_KEYS)[number], number>,
  ): {
    attributes: Attributes;
    baseCap: number;
    difficultyFactor: number;
    totalAttributeBudget: number;
  } {
    const baseCap = REALM_STAGE_CAPS[input.realm][input.realmStage];
    const difficultyFactor = buildDifficultyFactor(input.difficulty);
    const totalAttributeBudget = Math.round(
      baseCap * difficultyFactor * ATTRIBUTE_KEYS.length,
    );
    const totalWeight = ATTRIBUTE_KEYS.reduce(
      (sum, key) => sum + attributeWeights[key],
      0,
    );

    const raw = ATTRIBUTE_KEYS.map((key) => ({
      key,
      value: (totalAttributeBudget * attributeWeights[key]) / totalWeight,
    }));
    const base = raw.map((entry) => ({
      key: entry.key,
      value: Math.floor(entry.value),
      fraction: entry.value - Math.floor(entry.value),
    }));
    let remaining =
      totalAttributeBudget -
      base.reduce((sum, entry) => sum + entry.value, 0);

    base
      .sort((left, right) => right.fraction - left.fraction)
      .forEach((entry) => {
        if (remaining <= 0) return;
        entry.value += 1;
        remaining -= 1;
      });

    const valueMap = new Map(base.map((entry) => [entry.key, entry.value]));
    const attributes: Attributes = {
      vitality: valueMap.get('vitality') ?? 0,
      spirit: valueMap.get('spirit') ?? 0,
      wisdom: valueMap.get('wisdom') ?? 0,
      speed: valueMap.get('speed') ?? 0,
      willpower: valueMap.get('willpower') ?? 0,
    };

    return {
      attributes,
      baseCap,
      difficultyFactor,
      totalAttributeBudget,
    };
  }

  private buildPersonaTags(plan: EnemyLoadoutPlan): string[] {
    return uniqueStrings([
      ...plan.primaryPersona.narrativeTags,
      ...(plan.accentPersona?.narrativeTags ?? []),
    ]);
  }

  private matchesExpectedProductIds(
    draft: EnemyGenerationDraft,
    products: Array<{ id: string }>,
  ): boolean {
    const expectedIds = draft.copyFacts.products.map((product) => product.id);
    if (products.length !== expectedIds.length) {
      return false;
    }

    const expected = new Set(expectedIds);
    const seen = new Set<string>();
    for (const product of products) {
      if (!expected.has(product.id) || seen.has(product.id)) {
        return false;
      }
      seen.add(product.id);
    }

    return seen.size === expected.size;
  }
}
