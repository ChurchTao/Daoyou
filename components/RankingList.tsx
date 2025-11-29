import type { Cultivator } from '@/types/cultivator';
import CultivatorCard from './CultivatorCard';

interface RankingListProps {
  rankings: Cultivator[];
  showChallengeButton?: boolean;
}

/**
 * 排行榜组件
 */
export default function RankingList({
  rankings,
  showChallengeButton = true,
}: RankingListProps) {
  if (rankings.length === 0) {
    return (
      <div className="text-center py-8 text-[#e0c5a3]/70">
        <p>暂无排行榜数据</p>
      </div>
    );
  }

  const champion = rankings[0];
  const topList = rankings.slice(1, 6); // Top 2-6

  return (
    <div className="space-y-6">
      {/* 榜首 */}
      {champion && (
        <div className="mb-6">
          <div className="mb-3 flex items-center gap-2">
            <span className="text-2xl">🏆</span>
            <h2 className="text-xl font-bold text-[#e0c5a3]">当前榜首</h2>
          </div>
          <CultivatorCard
            cultivator={champion}
            rank={1}
            showChallengeButton={showChallengeButton}
            highlight={true}
          />
        </div>
      )}

      {/* Top 5 */}
      {topList.length > 0 && (
        <div>
          <h2 className="mb-3 text-lg font-semibold text-[#e0c5a3]">
            排行榜 Top 5
          </h2>
          <div className="space-y-3">
            {topList.map((cultivator, idx) => (
              <CultivatorCard
                key={cultivator.id}
                cultivator={cultivator}
                rank={idx + 2}
                showChallengeButton={showChallengeButton}
              />
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
