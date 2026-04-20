import type { CreationTagSignal } from '../types';
import type { AffixTagMatchGroup, AffixTagMatcher } from './types';

export interface AffixMatcherEvaluation {
  matched: boolean;
  matchedTags: string[];
  positiveTags: string[];
  satisfiedUnits: number;
  totalUnits: number;
  blockedTags: string[];
}

export function buildNeutralCreationTagSignals(
  tags: string[],
): CreationTagSignal[] {
  return Array.from(new Set(tags)).map((tag) => ({
    tag,
    source: 'material_semantic' as const,
    weight: 1,
  }));
}

export function evaluateAffixMatcher(
  matcher: AffixTagMatcher,
  signals: CreationTagSignal[],
): AffixMatcherEvaluation {
  const evaluations: AffixMatcherEvaluation[] = [];
  evaluations.push(evaluateMatchGroup(matcher, new Set(signals.map((signal) => signal.tag))));

  for (const [source, group] of Object.entries(matcher.sources ?? {})) {
    const scopedSignals = signals.filter((signal) => signal.source === source);
    evaluations.push(evaluateMatchGroup(group, new Set(scopedSignals.map((signal) => signal.tag))));
  }

  return evaluations.reduce<AffixMatcherEvaluation>(
    (summary, evaluation) => ({
      matched: summary.matched && evaluation.matched,
      matchedTags: dedupe([...summary.matchedTags, ...evaluation.matchedTags]),
      positiveTags: dedupe([...summary.positiveTags, ...evaluation.positiveTags]),
      satisfiedUnits: summary.satisfiedUnits + evaluation.satisfiedUnits,
      totalUnits: summary.totalUnits + evaluation.totalUnits,
      blockedTags: dedupe([...summary.blockedTags, ...evaluation.blockedTags]),
    }),
    {
      matched: true,
      matchedTags: [],
      positiveTags: [],
      satisfiedUnits: 0,
      totalUnits: 0,
      blockedTags: [],
    },
  );
}

function evaluateMatchGroup(
  group: AffixTagMatchGroup | undefined,
  tagSet: Set<string>,
): AffixMatcherEvaluation {
  const requiredAll = group?.all ?? [];
  const requiredAny = group?.any ?? [];
  const forbidden = group?.none ?? [];

  const matchedAll = requiredAll.filter((tag) => tagSet.has(tag));
  const matchedAny = requiredAny.filter((tag) => tagSet.has(tag));
  const blockedTags = forbidden.filter((tag) => tagSet.has(tag));

  return {
    matched:
      matchedAll.length === requiredAll.length &&
      (requiredAny.length === 0 || matchedAny.length > 0) &&
      blockedTags.length === 0,
    matchedTags: dedupe([
      ...matchedAll,
      ...(matchedAny.length > 0 ? [matchedAny[0]] : []),
    ]),
    positiveTags: dedupe([...requiredAll, ...requiredAny]),
    satisfiedUnits:
      matchedAll.length + (requiredAny.length > 0 && matchedAny.length > 0 ? 1 : 0),
    totalUnits: requiredAll.length + (requiredAny.length > 0 ? 1 : 0),
    blockedTags,
  };
}

function dedupe(tags: string[]): string[] {
  return Array.from(new Set(tags));
}