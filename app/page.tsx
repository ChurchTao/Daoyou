'use client';

import { useAuth } from '@/lib/auth/AuthContext';
import type { Cultivator } from '@/types/cultivator';
import Image from 'next/image';
import Link from 'next/link';
import { useEffect, useState } from 'react';

const getCombatRating = (cultivator: Cultivator): string => {
  const profile = cultivator.battleProfile;
  if (!profile) return '--';
  const { vitality, spirit, wisdom, speed } = profile.attributes;
  return Math.round((vitality + spirit + wisdom + speed) / 4).toString();
};

/**
 * 首页 / 角色详情页 —— 「我的道身」
 */
export default function HomePage() {
  const { user, isLoading: authLoading } = useAuth();
  const [userCultivator, setUserCultivator] = useState<Cultivator | null>(null);
  const [loading, setLoading] = useState(false);

  // 获取用户角色
  useEffect(() => {
    if (!user) return;

    const fetchUserCultivator = async () => {
      setLoading(true);
      try {
        const response = await fetch('/api/cultivators');
        const result = await response.json();

        if (result.success && result.data.length > 0) {
          setUserCultivator(result.data[0]); // 只显示第一个角色
        } else {
          setUserCultivator(null);
        }
      } catch (error) {
        console.error('获取角色失败:', error);
      } finally {
        setLoading(false);
      }
    };

    fetchUserCultivator();
  }, [user]);

  // 删除角色（转世重修）
  const handleDeleteCultivator = async () => {
    if (!userCultivator || !confirm('确定要删除当前道身，进行转世重修吗？')) return;

    setLoading(true);
    try {
      const response = await fetch(`/api/cultivators?id=${userCultivator.id}`, {
        method: 'DELETE',
      });

      const result = await response.json();

      if (result.success) {
        // 清除角色数据
        setUserCultivator(null);
      }
    } catch (error) {
      console.error('删除角色失败:', error);
    } finally {
      setLoading(false);
    }
  };

  if (authLoading) {
    return <div className="bg-paper min-h-screen flex items-center justify-center">加载中...</div>;
  }

  return (
    <div className="bg-paper min-h-screen">
      <div className="container mx-auto px-4 py-8 max-w-2xl">
        {/* 顶部标题与Logo */}
        <div className="text-center mb-8">
          <div className="mb-4 h-24 w-full relative">
            <Image
              src="/assets/daoyou_logo.png"
              alt="万界道录 Logo"
              width={96}
              height={96}
              className="object-contain h-24 mx-auto"
            />
          </div>
          <h1 className="font-ma-shan-zheng text-4xl md:text-5xl text-ink mb-2">
            万界道录
          </h1>
          <p className="text-ink/70 text-center mb-8">输入心念，凝练道身</p>
        </div>
        
        {/* 主按钮区域 */}
        {!userCultivator ? (
          <div className="text-center mb-10">
            <Link
              href="/create"
              className="btn-primary inline-flex items-center justify-center"
            >
              觉醒灵根
            </Link>
          </div>
        ) : (
          <div className="text-center mb-6">
            <button
              onClick={handleDeleteCultivator}
              className="btn-outline inline-flex items-center justify-center"
            >
              {loading ? '转世中...' : '转世重修'}
            </button>
          </div>
        )}

        {/* 角色详情 */}
        {loading ? (
          <div className="text-center py-8">加载中...</div>
        ) : userCultivator ? (
          <div className="max-w-md mx-auto bg-paper-light rounded-lg p-6 shadow-sm border border-ink/10">
            <h2 className="font-ma-shan-zheng text-2xl text-ink mb-4 text-center">
              我的道身
            </h2>

            {/* 角色基本信息 */}
            <div className="mb-6">
              <h3 className="font-ma-shan-zheng text-3xl text-ink mb-2 text-center">
                {userCultivator.name}
              </h3>
              <div className="grid grid-cols-2 gap-2 text-sm mb-4">
                <div className="bg-ink/5 rounded p-2">
                  <span className="text-ink/70">境界：</span>
                  <span className="text-ink font-semibold">{userCultivator.cultivationLevel}</span>
                </div>
                <div className="bg-ink/5 rounded p-2">
                  <span className="text-ink/70">灵根：</span>
                  <span className="text-ink font-semibold">{userCultivator.spiritRoot}</span>
                </div>
                <div className="bg-ink/5 rounded p-2">
                  <span className="text-ink/70">元素：</span>
                  <span className="text-ink font-semibold">{userCultivator.battleProfile?.element || '无'}</span>
                </div>
                <div className="bg-ink/5 rounded p-2">
                  <span className="text-ink/70">战力：</span>
                  <span className="text-crimson font-bold">{getCombatRating(userCultivator)}</span>
                </div>
              </div>
            </div>

            {/* 角色属性 */}
            {userCultivator.battleProfile && (
              <div className="mb-6">
                <h4 className="font-semibold text-ink mb-2">基础属性</h4>
                <div className="grid grid-cols-2 gap-2 text-sm">
                  <div className="bg-ink/5 rounded p-2">
                    <p className="font-semibold">体魄</p>
                    <p className="text-ink/80">{userCultivator.battleProfile.attributes.vitality}</p>
                  </div>
                  <div className="bg-ink/5 rounded p-2">
                    <p className="font-semibold">灵力</p>
                    <p className="text-ink/80">{userCultivator.battleProfile.attributes.spirit}</p>
                  </div>
                  <div className="bg-ink/5 rounded p-2">
                    <p className="font-semibold">悟性</p>
                    <p className="text-ink/80">{userCultivator.battleProfile.attributes.wisdom}</p>
                  </div>
                  <div className="bg-ink/5 rounded p-2">
                    <p className="font-semibold">速度</p>
                    <p className="text-ink/80">{userCultivator.battleProfile.attributes.speed}</p>
                  </div>
                </div>
              </div>
            )}

            {/* 先天气运 */}
            {userCultivator.preHeavenFates && userCultivator.preHeavenFates.length > 0 && (
              <div className="mb-6">
                <h4 className="font-semibold text-ink mb-2">先天气运</h4>
                <div className="space-y-2">
                  {userCultivator.preHeavenFates.map((fate, idx) => (
                    <div key={idx} className="bg-ink/5 rounded p-2">
                      <p className="font-semibold">
                        {fate.name} · {fate.type}
                      </p>
                      <p className="text-ink/80 text-sm">{fate.effect}</p>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* 角色描述 */}
            <div className="mb-6">
              <h4 className="font-semibold text-ink mb-2">道身描述</h4>
              <p className="text-ink/90 leading-relaxed">{userCultivator.appearance}</p>
              <p className="text-ink/80 italic leading-relaxed mt-2">
                「{userCultivator.backstory}」
              </p>
            </div>

            {/* 战斗按钮 */}
            <div className="text-center">
              <Link
                href={`/battle?opponent=${userCultivator.id}`}
                className="btn-primary inline-flex items-center justify-center"
              >
                入世对战
              </Link>
            </div>
          </div>
        ) : (
          <div className="text-center py-8 text-ink/70">
            还没有创建道身，点击上方按钮开始觉醒灵根
          </div>
        )}

        {/* 底部链接 */}
        <div className="text-center mt-8 text-sm text-ink/50">
          <Link href="/demo" className="hover:text-ink/70 transition-colors">
            开发者 Demo →
          </Link>
        </div>
      </div>
    </div>
  );
}
