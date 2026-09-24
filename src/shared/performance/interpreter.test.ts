import { describe, expect, it } from 'vitest';
import {
  createPerformanceState,
  currentPerformanceCue,
  reducePerformance,
} from './interpreter';
import {
  fillPerformanceScript,
  parsePerformanceScript,
  type PerformanceScript,
} from './schema';

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
    { type: 'narration', text: '山门开了。', when: { path: 'name', equals: '别人' } },
    { type: 'end', outcome: 'entered' },
  ],
});

function playToChoice(filled: PerformanceScript) {
  const context = { name: '阿青' };
  let state = createPerformanceState(filled, context);
  for (let step = 0; step < 6 && currentPerformanceCue(filled, state)?.type !== 'choice'; step += 1) {
    state = reducePerformance(filled, context, state, { type: 'advance' });
  }
  return state;
}

describe('performance interpreter', () => {
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
