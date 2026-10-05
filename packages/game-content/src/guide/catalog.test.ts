import { describe, expect, it } from 'vitest';
import { getGuideLesson } from './catalog.js';

describe('guide catalog production chains', () => {
  it('keeps the first weapon lesson independent from inventory contents', () => {
    const lesson = getGuideLesson('forge-first-weapon');
    expect(lesson).not.toBeNull();
    expect(
      lesson!.steps
        .filter((step) => step.type !== 'end')
        .map((step) => [step.type, step.anchor]),
    ).toEqual([
      ['look', 'forge.furnace'],
      ['look', 'forge.archive'],
      ['press', 'forge.furnace'],
      ['look', 'forge.fire'],
    ]);
  });

  it('starts alchemy at the sect preparation workspace and leaves firing to the player', () => {
    const lesson = getGuideLesson('alchemy-first-furnace');
    const steps = lesson!.steps.filter((step) => step.type !== 'end');
    expect(steps.map((step) => step.anchor)).toEqual([
      'alchemy.hearth',
      'alchemy.intent',
      'alchemy.fire',
    ]);
    expect(steps.at(-1)).toMatchObject({
      type: 'look',
      anchor: 'alchemy.fire',
    });
  });

  it('registers the complete onboarding chain and closes each lesson by end', () => {
    for (const id of [
      'alchemy-first-furnace',
      'map-qingxi',
      'beast-pouch',
      'cave-layout',
      'cultivator-basics',
      'inventory-basics',
      'forge-first-weapon',
      'weapon-equip',
      'sect-door',
      'sect-first-path',
      'first-attributes',
    ]) {
      const lesson = getGuideLesson(id);
      expect(lesson, id).not.toBeNull();
      expect(lesson!.steps.at(-1)?.type, id).toBe('end');
    }
  });
});
