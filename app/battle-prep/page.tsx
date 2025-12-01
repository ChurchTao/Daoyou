'use client';

import { useAuth } from '@/lib/auth/AuthContext';
import type { Cultivator } from '@/types/cultivator';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useEffect, useState, Suspense } from 'react';

/**
 * 敌人数据类型（简化版）
 */
type EnemyData = {
  id: string;
  name: string;
  cultivationLevel: string;
  spiritRoot: string;
  appearance: string;
  element: string;
  combatRating: number;
  faction: string;
};

/**
 * 战斗前准备页面内容组件
 */
function BattlePrepContent() {
  const { user, isLoading: authLoading } = useAuth();
  const router = useRouter();
  
  const [player, setPlayer] = useState<Cultivator | null>(null);
  const [opponents, setOpponents] = useState<EnemyData[]>([]);
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState<string>('');
  
  // 获取用户角色和排行榜数据
  useEffect(() => {
    if (!user) return;
    
    const fetchData = async () => {
      setLoading(true);
      try {
        // 获取玩家角色
        const playerResponse = await fetch('/api/cultivators');
        const playerResult = await playerResponse.json();
        
        if (playerResult.success && playerResult.data.length > 0) {
          setPlayer(playerResult.data[0]);
        }
        
        // 获取排行榜数据
        const rankingsResponse = await fetch('/api/rankings');
        const rankingsResult = await rankingsResponse.json();
        
        if (rankingsResult.success) {
          setOpponents(rankingsResult.data);
        }
      } catch (error) {
        console.error('获取数据失败:', error);
        setMessage('获取数据失败，请稍后重试');
      } finally {
        setLoading(false);
      }
    };
    
    fetchData();
  }, [user]);
  
  // 开始战斗
  const handleStartBattle = (opponentId: string) => {
    if (!player) return;
    
    // 跳转到战斗页面，传递对手ID
    router.push(`/battle?opponent=${opponentId}`);
  };
  
  if (authLoading || loading) {
    return <div className="bg-paper min-h-screen flex items-center justify-center">加载中...</div>;
  }
  
  if (!player) {
    return (
      <div className="bg-paper min-h-screen flex items-center justify-center">
        <div className="text-center">
          <p className="mb-4 text-ink">未找到角色信息</p>
          <Link href="/create" className="btn-primary">
            创建角色
          </Link>
        </div>
      </div>
    );
  }
  
  return (
    <div className="bg-paper min-h-screen">
      <div className="container mx-auto px-4 py-8 max-w-2xl main-content">
        {/* 顶部返回按钮 */}
        <div className="mb-6">
          <Link href="/" className="text-ink hover:underline">[← 返回主界]</Link>
        </div>
        
        {/* 标题 */}
        <div className="text-center mb-6">
          <h1 className="font-ma-shan-zheng text-2xl md:text-3xl text-ink mb-2">
            天骄榜 · {player.cultivationLevel}
          </h1>
          <p className="text-ink/70">挑战天骄，证道天下</p>
        </div>
        
        {/* 排行榜列表 */}
        <div className="mb-8">
          <div className="bg-paper-light rounded-lg p-4 shadow-sm border border-ink/10">
            {opponents.length > 0 ? (
              <div className="space-y-3">
                {opponents.map((opponent, index) => (
                  <div 
                    key={opponent.id} 
                    className={`ranking-item ${player.name === opponent.name ? 'ranking-item-current' : ''}`}
                  >
                    <div className="flex items-center gap-3">
                      <div className="font-semibold w-8">{index + 1}.</div>
                      <div>
                        <div className="font-semibold">
                          {opponent.name}（{opponent.faction}）
                          {player.name === opponent.name && <span className="equipped-mark">← 你</span>}
                        </div>
                        <div className="text-sm text-ink-secondary">
                          {opponent.cultivationLevel} · {opponent.spiritRoot}
                        </div>
                      </div>
                    </div>
                    <div className="flex items-center gap-3">
                      <div className="text-sm">
                        <span className="status-icon">❤️</span>{opponent.combatRating}
                      </div>
                      {player.name !== opponent.name && (
                        <button 
                          onClick={() => handleStartBattle(opponent.id)} 
                          className="btn-primary btn-sm"
                        >
                          [挑战]
                        </button>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="empty-state">暂无对手</div>
            )}
          </div>
        </div>
        
        {/* 底部操作按钮 */}
        <div className="flex justify-center gap-4">
          <button 
            onClick={() => window.location.reload()} 
            className="btn-outline"
          >
            刷新榜单
          </button>
          <Link href="/" className="btn-primary">
            返回主界
          </Link>
        </div>
      </div>
    </div>
  );
}

/**
 * 战斗前准备页面
 * 显示天骄榜，允许用户选择对手进行挑战
 */
export default function BattlePrepPage() {
  return (
    <Suspense fallback={<div className="bg-paper min-h-screen flex items-center justify-center">加载中...</div>}>
      <BattlePrepContent />
    </Suspense>
  );
}