'use client';

import Link from 'next/link';
import { AlchemyFurnaceIcon, CloudDivider, DragonPatternIcon } from '@/components/SVGIcon';
import { mockRankings } from '@/data/mockRankings';
import type { Cultivator } from '@/types/cultivator';

const getCombatRating = (cultivator: Cultivator): string => {
  const profile = cultivator.battleProfile;
  if (!profile) return '--';
  const { vitality, spirit, wisdom, speed } = profile.attributes;
  return Math.round((vitality + spirit + wisdom + speed) / 4).toString();
};

/**
 * 首页 / 排行榜页 —— 「道录·天榜」
 */
export default function HomePage() {
  return (
    <div className="bg-paper min-h-screen">
      <div className="container mx-auto px-4 py-8 max-w-2xl">
        {/* 顶部标题 */}
        <div className="text-center mb-8">
          <h1 className="font-ma-shan-zheng text-4xl md:text-5xl text-ink mb-4">
            万界道录
          </h1>
          <p className="text-ink/70 text-center mb-8">输入心念，凝练道身</p>
        </div>

        {/* 主按钮：仿丹炉 */}
        <div className="text-center mb-10">
          <Link
            href="/create"
            className="btn-primary inline-flex items-center justify-center"
          >
            <AlchemyFurnaceIcon className="w-6 h-6 mr-2" />
            觉醒灵根
          </Link>
        </div>

        {/* 排行榜：仿古籍名录 */}
        <div className="max-w-md mx-auto">
          <h2 className="font-ma-shan-zheng text-xl text-ink mb-4 flex items-center justify-center">
            <span>天榜前十</span>
            <DragonPatternIcon className="ml-2" />
          </h2>

          <div className="space-y-0">
            {mockRankings.slice(0, 10).map((cultivator) => (
              <div
                key={cultivator.id}
                className="ranking-item border-b border-ink/10 py-3 px-2 hover:bg-paper-light/50 transition-colors"
              >
                <div className="flex justify-between items-center">
                  <span className="font-ma-shan-zheng text-lg text-ink">
                    {cultivator.name}
                  </span>
                  <span className="text-sm text-ink/80 flex flex-col text-right">
                    <span>{cultivator.cultivationLevel}</span>
                    <span className="text-ink/60">
                      灵根 {cultivator.spiritRoot} · 战力 {getCombatRating(cultivator)}
                    </span>
                  </span>
                </div>
                <div className="text-xs text-ink/60 mt-1">
                  {cultivator.preHeavenFates?.map((f) => f.name).join('｜') || '——'}
                </div>
                <Link
                  href={`/battle?opponent=${cultivator.id}`}
                  className="text-xs text-crimson mt-2 inline-block hover:underline"
                >
                  挑战
                </Link>
              </div>
            ))}
          </div>
        </div>

        {/* 底部云纹 */}
        <div className="mt-8">
          <CloudDivider />
        </div>

        {/* 底部链接 */}
        <div className="text-center mt-6 text-sm text-ink/50">
          <Link href="/demo" className="hover:text-ink/70 transition-colors">
            开发者 Demo →
          </Link>
        </div>
      </div>
    </div>
  );
}
