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

  it('lets a beat wait on a world fact without a lesson', () => {
    const parsed = StoryChapterSchema.parse({
      id: 'sample',
      track: 'main',
      title: '试章',
      beats: [
        {
          id: 'fight',
          kind: 'practice',
          accept: [{ type: 'fact', fact: 'dungeon_settled' }],
          scene: 'wild',
          prompt: '外面还有一段路。',
          href: '/game/map-v2',
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
    const won = noteStoryFact(parsed, progress('fight'), emptyStoryFacts(), 'dungeon_settled');
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
    expect(rewindToUnwatchedPerformance(arrival, watched.progress).beatId).toBe(
      'ember',
    );
    const parked = rewindToUnwatchedPerformance(arrival, {
      ...skipped,
      acks: ['arrival-fall:entered'],
    });
    expect(parked.beatId).toBe('ember');
    expect(presentStory(arrival, parked, emptyStoryFacts()).scriptId).toBe(
      'arrival-ember',
    );
  });

  it('walks arrival from the cold furnace back to a quiet cave', () => {
    const arrival = getStoryChapter();
    const facts = emptyStoryFacts();
    const opened = acknowledgePerformance(
      arrival,
      openingStoryProgress(),
      facts,
      'arrival-fall',
      'entered',
    );
    expect(opened.progress.beatId).toBe('ember');
    expect(opened.grants).toEqual([]);
    expect(presentStory(arrival, opened.progress, facts).prompt).toBe(
      '玉简底下像是压着什么。',
    );

    const ember = acknowledgePerformance(
      arrival,
      opened.progress,
      facts,
      'arrival-ember',
      'hearth',
    );
    expect(ember.grants).toEqual(['first-herbs']);
    const hearth = presentStory(arrival, ember.progress, facts);
    expect(hearth.beatId).toBe('hearth');
    expect(hearth.guideLesson).toBe('alchemy-first-furnace');
    expect(hearth.href).toBe('/game/craft/alchemy?guide=alchemy-first-furnace');
    expect(hearth.prompt).toBe('玉简还温着，丹房里那口炉也还没灭干净。');

    const watched = acknowledgeGuide(
      arrival,
      ember.progress,
      facts,
      'alchemy-first-furnace',
    );
    const crafted = noteStoryFact(
      arrival,
      ember.progress,
      facts,
      'alchemy_crafted',
    );
    expect(watched.progress.beatId).toBe('scent');
    expect(crafted.progress.beatId).toBe('scent');
    expect(watched.grants).toEqual([]);

    const stayed = acknowledgePerformance(
      arrival,
      watched.progress,
      facts,
      'arrival-scent',
      'stayed',
    );
    expect(stayed.progress.beatId).toBe('mouth');
    expect(stayed.grants).toEqual([]);
    expect(presentStory(arrival, stayed.progress, facts).prompt).toBe(
      '洞口的风还没停。',
    );

    const returned = acknowledgePerformance(
      arrival,
      stayed.progress,
      facts,
      'arrival-mouth',
      'returned',
    );
    expect(returned.progress.beatId).toBe('lodge');
    expect(returned.grants).toEqual([]);
    expect(presentStory(arrival, returned.progress, facts).prompt).toBe(
      '洞里该有人睡下了。',
    );

    const slept = acknowledgePerformance(
      arrival,
      returned.progress,
      facts,
      'arrival-lodge',
      'slept',
    );
    expect(slept.progress.beatId).toBe('creek');
    expect(presentStory(arrival, slept.progress, facts).prompt).toBe(
      '天亮了，洞口的石痕还在。',
    );

    const creek = acknowledgePerformance(
      arrival,
      slept.progress,
      facts,
      'arrival-creek',
      'slope',
    );
    expect(creek.grants).toEqual([]);
    const slope = presentStory(arrival, creek.progress, facts);
    expect(slope.beatId).toBe('slope');
    expect(slope.guideLesson).toBe('map-qingxi');
    expect(slope.href).toBe('/game/map-v2?guide=map-qingxi');
    expect(slope.prompt).toBe('石痕在天亮以后，指向门外。');

    const named = acknowledgeGuide(arrival, creek.progress, facts, 'map-qingxi');
    expect(named.progress.beatId).toBe('grass');
    expect(named.grants).toEqual([]);

    const known = acknowledgePerformance(
      arrival,
      named.progress,
      facts,
      'arrival-grass',
      'known',
    );
    expect(known.progress.beatId).toBe('tracks');
    expect(presentStory(arrival, known.progress, facts).prompt).toBe(
      '青溪坡的风里有爪印。',
    );

    const tracks = acknowledgePerformance(
      arrival,
      known.progress,
      facts,
      'arrival-tracks',
      'tracks',
    );
    expect(tracks.grants).toEqual([]);
    const seek = presentStory(arrival, tracks.progress, facts);
    expect(seek.beatId).toBe('seek');
    expect(seek.guideLesson).toBeNull();
    expect(seek.href).toBe('/game/wild?nodeId=SAT_TN_08');
    expect(seek.prompt).toBe('青溪坡上有新爪印。');

    const sought = noteStoryFact(
      arrival,
      tracks.progress,
      facts,
      'qingxi_met',
    );
    expect(sought.progress.beatId).toBe('prints');

    const seen = acknowledgePerformance(
      arrival,
      sought.progress,
      facts,
      'arrival-prints',
      'seen',
    );
    expect(seen.progress.beatId).toBe('pouch');
    expect(presentStory(arrival, seen.progress, facts).prompt).toBe(
      '玉简上好像多了一行字。',
    );

    const pouch = acknowledgePerformance(
      arrival,
      seen.progress,
      facts,
      'arrival-pouch',
      'pouch',
    );
    const bag = presentStory(arrival, pouch.progress, facts);
    expect(bag.beatId).toBe('bag');
    expect(bag.guideLesson).toBe('beast-pouch');
    expect(bag.href).toBe('/game/beasts?guide=beast-pouch');
    expect(bag.prompt).toBe('玉简上多了灵兽袋的一行字。');

    const learned = acknowledgeGuide(
      arrival,
      pouch.progress,
      facts,
      'beast-pouch',
    );
    expect(learned.progress.beatId).toBe('satchel');
    expect(learned.grants).toEqual([]);

    const read = acknowledgePerformance(
      arrival,
      learned.progress,
      facts,
      'arrival-satchel',
      'read',
    );
    expect(read.progress.beatId).toBe('wound');
    expect(presentStory(arrival, read.progress, facts).prompt).toBe(
      '臂上的热还没退。',
    );

    const wound = acknowledgePerformance(
      arrival,
      read.progress,
      facts,
      'arrival-spring',
      'spring',
    );
    const spring = presentStory(arrival, wound.progress, facts);
    expect(spring.beatId).toBe('spring');
    expect(spring.guideLesson).toBe('cave-layout');
    expect(spring.href).toBe('/game?guide=cave-layout');
    expect(spring.prompt).toBe('伤还在，洞府里的泉还热着。');

    const tended = acknowledgeGuide(
      arrival,
      wound.progress,
      facts,
      'cave-layout',
    );
    expect(tended.progress.beatId).toBe('steady');
    expect(tended.grants).toEqual([]);

    const steady = acknowledgePerformance(
      arrival,
      tended.progress,
      facts,
      'arrival-steady',
      'steady',
    );
    expect(steady.progress.beatId).toBe('empty-hand');
    expect(presentStory(arrival, steady.progress, facts).prompt).toBe(
      '器炉那边还热着。',
    );

    const handy = acknowledgePerformance(
      arrival,
      steady.progress,
      facts,
      'arrival-handy',
      'forge',
    );
    expect(handy.grants).toEqual(['first-weapon']);
    const forge = presentStory(arrival, handy.progress, facts);
    expect(forge.beatId).toBe('forge');
    expect(forge.guideLesson).toBe('forge-first-weapon');
    expect(forge.href).toBe('/game/craft/refine?guide=forge-first-weapon');
    expect(forge.prompt).toBe('手里还是空的。');

    const shown = acknowledgeGuide(
      arrival,
      handy.progress,
      facts,
      'forge-first-weapon',
    );
    expect(shown.progress.beatId).toBe('forge');
    const armed = noteStoryFact(
      arrival,
      shown.progress,
      facts,
      'weapon_forged',
    );
    expect(armed.progress.beatId).toBe('grip');
    expect(armed.grants).toEqual([]);

    const held = acknowledgePerformance(
      arrival,
      armed.progress,
      facts,
      'arrival-grip',
      'held',
    );
    expect(held.progress.beatId).toBe('gate');
    expect(presentStory(arrival, held.progress, facts).prompt).toBe(
      '玉简上多了山门两个字。',
    );

    const gate = acknowledgePerformance(
      arrival,
      held.progress,
      facts,
      'arrival-gate',
      'gate',
    );
    const door = presentStory(arrival, gate.progress, facts);
    expect(door.beatId).toBe('door');
    expect(door.guideLesson).toBe('sect-door');
    expect(door.href).toBe('/game/sect?guide=sect-door');
    expect(door.prompt).toBe('玉简提到了山门。');

    const looked = acknowledgeGuide(arrival, gate.progress, facts, 'sect-door');
    expect(looked.progress.beatId).toBe('door');
    expect(presentStory(arrival, looked.progress, facts).prompt).toBe(
      '玉简提到了山门。',
    );
    expect(presentStory(arrival, looked.progress, facts).guideLesson).toBeNull();
    const alreadyJoined = resolveStory(arrival, looked.progress, {
      ...facts,
      sect_joined: true,
    });
    expect(alreadyJoined.progress.beatId).toBe('remain');

    const remained = acknowledgePerformance(
      arrival,
      alreadyJoined.progress,
      facts,
      'arrival-remain',
      'remained',
    );
    expect(remained.progress.beatId).toBe('entered');
    expect(presentStory(arrival, remained.progress, facts).prompt).toBe('');
    expect(
      presentStory(arrival, remained.progress, {
        ...facts,
        sect_joined: true,
      }).prompt,
    ).toBe('山门已经认了你。');
    expect(
      rewindToUnwatchedPerformance(arrival, remained.progress).beatId,
    ).toBe('entered');
    const waitingAtMouth = rewindToUnwatchedPerformance(arrival, {
      ...returned.progress,
      beatId: 'entered',
      acks: returned.progress.acks.filter((ack) => ack !== 'arrival-mouth:returned'),
    });
    expect(waitingAtMouth.beatId).toBe('mouth');
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
