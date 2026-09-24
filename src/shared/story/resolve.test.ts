import { describe, expect, it } from 'vitest';
import { getStoryChapter, openingStoryProgress } from './catalog';
import {
  acknowledgeGuide,
  acknowledgePerformance,
  noteStoryFact,
  presentStory,
  resolveStory,
  rewindToUnwatchedPerformance,
} from './resolve';
import {
  emptyStoryFacts,
  StoryChapterSchema,
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
      accept: [{ type: 'fact', fact: 'alchemy_crafted' }],
      scene: 'alchemy',
      prompt: '去开炉。',
      href: '/game/craft/alchemy',
      grant: 'herbs',
      reward: 'thanks',
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
    expect(view.guideLesson).toBeNull();
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
    expect(first.grants).toEqual(['herbs', 'thanks']);
    const again = resolveStory(chapter, first.progress, facts);
    expect(again.grants).toEqual([]);
    expect(again.progress.beatId).toBe('stay');
  });

  it('gives the opening bundle when the practice starts, and the reward when it is done', () => {
    const facts = emptyStoryFacts();
    const opened = acknowledgePerformance(
      chapter,
      progress('watch'),
      facts,
      'sample-play',
      'go',
    );
    expect(opened.progress.beatId).toBe('craft');
    expect(opened.grants).toEqual(['herbs']);
    expect(presentStory(chapter, opened.progress, facts).guideLesson).toBeNull();
    const finished = noteStoryFact(
      chapter,
      opened.progress,
      facts,
      'alchemy_crafted',
    );
    expect(finished.progress.beatId).toBe('stay');
    expect(finished.grants).toEqual(['thanks']);
    expect(finished.progress.marks).toEqual(['alchemy_crafted']);
  });

  it('accepts either a watched lesson or the world fact, and can require both', () => {
    const guided: StoryChapter = {
      ...chapter,
      beats: [
        chapter.beats[0]!,
        {
          id: 'craft',
          kind: 'practice',
          accept: [
            { type: 'guide', lesson: 'alchemy-first-furnace' },
            { type: 'fact', fact: 'alchemy_crafted' },
          ],
          scene: 'alchemy',
          prompt: '去开炉。',
          href: '/game/craft/alchemy?guide=alchemy-first-furnace',
        },
        chapter.beats[2]!,
      ],
    };
    const opened = acknowledgePerformance(
      guided,
      progress('watch'),
      emptyStoryFacts(),
      'sample-play',
      'go',
    );
    expect(presentStory(guided, opened.progress, emptyStoryFacts()).guideLesson).toBe(
      'alchemy-first-furnace',
    );
    const watched = acknowledgeGuide(
      guided,
      opened.progress,
      emptyStoryFacts(),
      'alchemy-first-furnace',
    );
    expect(watched.progress.beatId).toBe('stay');
    expect(watched.progress.marks).toEqual(['guide:alchemy-first-furnace']);

    const both: StoryChapter = {
      ...guided,
      beats: [
        guided.beats[0]!,
        { ...guided.beats[1]!, mode: 'all' as const },
        guided.beats[2]!,
      ],
    };
    const waiting = acknowledgeGuide(
      both,
      opened.progress,
      emptyStoryFacts(),
      'alchemy-first-furnace',
    );
    expect(waiting.progress.beatId).toBe('craft');
    expect(presentStory(both, waiting.progress, emptyStoryFacts()).guideLesson).toBeNull();
    const crafted = noteStoryFact(
      both,
      waiting.progress,
      emptyStoryFacts(),
      'alchemy_crafted',
    );
    expect(crafted.progress.beatId).toBe('stay');
  });

  it('lets a beat wait on a fight without a lesson', () => {
    const parsed = StoryChapterSchema.parse({
      id: 'sample',
      track: 'main',
      title: '试章',
      beats: [
        {
          id: 'fight',
          kind: 'practice',
          accept: [{ type: 'fact', fact: 'training_victory' }],
          scene: 'training',
          prompt: '出去挡一挡。',
          href: '/game/training',
        },
        {
          id: 'stay',
          kind: 'life',
          scene: 'cave',
          prompt: '',
          href: '/game',
        },
      ],
    });
    expect(presentStory(parsed, progress('fight'), emptyStoryFacts()).guideLesson).toBe(
      null,
    );
    const won = noteStoryFact(parsed, progress('fight'), emptyStoryFacts(), 'training_victory');
    expect(won.progress.beatId).toBe('stay');
  });

  it('requires a configured lesson to be a real one, and the link to carry it', () => {
    const fight = {
      id: 'sample',
      track: 'main',
      title: '试章',
      beats: [
        {
          id: 'learn',
          kind: 'practice',
          accept: [{ type: 'guide', lesson: 'missing-lesson' }],
          scene: 'alchemy',
          prompt: '去看看。',
          href: '/game/craft/alchemy?guide=missing-lesson',
        },
      ],
    };
    expect(StoryChapterSchema.safeParse(fight).success).toBe(false);
    expect(
      StoryChapterSchema.safeParse({
        ...fight,
        beats: [
          {
            ...fight.beats[0],
            accept: [{ type: 'guide', lesson: 'alchemy-first-furnace' }],
            href: '/game/craft/alchemy',
          },
        ],
      }).success,
    ).toBe(false);
  });

  it('rejects a lesson the current beat did not ask for', () => {
    expect(() =>
      acknowledgeGuide(chapter, progress('craft'), emptyStoryFacts(), 'alchemy-first-furnace'),
    ).toThrow('当前没有这场教学');
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

  it('sends an arrival record that never watched the performance back to the opening', () => {
    const arrival = getStoryChapter();
    const skipped = {
      track: 'main' as const,
      storyId: 'arrival',
      beatId: 'entered',
      status: 'active' as const,
      acks: [],
      grants: [],
      marks: [],
    };
    const rewound = rewindToUnwatchedPerformance(arrival, skipped);
    expect(rewound.beatId).toBe('fall');
    expect(presentStory(arrival, rewound, emptyStoryFacts()).scriptId).toBe(
      'arrival-fall',
    );

    const watched = acknowledgePerformance(
      arrival,
      openingStoryProgress(),
      emptyStoryFacts(),
      'arrival-fall',
      'entered',
    );
    expect(
      rewindToUnwatchedPerformance(arrival, watched.progress).beatId,
    ).toBe('entered');
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
