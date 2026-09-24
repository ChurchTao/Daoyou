import { describe, expect, it } from 'vitest';
import { advanceGuide, createGuideState, currentGuideStep } from './interpreter';
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
