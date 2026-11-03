import { useCallback, useState } from 'react';

/** 玩家自己的推理笔记：线索钉到哪个结案问题、哪些线索已读。只存本机，不影响评分。 */
export interface MysteryNotes {
  pins: Record<string, string>;
  seen: string[];
}

const EMPTY: MysteryNotes = { pins: {}, seen: [] };

function storageKey(runId: string) {
  return `daoyou:mystery-notes:${runId}`;
}

function readNotes(runId: string | undefined): MysteryNotes {
  if (!runId) return EMPTY;
  try {
    const raw = window.localStorage.getItem(storageKey(runId));
    if (!raw) return EMPTY;
    const parsed = JSON.parse(raw) as Partial<MysteryNotes>;
    return {
      pins: parsed.pins && typeof parsed.pins === 'object' ? parsed.pins : {},
      seen: Array.isArray(parsed.seen) ? parsed.seen : [],
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

  const pin = useCallback(
    (clueId: string, questionId: string | null) =>
      update((prev) => {
        const pins = { ...prev.pins };
        if (questionId) pins[clueId] = questionId;
        else delete pins[clueId];
        return { ...prev, pins };
      }),
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

  return { notes, pin, markSeen };
}
