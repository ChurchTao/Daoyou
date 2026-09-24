import type { GuideLesson, GuideStep } from './schema';

export interface GuideState {
  cursor: number;
  finished: boolean;
}

export function createGuideState(): GuideState {
  return { cursor: 0, finished: false };
}

export function currentGuideStep(
  lesson: GuideLesson,
  state: GuideState,
): GuideStep | null {
  if (state.finished) return null;
  return lesson.steps[state.cursor] ?? null;
}

export function advanceGuide(lesson: GuideLesson, state: GuideState): GuideState {
  if (state.finished) return state;
  const nextCursor = state.cursor + 1;
  const next = lesson.steps[nextCursor];
  if (!next || next.type === 'end') {
    return { cursor: nextCursor, finished: true };
  }
  return { cursor: nextCursor, finished: false };
}
