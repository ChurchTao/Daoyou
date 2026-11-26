import { GameLoadingState } from '@app/components/game-shell';
import { InkButton, InkNotice } from '@app/components/ui';
import { InkDetailDrawer } from '@app/components/ui/InkDetailDrawer';
import { apiFetch } from '@app/lib/api/fetch';
import type {
  ContestRankingDetail,
  ContestRankingEntry,
} from '@daoyou/contracts/alchemy/contest';
import {
  getAlchemyPropertyLabel,
  getPillAppearanceLabel,
} from '@daoyou/game-rules/alchemy';
import { useEffect, useState } from 'react';

function ScoreSheet({ detail }: { detail: ContestRankingDetail }) {
  const { result } = detail;
  const seconds = Math.floor(detail.elapsedMs / 1000);
  const time = `${Math.floor(seconds / 60)}:${String(seconds % 60).padStart(2, '0')}`;
  const points = [
    ['主药效', result.points.effect, 50],
    ['品质', result.points.quality, 15],
    ['产量', result.points.quantity, 10],
    ['品相', result.points.appearance, 10],
    ['用时', result.points.time, 5],
  ] as const;
  return (
    <div className="alchemy-score-sheet">
      <div className="alchemy-score-total">
        <div>
          <p>
            第 <b className="font-mono">{detail.bestAttempt}</b> 炉 · 最高分
          </p>
          <h3>{detail.pillName}</h3>
        </div>
        <p>
          <b className="font-mono">{detail.score}</b> 分
        </p>
      </div>

      <dl className="alchemy-score-evidence">
        <div>
          <dt>成丹药效</dt>
          <dd>
            {result.effects.map(({ key, value }, index) => (
              <span key={key}>
                {index > 0 && '、'}
                {getAlchemyPropertyLabel(key)}{' '}
                <b className="font-mono">
                  {key === 'restore_hp' || key === 'restore_mp'
                    ? `${Number((value * 100).toFixed(2))}%`
                    : value}
                </b>
              </span>
            ))}
          </dd>
        </div>
        <div>
          <dt>达标产量</dt>
          <dd>
            {result.qualifiedLots.map(({ quality, quantity }, index) => (
              <span key={quality}>
                {index > 0 && '、'}
                {quality} <b className="font-mono">×{quantity}</b>
              </span>
            ))}
          </dd>
        </div>
        <div>
          <dt>品相</dt>
          <dd>{getPillAppearanceLabel(result.appearance)}</dd>
        </div>
        <div>
          <dt>丹毒</dt>
          <dd className="font-mono">{result.toxicity}</dd>
        </div>
        <div>
          <dt>入场至开炉</dt>
          <dd className="font-mono">{time}</dd>
        </div>
      </dl>

      <section aria-label="得分构成">
        <h3>总分构成</h3>
        <dl className="alchemy-score-breakdown">
          <div>
            <dt>最高炉得分</dt>
            <dd className="font-mono">{result.score}</dd>
          </div>
          <div>
            <dt>节材加分</dt>
            <dd className="font-mono">+{detail.materialPoints}</dd>
          </div>
          <div>
            <dt>节气加分</dt>
            <dd className="font-mono">+{detail.qiPoints}</dd>
          </div>
        </dl>
        <p className="alchemy-score-note">
          全场开 <b className="font-mono">{detail.attemptCount}</b> 炉，使用{' '}
          <b className="font-mono">{detail.usedMaterials}</b> 份材料和{' '}
          <b className="font-mono">{detail.usedQi}</b> 点炉气。
        </p>
      </section>

      <section aria-label="最高炉分项">
        <h3>最高炉分项</h3>
        <dl className="alchemy-score-breakdown">
          {points.map(([label, value, cap]) => (
            <div key={label}>
              <dt>{label}</dt>
              <dd>
                <b className="font-mono">{value}</b>
                <span className="font-mono"> / {cap}</span>
              </dd>
            </div>
          ))}
        </dl>
        <p className="alchemy-score-note">
          总分相同先比主药效分，再比全场用料，少者在前。两项都相同则并列。
        </p>
      </section>
    </div>
  );
}

export function AlchemyScoreDetail({
  entry,
  week,
  onClose,
}: {
  entry: ContestRankingEntry;
  week: string;
  onClose: () => void;
}) {
  const [detail, setDetail] = useState<ContestRankingDetail | null>(null);
  const [error, setError] = useState('');
  const [retry, setRetry] = useState(0);
  useEffect(() => {
    const controller = new AbortController();
    async function load() {
      try {
        const response = await apiFetch(
          `/api/alchemy-contest/ranking/${encodeURIComponent(entry.id)}?week=${encodeURIComponent(week)}`,
          { signal: controller.signal, cache: 'no-store' },
        );
        if (controller.signal.aborted) return;
        if (response.status === 404) {
          setError('该成绩已不可查看，请刷新榜单。');
          return;
        }
        if (!response.ok) throw new Error('成绩读取失败');
        const fresh = (await response.json()) as ContestRankingDetail;
        if (!controller.signal.aborted) setDetail(fresh);
      } catch {
        if (!controller.signal.aborted) setError('暂时无法读取成绩明细。');
      }
    }
    void load();
    return () => controller.abort();
  }, [entry.id, retry, week]);

  return (
    <InkDetailDrawer
      isOpen
      title="成绩明细"
      description={
        <span>
          {entry.name}
          {entry.title && <> · {entry.title}</>} · 第{' '}
          <b className="font-mono">{entry.rank}</b> 名
        </span>
      }
      closeLabel="返回榜单"
      size="md"
      className="alchemy-score-drawer"
      onClose={onClose}
    >
      {error ? (
        <InkNotice tone="warning">
          {error}
          <InkButton
            variant="secondary"
            onClick={() => {
              setError('');
              setRetry((count) => count + 1);
            }}
          >
            重试
          </InkButton>
        </InkNotice>
      ) : detail ? (
        <ScoreSheet detail={detail} />
      ) : (
        <GameLoadingState variant="inline" message="正在读取成绩…" />
      )}
    </InkDetailDrawer>
  );
}
