import type { BattleEngineResult } from '@/engine/battleEngine';
import Link from 'next/link';

export type ZhanjiRecord = {
  id: string;
  createdAt: string | null;
  challengeType?: 'challenge' | 'challenged' | 'normal' | string;
  opponentCultivatorId?: string | null;
} & Pick<BattleEngineResult, 'winner' | 'loser' | 'turns'>;

interface ZhanjiProps {
  record: ZhanjiRecord;
  currentCultivatorId?: string;
}

export default function Zhanji({ record, currentCultivatorId }: ZhanjiProps) {
  const getChallengeTypeLabel = (type?: string) => {
    switch (type) {
      case 'challenge':
        return '← 挑战';
      case 'challenged':
        return '← 被挑战';
      default:
        return '';
    }
  };

  const getChallengeTypeColor = (type?: string) => {
    switch (type) {
      case 'challenge':
        return 'text-blue-600';
      case 'challenged':
        return 'text-purple-600';
      default:
        return 'text-ink/80';
    }
  };

  const winnerName = record.winner?.name ?? '未知';
  const loserName = record.loser?.name ?? '未知';
  const isWin = currentCultivatorId === record.winner?.id;
  const turns = record.turns ?? 0;
  const typeLabel = getChallengeTypeLabel(record.challengeType);
  const typeColor = getChallengeTypeColor(record.challengeType);

  return (
    <Link
      href={`/battle/${record.id}`}
      className="block border border-ink/10 bg-white/60 px-3 py-2 text-sm text-ink/80 hover:border-crimson/40 hover:text-ink transition"
    >
      <div className="flex justify-between">
        <div>
          <span
            className={`${typeColor} ${
              isWin ? 'text-emerald-600' : 'text-crimson'
            }`}
          >
            {isWin ? '【胜】' : '【败】'}
          </span>
          <span className="ml-1">
            {winnerName} vs {loserName}
          </span>
          <span className="ml-1">{typeLabel}</span>
        </div>
        {record.createdAt && (
          <span className="text-ink/50 text-xs text-right ml-2 min-w-[80px]">
            {/* Added simple styling for date alignment if needed, but keeping generally close to original */}
            {new Date(record.createdAt).toLocaleString()}
          </span>
        )}
      </div>
      {turns > 0 && (
        <div className="mt-1 text-xs text-ink/60">
          共 {turns} 回合 · 点击查看战报回放
        </div>
      )}
    </Link>
  );
}
