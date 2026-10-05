import { StoryChapterSchema } from '@daoyou/game-content/authoring/story';
import { describe, expect, it } from 'vitest';
import { openingStoryProgress } from './progress.js';
import { storyMarkForSignal } from './signals.js';
import { getStoryChapter } from '@daoyou/game-content/story/catalog';
import {
  acknowledgeGuide,
  acknowledgePerformance,
  noteStoryFact,
  presentStory,
  resolveStory,
  rewindToUnwatchedPerformance,
} from './resolve.js';
import {
  emptyStoryFacts,
  STORY_MARK_FACT_IDS,
  StoryProgressSchema,
  type StoryChapter,
  type StoryProgress,
} from '@daoyou/game-domain/story';

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

function progress(
  beatId: string,
  extra: Partial<StoryProgress> = {},
): StoryProgress {
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
    expect(
      presentStory(chapter, opened.progress, facts).guideLesson,
    ).toBeNull();
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
    expect(
      presentStory(guided, opened.progress, emptyStoryFacts()).guideLesson,
    ).toBe('alchemy-first-furnace');
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
    expect(
      presentStory(both, waiting.progress, emptyStoryFacts()).guideLesson,
    ).toBeNull();
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
    expect(
      presentStory(parsed, progress('fight'), emptyStoryFacts()).guideLesson,
    ).toBe(null);
    const won = noteStoryFact(
      parsed,
      progress('fight'),
      emptyStoryFacts(),
      'dungeon_settled',
    );
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
      acknowledgeGuide(
        chapter,
        progress('craft'),
        emptyStoryFacts(),
        'alchemy-first-furnace',
      ),
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
    expect(
      resolveStory(chapter, stayed, emptyStoryFacts()).progress.beatId,
    ).toBe('stay');
  });

  it('sends an unstarted arrival record to the opening', () => {
    const arrival = getStoryChapter();
    const unwatched = progress('entered', { storyId: 'arrival' });
    const rewound = rewindToUnwatchedPerformance(
      arrival,
      unwatched,
      emptyStoryFacts(),
    );
    expect(rewound.beatId).toBe('fall');
    expect(presentStory(arrival, rewound, emptyStoryFacts()).scriptId).toBe(
      'arrival-fall',
    );
  });

  it.each([
    'scent',
    'mouth',
    'lodge',
    'grass',
    'prints',
    'satchel',
    'wound',
    'spring',
    'steady',
    'grip',
  ])('migrates the removed arrival beat %s without losing progress', (beatId) => {
    const arrival = getStoryChapter();
    const old = progress(beatId, {
      storyId: 'arrival',
      acks: ['arrival-fall:entered', 'arrival-scent:stayed'],
      grants: ['first-herbs'],
      marks: ['guide:cave-layout', 'alchemy_crafted'],
    });
    const migrated = rewindToUnwatchedPerformance(
      arrival,
      old,
      emptyStoryFacts(),
    );
    expect(migrated.beatId).toBe('identity');
    expect(migrated.acks).toEqual(old.acks);
    expect(migrated.grants).toEqual(old.grants);
    expect(migrated.marks).toEqual([...old.marks, 'arrival-v2']);
    expect(presentStory(arrival, old, emptyStoryFacts()).beatId).toBe('identity');
    const continued = acknowledgeGuide(
      arrival,
      old,
      emptyStoryFacts(),
      'cultivator-basics',
    );
    expect(continued.progress.beatId).toBe('pack');
    expect(continued.grants).toEqual([]);
  });

  it('preserves the completed old arrival endpoint without replaying new lessons', () => {
    const arrival = getStoryChapter();
    for (const status of ['active', 'completed'] as const) {
      const old = progress('entered', {
        storyId: 'arrival',
        status,
        acks: ['arrival-remain:remained'],
        grants: ['first-herbs', 'first-weapon'],
        marks: ['alchemy_crafted', 'weapon_forged'],
      });
      const normalized = rewindToUnwatchedPerformance(
        arrival,
        old,
        emptyStoryFacts(),
      );
      expect(normalized.beatId).toBe('entered');
      expect(normalized.status).toBe(status);
      const resolved = resolveStory(arrival, normalized, emptyStoryFacts());
      expect(resolved.progress.beatId).toBe('entered');
      expect(resolved.grants).toEqual([]);
      expect(presentStory(arrival, resolved.progress, emptyStoryFacts()).kind).toBe(
        'life',
      );
    }
  });

  it('migrates an old active record to the first missing real action', () => {
    const arrival = getStoryChapter();
    const old = progress('grip', {
      storyId: 'arrival',
      acks: arrival.beats.flatMap((beat) =>
        beat.kind === 'performance' ? [`${beat.script}:${beat.outcome}`] : [],
      ),
      grants: ['first-herbs', 'first-weapon'],
      marks: arrival.beats.flatMap((beat) =>
        beat.kind === 'practice'
          ? beat.accept.flatMap((acceptance) =>
              acceptance.type === 'guide' ? [`guide:${acceptance.lesson}`] : [],
            )
          : [],
      ),
    });
    const facts = emptyStoryFacts();
    const notJoined = resolveStory(arrival, old, facts);
    expect(notJoined.progress.beatId).toBe('door');
    expect(notJoined.grants).toEqual([]);
    facts.sect_joined = true;
    expect(resolveStory(arrival, old, facts).progress.beatId).toBe('hearth');
    const crafted = resolveStory(
      arrival,
      { ...old, marks: [...old.marks, 'alchemy_crafted'] },
      facts,
    );
    expect(crafted.progress.beatId).toBe('forge');
    expect(crafted.grants).toEqual([]);
  });

  it('does not recheck passed live facts after the arrival revision is recorded', () => {
    const arrival = getStoryChapter();
    const active = progress('seek', {
      storyId: 'arrival',
      acks: arrival.beats
        .slice(0, arrival.beats.findIndex((beat) => beat.id === 'seek'))
        .flatMap((beat) =>
          beat.kind === 'performance' ? [`${beat.script}:${beat.outcome}`] : [],
        ),
      marks: ['arrival-v2'],
    });
    expect(
      rewindToUnwatchedPerformance(arrival, active, emptyStoryFacts()).beatId,
    ).toBe('seek');
    const resolved = resolveStory(arrival, active, emptyStoryFacts());
    expect(resolved.progress.beatId).toBe('seek');
    expect(resolved.grants).toEqual([]);
    const met = noteStoryFact(arrival, active, emptyStoryFacts(), 'qingxi_met');
    expect(met.progress.beatId).toBe('remain');
  });

  it('accepts a Qingxi meeting without requiring a victory or a captured beast', () => {
    const arrival = getStoryChapter();
    const fact = storyMarkForSignal({ type: 'wild.met', nodeId: 'SAT_TN_08' });
    expect(fact).toBe('qingxi_met');
    const current = progress('seek', {
      storyId: 'arrival',
      marks: ['arrival-v2'],
    });
    const met = noteStoryFact(arrival, current, emptyStoryFacts(), 'qingxi_met');
    expect(met.progress.beatId).toBe('remain');
  });

  it('validates the migration mark without persisting live world facts as marks', () => {
    expect(
      StoryProgressSchema.safeParse(
        progress('home', { storyId: 'arrival', marks: ['arrival-v2'] }),
      ).success,
    ).toBe(true);
    for (const fact of ['weapon_equipped', 'sect_ready']) {
      expect(
        StoryProgressSchema.safeParse(
          progress('home', { storyId: 'arrival', marks: [fact] }),
        ).success,
      ).toBe(false);
    }
  });

  it('requires a real sect membership while allowing its introductory lesson to be optional', () => {
    const arrival = getStoryChapter();
    const current = progress('door', {
      storyId: 'arrival',
      marks: ['arrival-v2'],
    });
    const facts = emptyStoryFacts();
    expect(
      acknowledgeGuide(arrival, current, facts, 'sect-door').progress.beatId,
    ).toBe('door');
    expect(
      resolveStory(arrival, current, { ...facts, sect_joined: true }).progress
        .beatId,
    ).toBe('ember');
  });

  it.each(['hearth', 'forge', 'equip', 'path', 'bag'])(
    'requires the lesson as well as the real action at %s',
    (beatId) => {
      const arrival = getStoryChapter();
      const beat = arrival.beats.find((entry) => entry.id === beatId)!;
      if (beat.kind !== 'practice') throw new Error('教学幕不是实操');
      const current = progress(beatId, {
        storyId: 'arrival',
        marks: ['arrival-v2'],
      });
      const facts = emptyStoryFacts();
      for (const acceptance of beat.accept) {
        if (acceptance.type !== 'fact') continue;
        if ((STORY_MARK_FACT_IDS as readonly string[]).includes(acceptance.fact)) {
          current.marks.push(acceptance.fact);
        } else {
          facts[acceptance.fact] = true;
        }
      }
      expect(resolveStory(arrival, current, facts).progress.beatId).toBe(beatId);
      const lesson = presentStory(arrival, current, facts).guideLesson!;
      expect(
        acknowledgeGuide(arrival, current, facts, lesson).progress.beatId,
      ).not.toBe(beatId);
    },
  );

  it.each([
    ['hearth', 'first-furnace-lesson'],
    ['forge', 'first-weapon'],
  ])('issues a missing arrival bundle at %s exactly once', (beatId, grant) => {
    const arrival = getStoryChapter();
    const current = progress(beatId, {
      storyId: 'arrival',
      marks: ['arrival-v2'],
    });
    const first = resolveStory(arrival, current, emptyStoryFacts());
    expect(first.progress.beatId).toBe(beatId);
    expect(first.grants).toEqual([grant]);
    const repeated = resolveStory(arrival, first.progress, emptyStoryFacts());
    expect(repeated.grants).toEqual([]);
    expect(repeated.progress.grants).toEqual([grant]);
  });

  it('funds the new furnace lesson once for an old player who only watched alchemy', () => {
    const arrival = getStoryChapter();
    const facts = emptyStoryFacts();
    const old = progress('hearth', {
      storyId: 'arrival',
      acks: ['arrival-fall:entered', 'arrival-ember:hearth'],
      grants: ['first-herbs'],
      marks: ['guide:alchemy-first-furnace'],
    });
    let current = rewindToUnwatchedPerformance(arrival, old, facts);
    expect(current.beatId).toBe('home');
    for (const lesson of [
      'cave-layout',
      'cultivator-basics',
      'inventory-basics',
    ]) {
      current = acknowledgeGuide(arrival, current, facts, lesson).progress;
    }
    current = acknowledgePerformance(
      arrival,
      current,
      facts,
      'arrival-creek',
      'slope',
    ).progress;
    current = acknowledgeGuide(arrival, current, facts, 'map-qingxi').progress;
    current = acknowledgePerformance(
      arrival,
      current,
      facts,
      'arrival-gate',
      'gate',
    ).progress;
    facts.sect_joined = true;
    const classroom = resolveStory(arrival, current, facts);
    expect(classroom.progress.beatId).toBe('hearth');
    expect(classroom.grants).toEqual(['first-furnace-lesson']);
    expect(classroom.progress.grants).toEqual([
      'first-herbs',
      'first-furnace-lesson',
    ]);
    expect(resolveStory(arrival, classroom.progress, facts).grants).toEqual([]);
    expect(
      noteStoryFact(arrival, classroom.progress, facts, 'alchemy_crafted')
        .progress.beatId,
    ).toBe('empty-hand');
  });

  it('walks the complete arrival chain through real actions before the first outing', () => {
    const arrival = getStoryChapter();
    const facts = emptyStoryFacts();
    const issued: string[] = [];
    let current = openingStoryProgress();
    const accept = (resolution: ReturnType<typeof resolveStory>, beatId: string) => {
      current = resolution.progress;
      issued.push(...resolution.grants);
      expect(current.beatId).toBe(beatId);
    };
    const play = (script: string, outcome: string, beatId: string) =>
      accept(acknowledgePerformance(arrival, current, facts, script, outcome), beatId);
    const guide = (lesson: string, beatId: string) =>
      accept(acknowledgeGuide(arrival, current, facts, lesson), beatId);

    play('arrival-fall', 'entered', 'home');
    guide('cave-layout', 'identity');
    guide('cultivator-basics', 'pack');
    guide('inventory-basics', 'creek');
    play('arrival-creek', 'slope', 'slope');
    guide('map-qingxi', 'gate');
    play('arrival-gate', 'gate', 'door');
    guide('sect-door', 'door');
    expect(presentStory(arrival, current, facts).guideLesson).toBeNull();
    facts.sect_joined = true;
    accept(resolveStory(arrival, current, facts), 'ember');

    play('arrival-ember', 'hearth', 'hearth');
    expect(issued).toEqual(['first-furnace-lesson']);
    guide('alchemy-first-furnace', 'hearth');
    guide('alchemy-first-furnace', 'hearth');
    expect(issued).toEqual(['first-furnace-lesson']);
    accept(noteStoryFact(arrival, current, facts, 'alchemy_crafted'), 'empty-hand');

    play('arrival-handy', 'forge', 'forge');
    expect(issued).toEqual(['first-furnace-lesson', 'first-weapon']);
    guide('forge-first-weapon', 'forge');
    accept(noteStoryFact(arrival, current, facts, 'weapon_forged'), 'equip');
    guide('weapon-equip', 'equip');
    facts.weapon_equipped = true;
    accept(resolveStory(arrival, current, facts), 'pouch');

    play('arrival-pouch', 'pouch', 'path');
    guide('sect-first-path', 'path');
    facts.sect_ready = true;
    accept(resolveStory(arrival, current, facts), 'attributes');
    guide('first-attributes', 'bag');
    guide('beast-pouch', 'bag');
    facts.starter_beast = true;
    accept(resolveStory(arrival, current, facts), 'tracks');
    play('arrival-tracks', 'tracks', 'seek');
    accept(noteStoryFact(arrival, current, facts, 'qingxi_met'), 'remain');
    play('arrival-remain', 'remained', 'entered');
    expect(issued).toEqual(['first-furnace-lesson', 'first-weapon']);
    expect(resolveStory(arrival, current, facts).grants).toEqual([]);
    expect(
      rewindToUnwatchedPerformance(arrival, current, emptyStoryFacts()).beatId,
    ).toBe('entered');
  });

  it('still rejects an unknown arrival beat instead of treating it as legacy', () => {
    const arrival = getStoryChapter();
    const unknown = progress('not-an-arrival-beat', { storyId: 'arrival' });
    expect(() => resolveStory(arrival, unknown, emptyStoryFacts())).toThrow(
      '剧情幕不存在：not-an-arrival-beat',
    );
    expect(() => presentStory(arrival, unknown, emptyStoryFacts())).toThrow(
      '剧情幕不存在：not-an-arrival-beat',
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
