export type BlackMarketBeliefConfidence = 'low' | 'medium' | 'high';

export interface BlackMarketBeliefPatch {
  confidenceDelta: -1 | 0 | 1;
  beliefSummary?: string;
  interpretationUpdates: Array<{
    observationId: string;
    interpretation: string;
  }>;
}

export interface BlackMarketBeliefProjection {
  confidence: BlackMarketBeliefConfidence;
  beliefSummary: string;
  clueInterpretations: Array<{
    observationId: string;
    interpretation: string;
  }>;
}

export function describeBlackMarketClaimMode(
  mode: 'belief' | 'bluff' | 'evasion',
): '主观判断' | '虚张声势' | '无法证实' {
  if (mode === 'bluff') return '虚张声势';
  if (mode === 'belief') return '主观判断';
  return '无法证实';
}

const CONFIDENCE_LEVELS: readonly BlackMarketBeliefConfidence[] = [
  'low',
  'medium',
  'high',
];

function applyConfidenceDelta(
  confidence: BlackMarketBeliefConfidence,
  delta: -1 | 0 | 1,
): BlackMarketBeliefConfidence {
  const current = CONFIDENCE_LEVELS.indexOf(confidence);
  const next = Math.min(
    CONFIDENCE_LEVELS.length - 1,
    Math.max(0, current + delta),
  );
  return CONFIDENCE_LEVELS[next];
}

export function applyBlackMarketBeliefPatch(input: {
  belief: BlackMarketBeliefProjection;
  patch: BlackMarketBeliefPatch;
  relevantObservationIds: ReadonlySet<string>;
  negativeChangeAllowed: boolean;
  summaryChangeAllowed: boolean;
}): { belief: BlackMarketBeliefProjection; changed: boolean } {
  const confidenceDelta =
    input.patch.confidenceDelta < 0 && !input.negativeChangeAllowed
      ? 0
      : input.patch.confidenceDelta;
  const confidence = applyConfidenceDelta(
    input.belief.confidence,
    confidenceDelta,
  );

  const seen = new Set<string>();
  const updates = input.patch.interpretationUpdates
    .filter((item) => {
      if (
        !input.relevantObservationIds.has(item.observationId) ||
        seen.has(item.observationId)
      ) {
        return false;
      }
      seen.add(item.observationId);
      return item.interpretation.trim().length > 0;
    })
    .slice(0, 2)
    .map((item) => ({
      observationId: item.observationId,
      interpretation: item.interpretation.trim().slice(0, 120),
    }));

  const updateById = new Map(
    updates.map((item) => [item.observationId, item.interpretation]),
  );
  const clueInterpretations = input.belief.clueInterpretations.map((item) =>
    updateById.has(item.observationId)
      ? { ...item, interpretation: updateById.get(item.observationId)! }
      : item,
  );
  const existingIds = new Set(
    input.belief.clueInterpretations.map((item) => item.observationId),
  );
  for (const update of updates) {
    if (!existingIds.has(update.observationId)) {
      clueInterpretations.push(update);
    }
  }

  const hasStructuralChange =
    confidence !== input.belief.confidence || updates.length > 0;
  const summary = input.patch.beliefSummary?.trim().slice(0, 180);
  const beliefSummary =
    summary && (hasStructuralChange || input.summaryChangeAllowed)
      ? summary
      : input.belief.beliefSummary;
  const changed =
    hasStructuralChange || beliefSummary !== input.belief.beliefSummary;

  return {
    belief: { confidence, beliefSummary, clueInterpretations },
    changed,
  };
}
