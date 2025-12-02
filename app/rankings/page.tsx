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
  if (!cultivator?.attributes) return 0;
  const { vitality, spirit, wisdom, speed, willpower } = cultivator.attributes;
  return Math.round((vitality + spirit + wisdom + speed + willpower) / 5);
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
        result.data.map((item: Cultivator) => ({
          id: item.id ?? `item-${Math.random()}`,
          name: item.name,
          cultivationLevel: `${item.realm}${item.realm_stage}`,
          spiritRoot: item.spiritual_roots[0]?.element || '无',
          faction: item.origin,
          combatRating: calcCombatRating(item),
        })),
      );
    } catch (err) {
      console.warn('排行榜接口未就绪，使用占位数据。', err);
      setRankings(
        mockRankings.map((item, index) => ({
          id: item.id ?? `mock-${index}`,
          name: item.name,
          cultivationLevel: `${item.realm}${item.realm_stage}`,
          spiritRoot: item.spiritual_roots[0]?.element || '无',
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

  // 根据当前角色境界确定榜单标题
  const realmTitle = cultivator ? `${cultivator.realm}境` : '筑基境';

  if (isLoading && !cultivator) {
    return (
      <div className="bg-paper min-h-screen flex items-center justify-center">
        <p className="loading-tip">天骄榜刷新中……</p>
      </div>
    );
  }

  return (
    <InkPageShell
      title={`【天骄榜 · ${realmTitle}】`}
      subtitle=""
      backHref="/"
      note={note || error}
      footer={
        <div className="flex justify-between text-ink">
          <button 
            className="hover:text-crimson" 
            onClick={() => loadRankings()} 
            disabled={loadingRankings}
          >
            {loadingRankings ? '[推演中…]' : '[刷新榜单]'}
          </button>
          <Link href="/" className="hover:text-crimson">
            [返回]
          </Link>
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
                className={`rounded-lg border p-4 shadow-sm ${
                  isSelf ? 'border-crimson/60 bg-crimson/5 font-semibold' : 'border-ink/10 bg-paper-light'
                }`}
              >
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className="w-8 text-lg font-semibold">{index + 1}.</div>
                    <div>
                      <p>
                        {item.name}（{item.faction ?? '散修'}）
                        {isSelf && <span className="equipped-mark">← 你</span>}
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center gap-3">
                    <span className="text-base">
                      <span className="status-icon">❤️</span>
                      {item.combatRating}
                    </span>
                    {!isSelf && (
                      <button 
                        className="btn-primary btn-sm" 
                        onClick={() => handleChallenge(item.id)}
                      >
                        [挑战]
                      </button>
                    )}
                  </div>
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

