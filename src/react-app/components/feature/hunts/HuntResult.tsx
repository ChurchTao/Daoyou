import { ItemSlot } from '@app/components/feature/items/ItemSlot';
import { InkModal } from '@app/components/layout/InkModal';
import type { HuntBattleReward } from '@shared/contracts/hunts';
import { dungeonRewardItemName } from '@shared/rewards/dungeon';
import { useState } from 'react';
import { Link } from 'react-router';
import { useHunts } from './useHunts';

export function HuntResult({
  battleId,
  onClose,
}: {
  battleId: string;
  onClose: () => void;
}) {
  const { data, error, refresh } = useHunts<HuntBattleReward>(
    `/api/hunts/battles/${battleId}/reward`,
  );
  const [showRewards, setShowRewards] = useState(false);
  return (
    <div className="min-w-0 space-y-2 text-sm">
      <p role="status">
        {error
          ? '暂未查到此次所得，请稍后再看'
          : !data || data.status === 'pending'
            ? '正在清点此次所得……'
            : data.status === 'assisting'
              ? '助战得胜。你已领过此次报酬，不再另赠。'
              : data.status === 'no-reward'
                ? '此战未能得胜，行踪消失前还可再战。'
                : '此次所得已收妥'}
      </p>
      {data?.status === 'rewarded' && data.reward ? (
        <InkModal
          isOpen={showRewards}
          title="讨伐所得"
          onClose={() => setShowRewards(false)}
        >
          <div className="space-y-4">
            <p className="flex flex-wrap justify-center gap-3">
              <span>
                修为{' '}
                <span className="font-mono">+{data.reward.experience}</span>
              </span>
              <span>
                灵石{' '}
                <span className="font-mono">+{data.reward.spiritStones}</span>
              </span>
              <span>
                感悟 <span className="font-mono">+{data.reward.insight}</span>
              </span>
            </p>
            {data.reward.items.length ? (
              <>
                <div className="flex flex-wrap justify-center gap-2">
                  {data.reward.items.map((item, index) => (
                    <ItemSlot
                      key={index}
                      className="w-20"
                      quantityLabel="奖励"
                      item={{
                        ...item,
                        instanceData: item.instanceData ?? null,
                        name: dungeonRewardItemName(item),
                      }}
                    />
                  ))}
                </div>
                <p className="text-ink-secondary">
                  寻得的物品已随信送来。
                  <Link to="/game/mail" className="text-teal underline">
                    查看邮件
                  </Link>
                </p>
              </>
            ) : null}
          </div>
        </InkModal>
      ) : null}
      <div className="flex flex-wrap justify-center gap-3">
        {data?.status === 'rewarded' ? (
          <button onClick={() => setShowRewards(true)}>查看所得</button>
        ) : null}
        {error ? <button onClick={refresh}>重试</button> : null}
        <button onClick={onClose}>返回讨伐队伍</button>
      </div>
    </div>
  );
}
