import arrivalFall from '../content/performances/arrival-fall.json' with { type: 'json' };
import arrivalMouth from '../content/performances/arrival-mouth.json' with { type: 'json' };
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
} from './schema.js';

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

function playArrival(choice: 0 | 1) {
  const context = { name: '顾清舟', background: '山里长大，没有师门。' };
  const script = fillPerformanceScript(parsePerformanceScript(arrivalFall), context);
  let state = createPerformanceState(script, context);
  const seen: string[] = [];
  for (let step = 0; step < 20; step += 1) {
    const cue = currentPerformanceCue(script, state);
    if (cue?.type === 'choice') {
      state = reducePerformance(script, context, state, { type: 'choose', index: choice });
      continue;
    }
    if (cue?.type === 'end') {
      state = reducePerformance(script, context, state, { type: 'finish' });
      break;
    }
    if (cue && (cue.type === 'narration' || cue.type === 'line')) {
      if (!state.revealed) {
        state = reducePerformance(script, context, state, { type: 'advance' });
      }
      seen.push(cue.text);
    }
    state = reducePerformance(script, context, state, { type: 'advance' });
  }
  return { script, state, seen };
}

describe('performance interpreter', () => {
  it('lets both arrival attitudes enter the same cave', () => {
    const held = playArrival(0);
    const looked = playArrival(1);
    expect(held.script.cues.find((cue) => cue.type === 'scene')).toMatchObject({
      alt: '山壁围成一间低矮石室，裂缝里漏进一线天光。',
    });
    expect(held.seen.some((text) => text.includes('榻下塞着一卷落灰的毯子'))).toBe(true);
    expect(held.seen.some((text) => text.includes('潮湿的山风扑在脸上'))).toBe(false);
    expect(looked.seen.some((text) => text.includes('潮湿的山风扑在脸上'))).toBe(true);
    expect(looked.seen.some((text) => text.includes('榻下塞着一卷落灰的毯子'))).toBe(false);
    expect(held.state.outcome).toBe('entered');
    expect(looked.state.outcome).toBe('entered');
  });

  it('lets both cave-mouth attitudes return inside', () => {
    const context = { name: '顾清舟' };
    const script = fillPerformanceScript(parsePerformanceScript(arrivalMouth), context);
    const play = (choice: 0 | 1) => {
      let state = createPerformanceState(script, context);
      const seen: string[] = [];
      for (let step = 0; step < 20; step += 1) {
        const cue = currentPerformanceCue(script, state);
        if (cue?.type === 'choice') {
          state = reducePerformance(script, context, state, {
            type: 'choose',
            index: choice,
          });
          continue;
        }
        if (cue?.type === 'end') {
          state = reducePerformance(script, context, state, { type: 'finish' });
          break;
        }
        if (cue && (cue.type === 'narration' || cue.type === 'line')) {
          if (!state.revealed) {
            state = reducePerformance(script, context, state, { type: 'advance' });
          }
          seen.push(cue.text);
        }
        state = reducePerformance(script, context, state, { type: 'advance' });
      }
      return { state, seen };
    };
    const stayed = play(0);
    const backed = play(1);
    expect(stayed.seen.some((text) => text.includes('最前面的两级石阶'))).toBe(true);
    expect(stayed.seen.some((text) => text.includes('木闩合上时'))).toBe(false);
    expect(backed.seen.some((text) => text.includes('木闩合上时'))).toBe(true);
    expect(stayed.state.outcome).toBe('returned');
    expect(backed.state.outcome).toBe('returned');
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
