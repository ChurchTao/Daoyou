'use client';

import { InkBadge, InkButton } from '@/components/InkComponents';
import { RankingItem } from '@/lib/redis/rankings';
import { RealmType } from '@/types/constants';

interface RankingListItemProps {
  item: RankingItem;
  isSelf: boolean;
  canChallenge: boolean;
  isChallenging: boolean;
  isProbing: boolean;
  onChallenge: (targetId: string) => void;
  onProbe: (targetId: string) => void;
}

export function RankingListItem({
  item,
  isSelf,
  canChallenge,
  isChallenging,
  isProbing,
  onChallenge,
  onProbe,
}: RankingListItemProps) {
  // 获取性别符号
  const genderSymbol = item.gender === '男' ? '☯' : '🌸';

  return (
    <div
      className={`py-3 border-b border-ink-border ${isSelf ? 'bg-ink-bg-highlight' : ''}`}
    >
      {/* 第一行：排名、姓名、性别、年龄、标记 */}
      <div className="flex items-baseline gap-2 mb-1">
        <span className="font-bold text-lg min-w-8">{item.rank}.</span>
        <span className="font-bold">
          {genderSymbol} {item.name}
        </span>
        <span className="text-sm opacity-70">{item.age}岁</span>
        {isSelf && <span className="equipped-mark text-sm">← 你</span>}
        {item.is_new_comer && <InkBadge tone="accent">[新天骄]</InkBadge>}
      </div>

      {/* 第二行：境界、来源 */}
      <div className="flex items-center gap-2 mb-2 ml-10">
        <InkBadge tier={item.realm as RealmType}>{item.realm_stage}</InkBadge>
        <InkBadge tone="default">{item.origin ?? '散修'}</InkBadge>
      </div>

      {/* 第三行：操作按钮（仅非自己时显示） */}
      {!isSelf && (
        <div className="flex gap-2 ml-10">
          {canChallenge && (
            <InkButton
              onClick={() => onChallenge(item.id)}
              variant="primary"
              disabled={isChallenging}
            >
              {isChallenging ? '挑战中…' : '挑战'}
            </InkButton>
          )}
          <InkButton
            onClick={() => onProbe(item.id)}
            variant="secondary"
            disabled={isProbing}
          >
            {isProbing ? '查探中…' : '神识查探'}
          </InkButton>
        </div>
      )}
    </div>
  );
}
