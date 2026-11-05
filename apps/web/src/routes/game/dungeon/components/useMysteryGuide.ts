import { useCallback, useState } from 'react';

/** 新手引导的三条提示，按顺序各出现一次；看过的记在本机，跨局保留。 */
export const MYSTERY_GUIDE_STEPS = [
  {
    id: 'act',
    text: '点正文里带虚线的字就能行动：调查物件、与人交谈、前往别处。多数动作耗 1 点行动力；回到去过的地方、和每个人的第一次交谈不耗。',
  },
  {
    id: 'board',
    text: '拿到的线索会自动记进案情板，从“线索与人物”打开查看。想到什么，可以记在顶部的笔记里。',
  },
  {
    id: 'deduce',
    text: '没头绪时可以点“提示”，每局 3 次，不耗行动力。想好答案后点“提交推理”，答题时随时可以回到调查，真正提交后才结束。',
  },
] as const;

type GuideStepId = (typeof MYSTERY_GUIDE_STEPS)[number]['id'];

const STORAGE_KEY = 'daoyou:mystery-guide';

function readDone(): GuideStepId[] {
  try {
    const parsed: unknown = JSON.parse(
      window.localStorage.getItem(STORAGE_KEY) ?? '[]',
    );
    return Array.isArray(parsed) ? (parsed as GuideStepId[]) : [];
  } catch {
    return [];
  }
}

/**
 * 当前该显示的引导：按顺序取第一条未看过且已满足条件的。
 * `ready` 给出每条提示的出现时机，例如拿到第一条线索后才提示案情板。
 */
export function useMysteryGuide(ready: Record<GuideStepId, boolean>) {
  const [done, setDone] = useState(readDone);
  const step = MYSTERY_GUIDE_STEPS.find((s) => !done.includes(s.id));

  const dismiss = useCallback((id: GuideStepId) => {
    setDone((prev) => {
      const next = [...prev, id];
      try {
        window.localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
      } catch {
        // 本机存储不可用时只在本次页面内记住。
      }
      return next;
    });
  }, []);

  return { step: step && ready[step.id] ? step : null, dismiss };
}
