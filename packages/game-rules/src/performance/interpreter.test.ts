import {
  fillPerformanceScript,
  parsePerformanceScript,
  type PerformanceScript,
} from '@daoyou/game-domain/performance';
import { describe, expect, it } from 'vitest';
import {
  createPerformanceState,
  currentPerformanceCue,
  reducePerformance,
} from './interpreter.js';

const script = parsePerformanceScript({
  id: 'sample',
  title: '试演',
  requires: ['name'],
  cast: { guide: { name: '引路人' } },
  cues: [
    {
      type: 'scene',
      src: '/assets/maps/world-overview-v1.webp',
      alt: '山河',
      tone: 'mist',
    },
    { type: 'narration', text: '{name}停下脚步。' },
    { type: 'mark', id: 'ask' },
    { type: 'line', speaker: 'guide', text: '要入山吗？' },
    {
      type: 'choice',
      options: [
        { label: '入山', jump: 'enter' },
        { label: '离开', outcome: 'leave' },
      ],
    },
    { type: 'mark', id: 'enter' },
    {
      type: 'narration',
      text: '山门开了。',
      when: { path: 'name', equals: '别人' },
    },
    { type: 'end', outcome: 'entered' },
  ],
});

function playToChoice(filled: PerformanceScript) {
  const context = { name: '阿青' };
  let state = createPerformanceState(filled, context);
  for (
    let step = 0;
    step < 6 && currentPerformanceCue(filled, state)?.type !== 'choice';
    step += 1
  ) {
    state = reducePerformance(filled, context, state, { type: 'advance' });
  }
  return state;
}

describe('performance interpreter', () => {
  it('fills declared actor names and rejects undeclared actor tokens', () => {
    const input = {
      id: 'teacher',
      title: '丹房',
      requires: ['teacher'],
      cast: { teacher: { name: '{teacher}' } },
      cues: [
        { type: 'scene', alt: '丹房' },
        { type: 'line', speaker: 'teacher', text: '开炉前先看清药材。' },
        { type: 'end', outcome: 'ready' },
      ],
    };
    const script = parsePerformanceScript(input);
    expect(
      fillPerformanceScript(script, { teacher: '程晚照' }).cast.teacher?.name,
    ).toBe('程晚照');
    expect(script.cast.teacher?.name).toBe('{teacher}');
    expect(() => fillPerformanceScript(script, {})).toThrow(
      '演出缺少填词：teacher',
    );
    expect(() => parsePerformanceScript({ ...input, requires: [] })).toThrow(
      '演出填词未声明：teacher',
    );
  });

  it('allows a scene that has words and no picture', () => {
    expect(() =>
      parsePerformanceScript({
        id: 'words',
        title: '无画',
        requires: [],
        cast: {},
        cues: [
          { type: 'scene', alt: '石室里只有一盏将尽的灯。' },
          { type: 'narration', text: '灯还亮着。' },
          { type: 'end', outcome: 'done' },
        ],
      }),
    ).not.toThrow();
  });

  it('rejects a jump that has no mark', () => {
    expect(() =>
      parsePerformanceScript({
        id: 'bad',
        title: '坏稿',
        requires: [],
        cast: {},
        cues: [
          { type: 'scene', src: '/a.webp', alt: '画' },
          { type: 'choice', options: [{ label: '去', jump: 'missing' }] },
          { type: 'end', outcome: 'done' },
        ],
      }),
    ).toThrow('演出跳转没有标记');
  });

  it('fills declared tokens and skips a failed condition', () => {
    const filled = fillPerformanceScript(script, { name: '阿青' });
    const context = { name: '阿青' };
    let state = createPerformanceState(filled, context);
    expect(currentPerformanceCue(filled, state)?.type).toBe('narration');
    state = reducePerformance(filled, context, state, { type: 'advance' });
    expect(state.revealed).toBe(true);
    state = playToChoice(filled);
    expect(currentPerformanceCue(filled, state)?.type).toBe('choice');
    state = reducePerformance(filled, context, state, {
      type: 'choose',
      index: 0,
    });
    expect(state.ending).toBe(true);
    expect(state.finished).toBe(false);
    expect(state.outcome).toBeUndefined();
    expect(reducePerformance(filled, context, state, { type: 'advance' })).toEqual(state);
    expect(reducePerformance(filled, context, state, { type: 'finish' })).toMatchObject({
      finished: true,
      outcome: 'entered',
    });
    expect(state.log).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ kind: 'narration', text: '阿青停下脚步。' }),
        expect.objectContaining({
          kind: 'line',
          speaker: '引路人',
          text: '要入山吗？',
        }),
      ]),
    );
  });

  it('returns an outcome from a choice and can restart', () => {
    const filled = fillPerformanceScript(script, { name: '阿青' });
    const choosing = playToChoice(filled);
    const left = reducePerformance(filled, { name: '阿青' }, choosing, {
      type: 'choose',
      index: 1,
    });
    expect(left.finished).toBe(true);
    expect(left.outcome).toBe('leave');
    const restarted = reducePerformance(filled, { name: '阿青' }, left, {
      type: 'restart',
    });
    expect(restarted.finished).toBe(false);
    expect(restarted.cursor).toBe(1);
  });

  describe('page, memory and branches', () => {
    const play = parsePerformanceScript({
      id: 'page',
      title: '纸页',
      requires: [],
      cast: { elder: { name: '许伯', portrait: 'icon:portrait-elder-m' } },
      cues: [
        { type: 'scene', alt: '溪边' },
        { type: 'title', kicker: '太岳山', text: '溪边' },
        { type: 'line', speaker: 'elder', text: '学过？' },
        {
          type: 'choice',
          options: [
            {
              label: '没有。',
              set: 'said-no',
              then: [{ type: 'line', speaker: 'elder', text: '嗯。' }],
            },
            { label: '（摇头）' },
          ],
        },
        { type: 'aside', text: '不是梦。' },
        { type: 'narration', text: '他记得。', when: { flag: 'said-no' } },
        {
          type: 'narration',
          text: '他没看见。',
          when: { flag: 'said-no', absent: true },
        },
        { type: 'scene', alt: '洞府' },
        { type: 'letter', title: '告示', text: '月末考校。' },
        { type: 'recall', lines: ['学过？', '嗯。'] },
        { type: 'end', outcome: 'done' },
      ],
    });

    function run(choice: number, flags: string[] = []) {
      let state = createPerformanceState(play, {}, flags);
      for (let step = 0; step < 40 && !state.ending; step += 1) {
        state =
          currentPerformanceCue(play, state)?.type === 'choice'
            ? reducePerformance(play, {}, state, { type: 'choose', index: choice })
            : reducePerformance(play, {}, state, { type: 'advance' });
      }
      return state;
    }

    it('plays the lines under the chosen option, then rejoins', () => {
      const state = run(0);
      expect(state.flags).toEqual(['said-no']);
      expect(state.log.map((entry) => `${entry.kind}:${entry.text}`)).toEqual([
        'title:溪边',
        'line:学过？',
        'said:没有。',
        'line:嗯。',
        'aside:不是梦。',
        'narration:他记得。',
        'letter:月末考校。',
        'recall:学过？\n嗯。',
      ]);
    });

    it('skips the other branch and reads flags both ways', () => {
      const state = run(1);
      expect(state.flags).toEqual([]);
      expect(state.log.map((entry) => entry.text)).toEqual([
        '溪边',
        '学过？',
        '（摇头）',
        '不是梦。',
        '他没看见。',
        '月末考校。',
        '学过？\n嗯。',
      ]);
    });

    it('starts with flags remembered from earlier plays', () => {
      expect(run(1, ['said-no']).log.map((entry) => entry.text)).toContain(
        '他记得。',
      );
    });

    it('turns the page on a new scene and keeps who spoke', () => {
      const state = run(0);
      expect(state.page).toBe(1);
      expect(state.log.find((entry) => entry.kind === 'letter')).toMatchObject({
        page: 1,
        heading: '告示',
      });
      expect(state.log[0]).toMatchObject({ page: 0, heading: '太岳山' });
      expect(state.log[1]).toMatchObject({ actor: 'elder', speaker: '许伯' });
    });

    it('rejects an option that points two ways', () => {
      expect(() =>
        parsePerformanceScript({
          id: 'two',
          title: '两头',
          requires: [],
          cast: {},
          cues: [
            { type: 'scene', alt: '画' },
            {
              type: 'choice',
              options: [
                {
                  label: '去',
                  outcome: 'gone',
                  then: [{ type: 'narration', text: '走了。' }],
                },
              ],
            },
            { type: 'end', outcome: 'done' },
          ],
        }),
      ).toThrow();
    });
  });
});
