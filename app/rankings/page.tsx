'use client';

import {
  InkActionGroup,
  InkBadge,
  InkButton,
  InkList,
  InkListItem,
  InkNotice,
  InkTag,
} from '@/components/InkComponents';
import { InkPageShell } from '@/components/InkLayout';
import { mockRankings } from '@/data/mockRankings';
import { useCultivatorBundle } from '@/lib/hooks/useCultivatorBundle';
import type { Cultivator } from '@/types/cultivator';
import { useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';
import { usePathname } from 'next/navigation';

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
  const pathname = usePathname();

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
      currentPath={pathname}
      footer={
        <InkActionGroup align="between">
          <InkButton onClick={() => loadRankings()} disabled={loadingRankings}>
            {loadingRankings ? '推演中…' : '刷新榜单'}
          </InkButton>
          <InkButton href="/">返回</InkButton>
        </InkActionGroup>
      }
    >
      {!cultivator ? (
        <InkNotice>请先觉醒角色再来挑战天骄。</InkNotice>
      ) : (
        <InkList>
          {rankings.map((item, index) => {
            const isSelf = item.name === cultivator.name;
            return (
              <InkListItem
                key={item.id}
                title={
                  <>
                    {index + 1}. {item.name}{' '}
                    {isSelf && <span className="equipped-mark">← 你</span>}
                  </>
                }
                meta={
                  <>
                    <InkTag tone="info">{item.cultivationLevel}</InkTag>{' '}
                    <InkBadge tone="default">{item.faction ?? '散修'}</InkBadge>
                  </>
                }
                description={`❤️ ${item.combatRating}`}
                actions={
                  !isSelf && (
                    <InkButton
                      onClick={() => handleChallenge(item.id)}
                      variant="primary"
                      className="text-sm"
                    >
                      挑战
                    </InkButton>
                  )
                }
                highlight={isSelf}
              />
            );
          })}
        </InkList>
      )}

      {usingMock && (
        <p className="mt-6 text-center text-xs text-ink-secondary">
          【占位】排行榜为硬编码示例，后续将接入实时数据。
        </p>
      )}
    </InkPageShell>
  );
}
