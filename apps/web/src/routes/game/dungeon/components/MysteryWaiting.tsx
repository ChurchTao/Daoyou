import { useEffect, useState } from 'react';

const STAGES = {
  start: [
    [0, '正在翻检此地的剧本……'],
    [5, '此地还没有现成的剧本，正在推演往事……'],
    [20, '安排人物与线索……'],
    [45, '撰写场景与人物的言语……'],
    [70, '核对前后是否自洽……'],
  ],
  deduce: [
    [0, '正在核对你的推断……'],
    [3, '推演此案的结局……'],
  ],
} as const;

/** 长时间等待时按阶段提示进度并显示已等待的秒数，避免玩家以为卡住。 */
export function MysteryWaiting({
  active,
  kind,
}: {
  active: boolean;
  kind: keyof typeof STAGES;
}) {
  // 每次开始等待都重新挂载计时，从零计起。
  return active ? <WaitingTicker kind={kind} /> : null;
}

function WaitingTicker({ kind }: { kind: keyof typeof STAGES }) {
  const [started] = useState(() => Date.now());
  const [seconds, setSeconds] = useState(0);

  useEffect(() => {
    const timer = window.setInterval(
      () => setSeconds(Math.floor((Date.now() - started) / 1000)),
      1000,
    );
    return () => window.clearInterval(timer);
  }, [started]);

  const stage = [...STAGES[kind]].reverse().find(([at]) => seconds >= at)!;
  return (
    <p role="status" className="text-ink-secondary text-center text-sm">
      {stage[1]}
      {seconds >= 3 ? (
        <span className="ml-2 font-mono tracking-tight">{seconds} 秒</span>
      ) : null}
    </p>
  );
}
