import { CombatV6Page } from '@app/components/feature/combat-v6/CombatV6Page';
import { CombatV6ReplayPlayer } from '@app/components/feature/combat-v6/CombatV6ReplayPlayer';
import { InkButton } from '@app/components/ui/InkButton';
import { consumeResourceMutation } from '@app/lib/resources/mutations';
import type { CombatV6ReplayView } from '@shared/combat-v6/replay';
import type { InfiniteTowerRewardPreview } from '@shared/lib/infiniteTower';
import { useEffect, useState } from 'react';
import { useSearchParams } from 'react-router';

type BattlePayload = {
  battleResult: CombatV6ReplayView;
  callbackData: { isWin: boolean; reward: InfiniteTowerRewardPreview | null };
};

export default function InfiniteTowerBattlePage() {
  const [params] = useSearchParams();
  const battleId = params.get('battleId');
  const [result, setResult] = useState<BattlePayload>();
  const [error, setError] = useState<string>();
  useEffect(() => {
    if (!battleId) return;
    let cancelled = false;
    void (async () => {
      try {
        const response = await fetch('/api/infinite-tower/battle/execute/v6', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ battleId }),
        });
        const payload = await consumeResourceMutation<BattlePayload>(response);
        if (!payload.battleResult || !payload.callbackData)
          throw new Error('通天塔结算响应不完整');
        if (!cancelled) setResult(payload);
      } catch (e) {
        if (!cancelled)
          setError(e instanceof Error ? e.message : '战局读取失败');
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [battleId]);
  if (result) {
    const reward = result.callbackData.reward;
    return (
      <CombatV6ReplayPlayer
        record={result.battleResult}
        autoPlay
        title="通天塔"
        back="/game/infinite-tower"
        backLabel="返回通天塔"
        endContent={
          <p>
            {result.callbackData.isWin && reward
              ? `登阶成功，获得 ${reward.totalReward.toLocaleString('zh-CN')} 灵石${reward.itemRewards.map((item) => `、${item.name} ×${item.quantity}`).join('')}。`
              : '此次未能登阶，既有进度保留。'}
          </p>
        }
      />
    );
  }
  return (
    <CombatV6Page title="通天塔" active>
      <p role={error ? 'alert' : undefined}>
        {error ?? (battleId ? '守塔战局推演中……' : '缺少战局标识')}
      </p>
      <InkButton href="/game/infinite-tower">返回通天塔</InkButton>
    </CombatV6Page>
  );
}
