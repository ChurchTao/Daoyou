import { GameIcon } from '@app/components/ui/GameIcon';
import { InkButton } from '@app/components/ui/InkButton';
import { getDivination } from '@app/lib/divinationApi';
import type { DivinationView } from '@shared/contracts/divination';
import { useEffect, useState } from 'react';

export function DailyDivinationEntry() {
  const [view, setView] = useState<DivinationView | null>(null);
  const [error, setError] = useState(false);

  useEffect(() => {
    let request: AbortController | undefined;
    let timer: number | undefined;
    const refresh = async () => {
      request?.abort();
      window.clearTimeout(timer);
      const controller = new AbortController();
      request = controller;
      try {
        const next = await getDivination(controller.signal);
        if (controller.signal.aborted) return;
        setView(next);
        setError(false);
        const midnight =
          Date.parse(`${next.today}T00:00:00+08:00`) + 86_400_000;
        timer = window.setTimeout(
          () => void refresh(),
          Math.max(1000, midnight - Date.now() + 1000),
        );
      } catch {
        if (!controller.signal.aborted) {
          setView(null);
          setError(true);
        }
      }
    };
    const onFocus = () => void refresh();
    const onVisible = () => {
      if (document.visibilityState === 'visible') void refresh();
    };
    void refresh();
    window.addEventListener('focus', onFocus);
    document.addEventListener('visibilitychange', onVisible);
    return () => {
      request?.abort();
      window.clearTimeout(timer);
      window.removeEventListener('focus', onFocus);
      document.removeEventListener('visibilitychange', onVisible);
    };
  }, []);

  const record = view && !view.canDraw ? view.record : null;
  const action = record
    ? record.rewardGranted
      ? '查看解签'
      : record.interpretation
        ? '领取签礼'
        : '继续解签'
    : view?.canDraw
      ? '去占卜'
      : '进入占卜';

  return (
    <div className="space-y-3">
      <h2 className="text-ink flex items-center gap-2 text-sm">
        <GameIcon value="🎲" />
        每日占卜
      </h2>
      {record ? (
        <div className="space-y-2">
          <p className="text-ink-secondary text-xs">
            {record.dayKey === view?.today ? '今日卦象' : '上次占卜待完成'}
          </p>
          <p className="text-crimson text-base">{record.omen.name}</p>
          <p className="text-ink-secondary text-sm leading-7">
            {record.omen.verse}
          </p>
        </div>
      ) : (
        <p className="text-ink-secondary text-sm leading-7">
          {error
            ? '暂未读到今日卦象'
            : view
              ? '今日尚未占卜'
              : '正在查看今日卦象……'}
        </p>
      )}
      <InkButton href="/game/divination" variant="primary" className="px-0">
        {action}
      </InkButton>
    </div>
  );
}
