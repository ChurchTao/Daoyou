import { describe, expect, it } from 'vitest';
import { getStoryChapter, openingStoryProgress } from './catalog';
import { acknowledgePerformance, presentStory, resolveStory } from './resolve';
import {
  emptyStoryFacts,
  type StoryChapter,
  type StoryProgress,
} from './schema';

const chapter: StoryChapter = {
  id: 'sample',
  track: 'main',
  title: '试章',
  beats: [
    {
      id: 'watch',
      kind: 'performance',
      script: 'sample-play',
      outcome: 'go',
      scene: 'story',
      prompt: '先看完。',
      href: '/game/story',
    },
    {
      id: 'craft',
      kind: 'practice',
      fact: 'alchemy_crafted',
      scene: 'alchemy',
      prompt: '去开炉。',
      href: '/game/craft/alchemy',
      grant: 'herbs',
    },
    {
      id: 'stay',
      kind: 'life',
      scene: 'cave',
      prompt: '',
      href: '/game',
      when: {
        fact: 'breakthrough_available',
        prompt: '该破境了。',
        href: '/game/tasks',
      },
    },
  ],
};

function progress(beatId: string, extra: Partial<StoryProgress> = {}): StoryProgress {
  return {
    track: 'main',
    storyId: 'sample',
    beatId,
    status: 'active',
    acks: [],
    grants: [],
    marks: [],
    ...extra,
  };
}

describe('story resolver', () => {
  it('loads the arrival chapter and opens on the first performance', () => {
    const arrival = getStoryChapter();
    const opening = openingStoryProgress();
    const view = presentStory(arrival, opening, emptyStoryFacts());
    expect(opening.track).toBe('main');
    expect(view.track).toBe('main');
    expect(view.kind).toBe('performance');
    expect(view.scriptId).toBe('arrival-fall');
    expect(view.href).toBe('/game/story');
  });

  it('advances a performance into a practice and grants once', () => {
    const facts = emptyStoryFacts();
    const first = acknowledgePerformance(
      chapter,
      progress('watch', { marks: ['alchemy_crafted'] }),
      facts,
      'sample-play',
      'go',
    );
    expect(first.progress.beatId).toBe('stay');
    expect(first.grants).toEqual(['herbs']);
    const again = resolveStory(chapter, first.progress, facts);
    expect(again.grants).toEqual([]);
    expect(again.progress.beatId).toBe('stay');
  });

  it('keeps a life beat in place and only changes its prompt', () => {
    const stayed = progress('stay');
    expect(presentStory(chapter, stayed, emptyStoryFacts()).prompt).toBe('');
    expect(
      presentStory(chapter, stayed, {
        ...emptyStoryFacts(),
        breakthrough_available: true,
      }).href,
    ).toBe('/game/tasks');
    expect(resolveStory(chapter, stayed, emptyStoryFacts()).progress.beatId).toBe(
      'stay',
    );
  });

  it('rejects an outcome that does not belong to the current beat', () => {
    expect(() =>
      acknowledgePerformance(
        chapter,
        progress('watch'),
        emptyStoryFacts(),
        'sample-play',
        'other',
      ),
    ).toThrow('演出结果不属于这一幕');
  });
});
