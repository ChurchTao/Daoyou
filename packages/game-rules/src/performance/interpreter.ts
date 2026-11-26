import {
  isPerformanceTextCue,
  performanceCueText,
  type PerformanceContext,
  type PerformanceCue,
  type PerformanceScript,
  type PerformanceTone,
} from '@daoyou/game-domain/performance';

export interface PerformanceBackdrop {
  src: string;
  alt: string;
  focus: string;
  tone: PerformanceTone;
}

export interface PerformanceLogEntry {
  /** said 是看的人自己选下的那一句。 */
  kind: 'title' | 'narration' | 'line' | 'aside' | 'letter' | 'recall' | 'said';
  /** 说话人在演员表里的名字。 */
  speaker?: string;
  /** 说话人在演员表里的键，用来找小像。 */
  actor?: string;
  /** 题签上方的小字，或纸中纸的抬头。 */
  heading?: string;
  text: string;
  /** 这一句落在第几页。换场景就翻一页。 */
  page: number;
}

export interface PerformanceState {
  cursor: number;
  revealed: boolean;
  ending: boolean;
  finished: boolean;
  outcome?: string;
  backdrop: PerformanceBackdrop;
  log: PerformanceLogEntry[];
  page: number;
  /** 开演前已有的标记，加上这一场里选下的。 */
  flags: string[];
}

export type PerformanceAction =
  | { type: 'advance' }
  | { type: 'choose'; index: number }
  | { type: 'finish' }
  | { type: 'restart' };

const emptyBackdrop = (): PerformanceBackdrop => ({
  src: '',
  alt: '',
  focus: 'center',
  tone: 'mist',
});

function whenAllows(
  cue: PerformanceCue,
  context: PerformanceContext,
  flags: readonly string[],
): boolean {
  if (!('when' in cue) || !cue.when) return true;
  if ('flag' in cue.when) {
    return flags.includes(cue.when.flag) !== Boolean(cue.when.absent);
  }
  return (context[cue.when.path] ?? '') === cue.when.equals;
}

interface LocatedCue {
  cursor: number;
  backdrop: PerformanceBackdrop;
  revealed: boolean;
  ending: boolean;
  page: number;
}

function markIndex(script: PerformanceScript, id: string | undefined): number {
  return script.cues.findIndex(
    (entry) => entry.type === 'mark' && entry.id === id,
  );
}

function locate(
  script: PerformanceScript,
  context: PerformanceContext,
  from: number,
  state: Pick<PerformanceState, 'backdrop' | 'page' | 'flags'> & {
    started: boolean;
  },
): LocatedCue {
  let backdrop = state.backdrop;
  let page = state.page;
  let cursor = from;
  // 跳转最多绕这么多次，写坏的剧本不会把页面卡死。
  let hops = script.cues.length;
  while (cursor < script.cues.length) {
    const cue = script.cues[cursor];
    if (!cue || !whenAllows(cue, context, state.flags) || cue.type === 'mark') {
      cursor += 1;
      continue;
    }
    if (cue.type === 'goto') {
      const target = markIndex(script, cue.mark);
      hops -= 1;
      if (target < 0 || hops < 0) throw new Error('演出跳转绕不出来');
      cursor = target + 1;
      continue;
    }
    if (cue.type === 'scene') {
      backdrop = {
        src: cue.src ?? backdrop.src,
        alt: cue.alt ?? backdrop.alt,
        focus: cue.focus ?? backdrop.focus,
        tone: cue.tone ?? backdrop.tone,
      };
      if (state.started && page === state.page) page += 1;
      cursor += 1;
      continue;
    }
    if (cue.type === 'end') {
      return { cursor, backdrop, revealed: true, ending: true, page };
    }
    return {
      cursor,
      backdrop,
      revealed: cue.type === 'choice',
      ending: false,
      page,
    };
  }
  throw new Error('演出没有可停留的指令');
}

export function createPerformanceState(
  script: PerformanceScript,
  context: PerformanceContext = {},
  flags: readonly string[] = [],
): PerformanceState {
  const located = locate(script, context, 0, {
    backdrop: emptyBackdrop(),
    page: 0,
    flags: [...flags],
    started: false,
  });
  return {
    cursor: located.cursor,
    revealed: located.revealed,
    ending: located.ending,
    finished: false,
    backdrop: located.backdrop,
    log: [],
    page: located.page,
    flags: [...flags],
  };
}

function remember(
  script: PerformanceScript,
  state: PerformanceState,
): PerformanceLogEntry[] {
  const cue = script.cues[state.cursor];
  if (!cue || !isPerformanceTextCue(cue)) return state.log;
  return [
    ...state.log,
    {
      kind: cue.type,
      text: performanceCueText(cue),
      page: state.page,
      ...(cue.type === 'line'
        ? { speaker: script.cast[cue.speaker]?.name, actor: cue.speaker }
        : {}),
      ...(cue.type === 'title' && cue.kicker ? { heading: cue.kicker } : {}),
      ...(cue.type === 'letter' && cue.title ? { heading: cue.title } : {}),
    },
  ];
}

function moveTo(
  script: PerformanceScript,
  context: PerformanceContext,
  state: PerformanceState,
  from: number,
): PerformanceState {
  const located = locate(script, context, from, { ...state, started: true });
  return {
    ...state,
    cursor: located.cursor,
    backdrop: located.backdrop,
    revealed: located.revealed,
    ending: located.ending,
    page: located.page,
  };
}

export function reducePerformance(
  script: PerformanceScript,
  context: PerformanceContext,
  state: PerformanceState,
  action: PerformanceAction,
  initialFlags: readonly string[] = [],
): PerformanceState {
  if (action.type === 'restart') {
    return createPerformanceState(script, context, initialFlags);
  }
  if (state.finished) return state;

  const cue = script.cues[state.cursor];
  if (!cue) return state;

  if (action.type === 'finish') {
    if (!state.ending || cue.type !== 'end') return state;
    return { ...state, finished: true, outcome: cue.outcome };
  }

  if (action.type === 'choose') {
    if (cue.type !== 'choice' || !state.revealed) return state;
    const option = cue.options[action.index];
    if (!option) return state;
    const chosen: PerformanceState = {
      ...state,
      flags:
        option.set && !state.flags.includes(option.set)
          ? [...state.flags, option.set]
          : state.flags,
      log: [
        ...state.log,
        { kind: 'said', text: option.label, page: state.page },
      ],
    };
    if (option.outcome) {
      return {
        ...chosen,
        finished: true,
        outcome: option.outcome,
        revealed: true,
      };
    }
    if (!option.jump) return moveTo(script, context, chosen, state.cursor + 1);
    const markAt = markIndex(script, option.jump);
    if (markAt < 0) return state;
    return moveTo(script, context, chosen, markAt + 1);
  }

  if (cue.type === 'choice' || cue.type === 'end') return state;
  if (!state.revealed) return { ...state, revealed: true };

  return moveTo(
    script,
    context,
    { ...state, log: remember(script, state) },
    state.cursor + 1,
  );
}

export function currentPerformanceCue(
  script: PerformanceScript,
  state: PerformanceState,
): PerformanceCue | null {
  return script.cues[state.cursor] ?? null;
}
