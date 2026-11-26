import {
  CONTEST_HEAT,
  type ContestHeat,
  type ContestMaterial,
  type ContestQuestion,
  type ContestQuestionDraft,
} from '@daoyou/game-domain/alchemy/contest';
import { brewContestFurnace, scoreContestFurnace } from './contest.js';

const heats = Object.keys(CONTEST_HEAT) as ContestHeat[];

function* recipes(
  materials: ContestMaterial[],
  start = 0,
  remaining = 5,
  selected: (ContestMaterial & { dose: number })[] = [],
): Generator<(ContestMaterial & { dose: number })[]> {
  if (selected.length >= 2 && remaining <= 2) yield selected;
  if (selected.length === 4 || remaining === 0) return;
  for (let index = start; index < materials.length; index++) {
    for (let dose = 1; dose <= Math.min(2, remaining); dose++) {
      yield* recipes(materials, index + 1, remaining - dose, [
        ...selected,
        { ...materials[index], dose },
      ]);
    }
  }
}

function matchingCandidates(
  draft: ContestQuestionDraft,
  materials: ContestMaterial[],
) {
  return Array.from(recipes(materials)).flatMap((selected) =>
    heats.flatMap((heat) => {
      const result = brewContestFurnace(selected, heat);
      const effects = result.lots[0]?.effects;
      if (
        !effects ||
        effects[0]?.key !== draft.primary ||
        !effects[0].value ||
        (draft.secondary &&
          !effects
            .slice(1)
            .some(({ key, value }) => key === draft.secondary && value > 0))
      )
        return [];
      return [{ selected, heat, result, strength: effects[0].value }];
    }),
  );
}

function percentile(values: number[], fraction: number) {
  const ordered = values.toSorted((a, b) => a - b);
  return ordered[Math.floor((ordered.length - 1) * fraction)];
}

export function authorContestQuestion(
  draft: ContestQuestionDraft,
  materials: ContestMaterial[],
): Omit<ContestQuestion, 'pillName'> | null {
  if (
    materials.length !== 16 ||
    draft.primary === draft.secondary ||
    (draft.secondary &&
      [draft.primary, draft.secondary].includes('beast_cultivation'))
  )
    return null;
  const basics = matchingCandidates(draft, materials.slice(0, 8));
  if (basics.length < 8) return null;
  const matches = matchingCandidates(draft, materials);
  const minimumStrength = percentile(
    basics.map(({ strength }) => strength),
    0.25,
  );
  const maximumToxicity = percentile(
    basics.map(({ result }) => result.toxicity),
    0.8,
  );
  const eligible = matches.filter(
    ({ strength, result }) =>
      strength >= minimumStrength && result.toxicity <= maximumToxicity,
  );
  if (eligible.length < 24) return null;
  const baseQuestion = {
    ...draft,
    minimumStrength,
    maximumToxicity,
    strengthForFullScore: percentile(
      eligible.map(({ strength }) => strength),
      0.95,
    ),
    quantityForFullScore: 1,
  };
  const question = {
    ...baseQuestion,
    quantityForFullScore: percentile(
      eligible.map(({ result, heat }) =>
        scoreContestFurnace(
          result,
          baseQuestion,
          heat,
          0,
          0,
        ).qualifiedLots.reduce((sum, lot) => sum + lot.quantity, 0),
      ),
      0.9,
    ),
  };
  const key = (candidate: (typeof eligible)[number]) =>
    candidate.selected.map(({ id }) => id).join('/');
  const scored = eligible
    .map((candidate) => {
      const floor = scoreContestFurnace(
        candidate.result,
        question,
        candidate.heat,
        0,
        -1,
      );
      const ceiling = scoreContestFurnace(
        candidate.result,
        question,
        candidate.heat,
        0,
        1,
      );
      return {
        ...candidate,
        floor,
        ceiling,
        doses: candidate.selected.reduce((sum, item) => sum + item.dose, 0),
      };
    })
    .sort((a, b) => b.floor.score - a.floor.score);
  const best = scored[0];
  const alternative = scored.find(
    (candidate) =>
      candidate.floor.score >= best.floor.score - 12 &&
      key(candidate) !== key(best) &&
      (candidate.doses < best.doses ||
        candidate.result.stability > best.result.stability ||
        candidate.floor.points.quantity > best.floor.points.quantity ||
        candidate.floor.points.quality > best.floor.points.quality ||
        candidate.strength > best.strength),
  );
  if (
    !alternative ||
    best.floor.score - scored.at(-1)!.ceiling.score < 4 ||
    !basics.some(
      (candidate) =>
        candidate.strength >= minimumStrength &&
        candidate.result.toxicity <= maximumToxicity &&
        candidate.selected.length <= 3,
    )
  )
    return null;
  const recoverable = [best, alternative].every((first) =>
    scored.some(
      (next) =>
        key(next) !== key(first) &&
        next.selected.every(
          ({ id, dose }) =>
            dose +
              (first.selected.find((entry) => entry.id === id)?.dose ?? 0) <=
            3,
        ),
    ),
  );
  return recoverable ? question : null;
}
