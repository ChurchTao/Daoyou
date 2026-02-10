'use client';

import { InkBadge, type Tier } from '@/components/ui/InkBadge';
import { InkButton } from '@/components/ui/InkButton';
import {
  BattleRankingItem,
  ItemRankingEntry,
  RankingsDisplayItem,
} from '@/types/rankings';
import { memo } from 'react';

interface RankingListItemProps {
  item: RankingsDisplayItem;
  isSelf: boolean;
  canChallenge: boolean;
  isChallenging: boolean;
  isProbing: boolean;
  onChallenge: (targetId: string) => Promise<void>;
  onProbe: (targetId: string) => Promise<void>;
  customSubtitle?: string;
  customMeta?: string;
  isItem?: boolean;
}

function RankingListItemComponent({
  item,
  isSelf,
  canChallenge,
  isChallenging,
  isProbing,
  onChallenge,
  onProbe,
  customSubtitle,
  customMeta,
  isItem = false,
}: RankingListItemProps) {
  // Type guards/assertions for convenience
  const battleItem = !isItem ? (item as BattleRankingItem) : null;
  const rankItem = isItem ? (item as ItemRankingEntry) : null;

  // 获取性别符号 (Only for characters)
  const genderSymbol =
    battleItem && battleItem.gender
      ? battleItem.gender === '男'
        ? '☯'
        : '🌸'
      : '';

  return (
    <div
      className={`border-ink/20 border-b border-dashed py-3 ${isSelf ? 'bg-ink-bg-highlight' : ''}`}
    >
      {/* 第一行：排名、姓名、性别、标题/品质、标记 */}
      <div className="mb-1 flex items-baseline gap-2">
        <span className="min-w-8 text-lg font-bold">{item.rank}.</span>
        <span className="font-bold">
          {genderSymbol} {item.name}{' '}
          {!isItem && item.title ? `「${item.title}」` : ''}
        </span>
        {isSelf && <span className="equipped-mark text-sm">← 你</span>}
        {item.is_new_comer && <InkBadge tone="accent">[新天骄]</InkBadge>}
        {isItem && (rankItem?.quality || rankItem?.grade) && (
          <InkBadge tier={(rankItem.quality || rankItem.grade) as Tier}>
            {rankItem.type}
          </InkBadge>
        )}
      </div>

      {/* 第二行：信息展示 (Battle: Realm/Age, Item: Subtitle/Meta) */}
      <div className="mb-2 ml-10 flex flex-wrap gap-2">
        {!isItem && battleItem ? (
          <>
            <InkBadge tier={battleItem.realm as Tier}>
              {battleItem.realm_stage}
            </InkBadge>
            <span className="text-sm opacity-70">「{battleItem.age}岁」</span>
          </>
        ) : (
          <>
            {customSubtitle && (
              <span className="text-sm opacity-70">{customSubtitle}</span>
            )}
            {customMeta && (
              <span className="text-sm font-semibold">{customMeta}</span>
            )}
          </>
        )}
      </div>

      {/* 来源 / 描述 */}
      <p className="mb-2 ml-10 text-sm opacity-70">
        {!isItem && battleItem
          ? (battleItem.origin ?? '散修')
          : rankItem?.description || '暂无描述'}
      </p>

      {/* 第三行：操作按钮（仅非自己时显示，且仅Battle榜显示） */}
      {!isSelf && !isItem && (
        <div className="ml-10 flex justify-end gap-2">
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

// 使用 React.memo 优化，仅在 props 变化时重新渲染
export const RankingListItem = memo(RankingListItemComponent);
