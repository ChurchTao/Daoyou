import Link from '@app/components/router/AppLink';
import type { BattleRecordUnitSummary } from '@shared/types/battle';

export type ZhanjiRecord = {
  id: string;
  createdAt: string | null;
  battleType?: 'challenge' | 'challenged' | 'normal' | string;
  challengeType?: 'challenge' | 'challenged' | 'normal' | string;
  opponentCultivatorId?: string | null;
  winner: BattleRecordUnitSummary;
  loser: BattleRecordUnitSummary;
  turns: number;
};

interface ZhanjiProps {
  record: ZhanjiRecord;
  currentCultivatorId?: string;
}

function formatBattleTime(createdAt: string | null) {
  if (!createdAt) return '--';

  const timestamp = new Date(createdAt).getTime();
  if (!Number.isFinite(timestamp)) return '--';

  const diffSeconds = Math.max(0, Math.floor((Date.now() - timestamp) / 1000));
  if (diffSeconds < 60) return '刚刚';

  const diffMinutes = Math.floor(diffSeconds / 60);
  if (diffMinutes < 60) return `${diffMinutes}分前`;

  const diffHours = Math.floor(diffMinutes / 60);
  if (diffHours < 24) return `${diffHours}小时前`;

  const diffDays = Math.floor(diffHours / 24);
  return `${diffDays}天前`;
}

export default function Zhanji({ record, currentCultivatorId }: ZhanjiProps) {
  const winnerName = record.winner?.name ?? '未知';
  const loserName = record.loser?.name ?? '未知';
  const isWin = currentCultivatorId === record.winner?.id;
  const isLoss = currentCultivatorId === record.loser?.id;
  const turns = record.turns ?? 0;
  const outcomeLabel = isWin ? '【胜】' : isLoss ? '【败】' : '【战】';
  const outcomeColor = isWin
    ? 'text-teal'
    : isLoss
      ? 'text-crimson'
      : 'text-ink-secondary';
  const opponentName =
    currentCultivatorId && (isWin || isLoss)
      ? isWin
        ? loserName
        : winnerName
      : `${winnerName} vs ${loserName}`;
  const battleTime = formatBattleTime(record.createdAt);

  return (
    <Link
      href={`/game/battle/${record.id}`}
      className="border-ink/10 text-ink hover:border-crimson/40 block border bg-white/70 px-3 py-2 transition hover:bg-white/85"
    >
      <div className="flex items-center gap-2 text-sm leading-6 whitespace-nowrap">
        <span className={`${outcomeColor} shrink-0 font-semibold`}>
          {outcomeLabel}
        </span>
        <span className="min-w-0 flex-1 truncate">{opponentName}</span>
        <span className="text-ink-secondary shrink-0">{turns}回</span>
        <span className="text-ink-secondary shrink-0 text-xs">
          {battleTime}
        </span>
      </div>
    </Link>
  );
}
