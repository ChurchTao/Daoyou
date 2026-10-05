import { getPerformanceScript } from '@daoyou/game-content/performance/catalog';
import { getStoryChapter } from '@daoyou/game-content/story/catalog';
import { describe, expect, it } from 'vitest';
import {
  createPerformanceState,
  currentPerformanceCue,
  reducePerformance,
} from './interpreter.js';
import {
  fillPerformanceScript,
  parsePerformanceScript,
  type PerformanceScript,
} from '@daoyou/game-domain/performance';

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

function playArrival(scriptId: string, choice: 0 | 1) {
  const context = {
    name: '顾清舟',
    background: '山里长大，没有师门。',
    receptionist: '接引师兄',
    alchemy_teacher: '程晚照',
    forge_teacher: '谭折柳',
    instructor: '赵照川',
  };
  const script = fillPerformanceScript(getPerformanceScript(scriptId), context);
  let state = createPerformanceState(script, context);
  for (let step = 0; step < 80 && !state.finished; step += 1) {
    const cue = currentPerformanceCue(script, state);
    state = reducePerformance(script, context, state,
      cue?.type === 'choice' ? { type: 'choose', index: choice }
        : cue?.type === 'end' ? { type: 'finish' } : { type: 'advance' },
    );
  }
  return { script, state };
}

describe('performance interpreter', () => {
  it('plays every arrival chapter performance and inquiry to its configured outcome', () => {
    const performances = getStoryChapter('arrival').beats.filter(
      (beat) => beat.kind === 'performance',
    );
    for (const beat of performances) {
      for (const choice of [0, 1] as const) {
        const played = playArrival(beat.script, choice);
        expect(played.state.finished, `${beat.script}, choice ${choice}`).toBe(true);
        expect(played.state.outcome).toBe(beat.outcome);
        expect(JSON.stringify(played.script)).not.toMatch(/\{(?:name|alchemy_teacher|forge_teacher|instructor)\}/);
      }
    }
    expect(playArrival('arrival-ember', 0).state.log).toContainEqual(
      expect.objectContaining({ kind: 'line', speaker: '程晚照' }),
    );
    expect(playArrival('arrival-handy', 0).state.log).toContainEqual(
      expect.objectContaining({ kind: 'line', speaker: '谭折柳' }),
    );
  });

  it('fills declared actor names and rejects undeclared actor tokens', () => {
    const input = {
      id: 'teacher', title: '丹房', requires: ['teacher'],
      cast: { teacher: { name: '{teacher}' } },
      cues: [
        { type: 'scene', alt: '丹房' },
        { type: 'line', speaker: 'teacher', text: '开炉前先看清药材。' },
        { type: 'end', outcome: 'ready' },
      ],
    };
    const script = parsePerformanceScript(input);
    expect(fillPerformanceScript(script, { teacher: '程晚照' }).cast.teacher?.name).toBe('程晚照');
    expect(script.cast.teacher?.name).toBe('{teacher}');
    expect(() => fillPerformanceScript(script, {})).toThrow('演出缺少填词：teacher');
    expect(() => parsePerformanceScript({ ...input, requires: [] })).toThrow('演出填词未声明：teacher');
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
});
