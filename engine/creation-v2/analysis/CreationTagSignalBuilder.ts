import { CREATION_AFFIX_POOL_SCORING } from '../config/CreationBalance';
import type {
  CreationIntent,
  CreationTagSignal,
  MaterialFingerprint,
  RecipeMatch,
} from '../types';

interface BuildCreationTagSignalsInput {
  materialFingerprints: MaterialFingerprint[];
  intent?: CreationIntent;
  recipeMatch?: RecipeMatch;
}

const SIGNAL_WEIGHTS = CREATION_AFFIX_POOL_SCORING.tagSignalWeights;

export function buildCreationTagSignals({
  materialFingerprints,
  intent,
  recipeMatch,
}: BuildCreationTagSignalsInput): CreationTagSignal[] {
  const signals: CreationTagSignal[] = [];

  const pushSignals = (
    tags: string[],
    source: CreationTagSignal['source'],
    weight: number,
  ) => {
    for (const tag of new Set(tags)) {
      signals.push({ tag, source, weight });
    }
  };

  for (const fingerprint of materialFingerprints) {
    pushSignals(
      fingerprint.explicitTags,
      'material_explicit',
      SIGNAL_WEIGHTS.explicitMaterial,
    );
    pushSignals(
      fingerprint.semanticTags,
      'material_semantic',
      SIGNAL_WEIGHTS.semanticMaterial,
    );
    pushSignals(
      fingerprint.recipeTags,
      'material_recipe',
      SIGNAL_WEIGHTS.recipeMaterial,
    );
  }

  if (intent) {
    pushSignals(
      intent.dominantTags,
      'intent_dominant',
      SIGNAL_WEIGHTS.dominantIntent,
    );
    pushSignals(
      intent.requestedTags,
      'intent_requested',
      SIGNAL_WEIGHTS.requestedIntent,
    );
  }

  if (recipeMatch) {
    pushSignals(
      recipeMatch.matchedTags,
      'recipe_matched',
      SIGNAL_WEIGHTS.matchedRecipe,
    );
  }

  return signals;
}

export function buildCreationTagSignalScoreMap(
  signals: CreationTagSignal[],
): Record<string, number> {
  const scores = new Map<string, number>();
  const maxSignalScore = CREATION_AFFIX_POOL_SCORING.maxSignalScorePerTag;

  for (const signal of signals) {
    scores.set(
      signal.tag,
      Math.min(maxSignalScore, (scores.get(signal.tag) ?? 0) + signal.weight),
    );
  }

  return Object.fromEntries(scores.entries());
}