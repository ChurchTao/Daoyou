import { describe, expect, it } from 'vitest';
import { getGuideLesson } from './catalog';

describe('guide catalog production chains', () => {
  it('keeps the first weapon lesson on the actual forging path', () => {
    const lesson = getGuideLesson('forge-first-weapon');
    expect(lesson).not.toBeNull();
    expect(
      lesson!.steps
        .filter((step) => step.type !== 'end')
        .map((step) => [step.type, step.anchor]),
    ).toEqual([
      ['look', 'forge.furnace'],
      ['press', 'forge.archive'],
      ['press', 'forge.blueprint'],
      ['press', 'forge.material-slot'],
      ['press', 'forge.qingshi'],
      ['press', 'forge.fire'],
      ['press', 'forge.confirm'],
    ]);
  });

  it('keeps the alchemy lesson observational at the final fire control', () => {
    const lesson = getGuideLesson('alchemy-first-furnace');
    const steps = lesson!.steps.filter((step) => step.type !== 'end');
    expect(steps.at(-1)).toMatchObject({
      type: 'look',
      anchor: 'alchemy.fire',
    });
    expect(
      steps.at(-1)?.type === 'look' ? steps.at(-1)?.text : '',
    ).toContain('先认到这里');
  });

  it('keeps every production lesson closed by end', () => {
    for (const id of [
      'alchemy-first-furnace',
      'map-qingxi',
      'beast-pouch',
      'cave-layout',
      'forge-first-weapon',
      'sect-door',
    ]) {
      const lesson = getGuideLesson(id);
      expect(lesson, id).not.toBeNull();
      expect(lesson!.steps.at(-1)?.type, id).toBe('end');
    }
  });
});
