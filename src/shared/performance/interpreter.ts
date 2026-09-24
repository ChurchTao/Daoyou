import type {
  PerformanceContext,
  PerformanceCue,
  PerformanceScript,
  PerformanceTone,
} from './schema';

export interface PerformanceBackdrop {
  src: string;
  alt: string;
  focus: string;
  tone: PerformanceTone;
}

export interface PerformanceLogEntry {
  kind: 'title' | 'narration' | 'line';
  speaker?: string;
  text: string;
}

export interface PerformanceState {
  cursor: number;
  revealed: boolean;
  ending: boolean;
  finished: boolean;
  outcome?: string;
  backdrop: PerformanceBackdrop;
  log: PerformanceLogEntry[];
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

function whenAllows(cue: PerformanceCue, context: PerformanceContext): boolean {
  if (!('when' in cue) || !cue.when) return true;
  return (context[cue.when.path] ?? '') === cue.when.equals;
}

function isText(cue: PerformanceCue): cue is Extract<
  PerformanceCue,
  { type: 'title' | 'narration' | 'line' }
> {
  return cue.type === 'title' || cue.type === 'narration' || cue.type === 'line';
}

interface LocatedCue {
  cursor: number;
  backdrop: PerformanceBackdrop;
  revealed: boolean;
  ending: boolean;
}

function locate(
  script: PerformanceScript,
  context: PerformanceContext,
  from: number,
  backdrop: PerformanceBackdrop,
): LocatedCue {
  let nextBackdrop = backdrop;
  for (let cursor = from; cursor < script.cues.length; cursor += 1) {
    const cue = script.cues[cursor];
    if (!cue || !whenAllows(cue, context)) continue;
    if (cue.type === 'mark') continue;
    if (cue.type === 'scene') {
      nextBackdrop = {
        src: cue.src ?? nextBackdrop.src,
        alt: cue.alt ?? nextBackdrop.alt,
        focus: cue.focus ?? nextBackdrop.focus,
        tone: cue.tone ?? nextBackdrop.tone,
      };
      continue;
    }
    if (cue.type === 'end') {
      return { cursor, backdrop: nextBackdrop, revealed: true, ending: true };
    }
    return {
      cursor,
      backdrop: nextBackdrop,
      revealed: cue.type === 'choice',
      ending: false,
    };
  }
  throw new Error('演出没有可停留的指令');
}

export function createPerformanceState(
  script: PerformanceScript,
  context: PerformanceContext = {},
): PerformanceState {
  const located = locate(script, context, 0, emptyBackdrop());
  return {
    cursor: located.cursor,
    revealed: located.revealed,
    ending: located.ending,
    finished: false,
    backdrop: located.backdrop,
    log: [],
  };
}

function remember(script: PerformanceScript, state: PerformanceState): PerformanceLogEntry[] {
  const cue = script.cues[state.cursor];
  if (!cue || !isText(cue)) return state.log;
  const speaker =
    cue.type === 'line' ? script.cast[cue.speaker]?.name : undefined;
  return [...state.log, { kind: cue.type, speaker, text: cue.text }];
}

export function reducePerformance(
  script: PerformanceScript,
  context: PerformanceContext,
  state: PerformanceState,
  action: PerformanceAction,
): PerformanceState {
  if (action.type === 'restart') return createPerformanceState(script, context);
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
    if (option.outcome) {
      return { ...state, finished: true, outcome: option.outcome, revealed: true };
    }
    const markAt = script.cues.findIndex(
      (entry) => entry.type === 'mark' && entry.id === option.jump,
    );
    if (markAt < 0) return state;
    const located = locate(script, context, markAt + 1, state.backdrop);
    return {
      ...state,
      cursor: located.cursor,
      backdrop: located.backdrop,
      revealed: located.revealed,
      ending: located.ending,
      log: remember(script, state),
    };
  }

  if (cue.type === 'choice' || cue.type === 'end') return state;
  if (!state.revealed) return { ...state, revealed: true };

  const located = locate(script, context, state.cursor + 1, state.backdrop);
  return {
    ...state,
    cursor: located.cursor,
    backdrop: located.backdrop,
    revealed: located.revealed,
    ending: located.ending,
    log: remember(script, state),
  };
}

export function currentPerformanceCue(
  script: PerformanceScript,
  state: PerformanceState,
): PerformanceCue | null {
  return script.cues[state.cursor] ?? null;
}
