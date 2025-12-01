'use client';

import { InkPageShell } from '@/components/InkLayout';
import { useCultivatorBundle } from '@/lib/hooks/useCultivatorBundle';
import { mockRankings } from '@/data/mockRankings';
import type { Cultivator } from '@/types/cultivator';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';

type RankingItem = {
  id: string;
  name: string;
  cultivationLevel: string;
  spiritRoot: string;
  faction?: string;
  combatRating: number;
};

const calcCombatRating = (cultivator: Cultivator): number => {
  const profile = cultivator.battleProfile;
  if (!profile) return 0;
  const { vitality, spirit, wisdom, speed } = profile.attributes;
  return Math.round((vitality + spirit + wisdom + speed) / 4);
};

export default function RankingsPage() {
  const router = useRouter();
  const { cultivator, isLoading, note, usingMock } = useCultivatorBundle();
  const [rankings, setRankings] = useState<RankingItem[]>([]);
  const [loadingRankings, setLoadingRankings] = useState(false);
  const [error, setError] = useState<string>('');

  const loadRankings = async () => {
    setLoadingRankings(true);
    setError('');
    try {
      const response = await fetch('/api/rankings');
      const result = await response.json();
      if (!response.ok || !result.success) {
        throw new Error(result.error || '榜单暂不可用');
      }
      setRankings(
        result.data.map((item: RankingItem) => ({
          ...item,
          combatRating: item.combatRating ?? 0,
        })),
      );
    } catch (err) {
      console.warn('排行榜接口未就绪，使用占位数据。', err);
      setRankings(
        mockRankings.map((item, index) => ({
          id: item.id ?? `mock-${index}`,
          name: item.name,
          cultivationLevel: item.cultivationLevel,
          spiritRoot: item.spiritRoot,
          faction: item.origin,
          combatRating: calcCombatRating(item),
        })),
      );
      setError('【占位】天骄榜使用假数据，待后端接入。');
    } finally {
      setLoadingRankings(false);
    }
  };

  useEffect(() => {
    void loadRankings();
  }, []);

  const handleChallenge = (opponentId: string) => {
    router.push(`/battle?opponent=${opponentId}`);
  };

  if (isLoading && !cultivator) {
    return (
      <div className="bg-paper min-h-screen flex items-center justify-center">
        <p className="loading-tip">天骄榜刷新中……</p>
      </div>
    );
  }

  return (
    <InkPageShell
      title="【天骄榜 · 筑基境】"
      subtitle="挑战天骄 · 证道天下"
      backHref="/"
      note={note || error}
      actions={
        <button className="btn-outline btn-sm" onClick={() => loadRankings()} disabled={loadingRankings}>
          {loadingRankings ? '推演中…' : '刷新榜单'}
        </button>
      }
      footer={
        <div className="flex justify-between text-ink">
          <Link href="/" className="hover:text-crimson">
            [返回主界]
          </Link>
          <span className="text-ink-secondary">榜单每晨更新，敬请留意。</span>
        </div>
      }
    >
      {!cultivator ? (
        <div className="rounded-lg border border-ink/10 bg-paper-light p-6 text-center">
          请先觉醒角色再来挑战天骄。
        </div>
      ) : (
        <div className="space-y-3">
          {rankings.map((item, index) => {
            const isSelf = item.name === cultivator.name;
            return (
              <div
                key={item.id}
                className={`flex items-center justify-between rounded-lg border p-3 shadow-sm ${
                  isSelf ? 'border-crimson/60 bg-crimson/5 font-semibold' : 'border-ink/10 bg-paper-light'
                }`}
              >
                <div className="flex items-center gap-3">
                  <div className="w-8 text-lg font-semibold">{index + 1}.</div>
                  <div>
                    <p>
                      {item.name}（{item.faction ?? '散修'}）{isSelf && <span className="equipped-mark">← 你</span>}
                    </p>
                    <p className="text-sm text-ink-secondary">
                      {item.cultivationLevel} · {item.spiritRoot}
                    </p>
                  </div>
                </div>
                <div className="flex items-center gap-3 text-sm">
                  <span>
                    <span className="status-icon">❤️</span>
                    {item.combatRating}
                  </span>
                  {!isSelf && (
                    <button className="btn-primary btn-sm" onClick={() => handleChallenge(item.id)}>
                      [挑战]
                    </button>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {usingMock && (
        <p className="mt-6 text-center text-xs text-ink-secondary">
          【占位】排行榜为硬编码示例，后续将接入实时数据。
        </p>
      )}
    </InkPageShell>
  );
}

