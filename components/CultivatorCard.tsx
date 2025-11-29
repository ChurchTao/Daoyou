import type { Cultivator } from '@/types/cultivator';
import Link from 'next/link';

const getCombatRating = (cultivator: Cultivator): string => {
  const profile = cultivator.battleProfile;
  if (!profile) return '--';
  const { vitality, spirit, wisdom, speed } = profile.attributes;
  return Math.round((vitality + spirit + wisdom + speed) / 4).toString();
};

interface CultivatorCardProps {
  cultivator: Cultivator;
  rank?: number;
  showChallengeButton?: boolean;
  highlight?: boolean;
}

/**
 * 角色卡片组件
 * 用于排行榜和角色展示
 */
export default function CultivatorCard({
  cultivator,
  rank,
  showChallengeButton = false,
  highlight = false,
}: CultivatorCardProps) {
  return (
    <div
      className={`relative rounded-lg border-2 p-4 transition-all ${
        highlight
          ? 'border-yellow-400 bg-gradient-to-br from-yellow-500/20 to-orange-500/20 shadow-lg shadow-yellow-500/20'
          : 'border-[#e0c5a3]/30 bg-[#0d1b2a]/50 backdrop-blur-sm'
      }`}
    >
      {/* 排名标识 */}
      {rank !== undefined && (
        <div className="absolute -left-2 -top-2 flex h-8 w-8 items-center justify-center rounded-full bg-gradient-to-br from-yellow-400 to-orange-500 text-sm font-bold text-[#0d1b2a] shadow-lg">
          {rank}
        </div>
      )}

      <div className="flex items-start gap-4">
        {/* 头像区域 */}
        <div className="flex h-16 w-16 flex-shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-[#4cc9f0]/20 to-[#c1121f]/20 border-2 border-[#e0c5a3]/30">
          <span className="text-2xl font-bold text-[#e0c5a3]">
            {cultivator.name.charAt(0)}
          </span>
        </div>

        {/* 信息区域 */}
        <div className="flex-1 min-w-0">
          <div className="mb-2">
            <h3 className="text-xl font-bold text-[#e0c5a3] truncate">
              {cultivator.name}
            </h3>
            <p className="text-sm text-[#4cc9f0]">
              {cultivator.cultivationLevel}
            </p>
          </div>

          <div className="mb-2 space-y-1">
            <div className="flex items-center gap-2 text-sm">
              <span className="text-[#e0c5a3]/70">灵根：</span>
              <span className="text-[#4cc9f0]">{cultivator.spiritRoot}</span>
            </div>
            <div className="flex items-center gap-2 text-sm">
              <span className="text-[#e0c5a3]/70">战力评估：</span>
              <span className="font-bold text-[#c1121f]">
                {getCombatRating(cultivator)}
              </span>
            </div>
          </div>

          {/* 气运标签 */}
          {cultivator.preHeavenFates?.length ? (
            <div className="mb-2 flex flex-wrap gap-1">
              {cultivator.preHeavenFates.map((fate, idx) => (
                <span
                  key={idx}
                  className="rounded px-2 py-0.5 text-xs bg-[#4cc9f0]/20 text-[#4cc9f0] border border-[#4cc9f0]/30"
                >
                  {fate.name}
                </span>
              ))}
            </div>
          ) : null}

          {/* 挑战按钮 */}
          {showChallengeButton && (
            <Link
              href={`/battle?opponent=${cultivator.id}`}
              className="mt-2 inline-block rounded px-4 py-2 text-sm font-medium bg-gradient-to-r from-[#c1121f] to-[#ff6b6b] text-white hover:from-[#a00e1a] hover:to-[#e55555] transition-all shadow-md"
            >
              挑战
            </Link>
          )}
        </div>
      </div>
    </div>
  );
}
