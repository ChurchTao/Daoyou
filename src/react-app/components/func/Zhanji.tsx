import type { BattleRecord } from '@shared/types/battle';
import Link from '@app/components/router/AppLink';

export type ZhanjiRecord = {
  id: string;
  createdAt: string | null;
  battleType?: 'challenge' | 'challenged' | 'normal' | string;
  challengeType?: 'challenge' | 'challenged' | 'normal' | string;
  opponentCultivatorId?: string | null;
} & Pick<BattleRecord, 'winner' | 'loser' | 'turns'>;

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
        return 'text-wood';
      case 'challenged':
        return 'text-ink-secondary';
      default:
        return 'text-ink/80';
    }
  };

  const winnerName = record.winner?.name ?? '未知';
  const loserName = record.loser?.name ?? '未知';
  const isWin = currentCultivatorId === record.winner?.id;
  const turns = record.turns ?? 0;
  const type = record.battleType ?? record.challengeType;
  const typeLabel = getChallengeTypeLabel(type);
  const typeColor = getChallengeTypeColor(type);

  return (
    <Link
      href={`/game/battle/${record.id}`}
      className="border-ink/10 text-ink/80 hover:border-crimson/40 hover:text-ink block border border-dashed bg-bgpaper/70 px-3 py-2 text-sm transition"
    >
      <div className="flex justify-between">
        <div>
          <span
            className={`${typeColor} ${
              isWin ? 'text-teal' : 'text-crimson'
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
          <span className="text-ink/50 ml-2 min-w-20 text-right text-xs">
            {/* Added simple styling for date alignment if needed, but keeping generally close to original */}
            {new Date(record.createdAt).toLocaleString()}
          </span>
        )}
      </div>
      {turns > 0 && (
        <div className="text-ink/60 mt-1 text-xs">
          共 {turns} 回合 · 点击查看战报回放
        </div>
      )}
    </Link>
  );
}
