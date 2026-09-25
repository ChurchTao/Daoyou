import type { GuideLesson, GuideStep } from './schema';

export interface GuideState {
  cursor: number;
  finished: boolean;
}

export function createGuideState(): GuideState {
  return { cursor: 0, finished: false };
}

export function restoreGuideState(
  lesson: GuideLesson,
  cursor: number,
): GuideState {
  if (!Number.isInteger(cursor) || cursor < 0) return createGuideState();
  const safeCursor = Math.min(cursor, lesson.steps.length - 1);
  const step = lesson.steps[safeCursor];
  return {
    cursor: safeCursor,
    finished: !step || step.type === 'end',
  };
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
