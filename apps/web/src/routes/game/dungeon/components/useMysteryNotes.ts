import type { MysteryAnswers } from '@daoyou/game-domain/dungeon/mystery';
import { useCallback, useState } from 'react';

/** 每道题最多可选的证据数，与结案接口的限制一致。 */
export const MYSTERY_EVIDENCE_LIMIT = 5;

/**
 * 玩家自己的推理笔记，存在本机：每题的证据与答案草稿、笔记本，哪些线索已读，
 * 开局一幕是否看过。答案与证据在提交推理时才发给服务器。
 */
export interface MysteryNotes {
  /** questionId → clueId[]：同一条线索可以作为多道题的证据。 */
  evidence: Record<string, string[]>;
  seen: string[];
  answers: MysteryAnswers;
  notebook: string;
  introDone: boolean;
}

const EMPTY: MysteryNotes = {
  evidence: {},
  seen: [],
  answers: {},
  notebook: '',
  introDone: false,
};

function storageKey(runId: string) {
  return `daoyou:mystery-notes:${runId}`;
}

const isRecord = (value: unknown): value is Record<string, unknown> =>
  Boolean(value) && typeof value === 'object' && !Array.isArray(value);

/** 旧版笔记按“线索 → 题”存，一条线索只能归一道题。 */
function evidenceFromPins(pins: Record<string, unknown>) {
  const evidence: Record<string, string[]> = {};
  for (const [clueId, questionId] of Object.entries(pins))
    if (typeof questionId === 'string')
      (evidence[questionId] ??= []).push(clueId);
  return evidence;
}

function readNotes(runId: string | undefined): MysteryNotes {
  if (!runId) return EMPTY;
  try {
    const raw = window.localStorage.getItem(storageKey(runId));
    if (!raw) return EMPTY;
    const parsed = JSON.parse(raw) as Record<string, unknown>;
    return {
      evidence: isRecord(parsed.evidence)
        ? (parsed.evidence as Record<string, string[]>)
        : isRecord(parsed.pins)
          ? evidenceFromPins(parsed.pins)
          : {},
      seen: Array.isArray(parsed.seen) ? (parsed.seen as string[]) : [],
      answers: isRecord(parsed.answers)
        ? (parsed.answers as MysteryAnswers)
        : {},
      notebook: typeof parsed.notebook === 'string' ? parsed.notebook : '',
      // 旧版笔记没有此字段，记录过笔记就不是新开的一局。
      introDone: parsed.introDone === true || isRecord(parsed.pins),
    };
  } catch {
    return EMPTY;
  }
}

export function useMysteryNotes(runId: string | undefined) {
  const [state, setState] = useState(() => ({
    runId,
    notes: readNotes(runId),
  }));
  // 换了一局时在渲染中重新读取，不经过 effect。
  if (state.runId !== runId) setState({ runId, notes: readNotes(runId) });
  const notes = state.runId === runId ? state.notes : readNotes(runId);

  const update = useCallback(
    (next: (prev: MysteryNotes) => MysteryNotes) => {
      setState((prev) => {
        const value = next(prev.notes);
        if (runId) {
          try {
            window.localStorage.setItem(
              storageKey(runId),
              JSON.stringify(value),
            );
          } catch {
            // 本机存储不可用时只在本次页面内保留。
          }
        }
        return { runId, notes: value };
      });
    },
    [runId],
  );

  const toggleEvidence = useCallback(
    (clueId: string, questionId: string) =>
      update((prev) => {
        const list = prev.evidence[questionId] ?? [];
        if (!list.includes(clueId) && list.length >= MYSTERY_EVIDENCE_LIMIT)
          return prev;
        return {
          ...prev,
          evidence: {
            ...prev.evidence,
            [questionId]: list.includes(clueId)
              ? list.filter((id) => id !== clueId)
              : [...list, clueId],
          },
        };
      }),
    [update],
  );

  const setAnswer = useCallback(
    (questionId: string, choiceId: string) =>
      update((prev) => ({
        ...prev,
        answers: { ...prev.answers, [questionId]: choiceId },
      })),
    [update],
  );

  const setNotebook = useCallback(
    (notebook: string) => update((prev) => ({ ...prev, notebook })),
    [update],
  );

  const finishIntro = useCallback(
    () => update((prev) => ({ ...prev, introDone: true })),
    [update],
  );

  const markSeen = useCallback(
    (ids: string[]) =>
      update((prev) =>
        ids.every((id) => prev.seen.includes(id))
          ? prev
          : { ...prev, seen: [...new Set([...prev.seen, ...ids])] },
      ),
    [update],
  );

  return {
    notes,
    toggleEvidence,
    setAnswer,
    setNotebook,
    finishIntro,
    markSeen,
  };
}
