import { describe, expect, it } from 'vitest';
import {
  advanceGuide,
  createGuideState,
  currentGuideStep,
  restoreGuideState,
} from './interpreter';
import { parseGuideLesson } from './schema';

const lesson = parseGuideLesson({
  id: 'sample',
  title: '试课',
  steps: [
    { type: 'look', anchor: 'room.furnace', text: '先看炉。' },
    { type: 'press', anchor: 'room.furnace', text: '走近炉。' },
    { type: 'end' },
  ],
});

describe('guide interpreter', () => {
  it('walks a look step into a press step and then finishes', () => {
    const start = createGuideState();
    expect(currentGuideStep(lesson, start)?.type).toBe('look');
    const pressing = advanceGuide(lesson, start);
    expect(currentGuideStep(lesson, pressing)).toMatchObject({
      type: 'press',
      anchor: 'room.furnace',
    });
    const done = advanceGuide(lesson, pressing);
    expect(done.finished).toBe(true);
    expect(currentGuideStep(lesson, done)).toBeNull();
  });

  it('restores a valid cursor and recognizes an end cursor', () => {
    expect(restoreGuideState(lesson, 1)).toEqual({
      cursor: 1,
      finished: false,
    });
    expect(restoreGuideState(lesson, 2)).toEqual({
      cursor: 2,
      finished: true,
    });
    expect(restoreGuideState(lesson, -1)).toEqual(createGuideState());
    expect(restoreGuideState(lesson, 999)).toEqual({
      cursor: 2,
      finished: true,
    });
  });

  it('rejects a lesson that does not close', () => {
    expect(() =>
      parseGuideLesson({
        id: 'open',
        title: '没收束',
        steps: [{ type: 'look', anchor: 'room.furnace', text: '看。' }],
      }),
    ).toThrow();
  });
});
