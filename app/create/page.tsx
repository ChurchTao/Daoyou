'use client';

import { useAuth } from '@/lib/auth/AuthContext';
import type { Cultivator } from '@/types/cultivator';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';

const getCombatRating = (cultivator: Cultivator | null): string => {
  if (!cultivator?.battleProfile) return '--';
  const { vitality, spirit, wisdom, speed } =
    cultivator.battleProfile.attributes;
  return Math.round((vitality + spirit + wisdom + speed) / 4).toString();
};

/**
 * 角色创建页 —— 「凝气篇」
 */
export default function CreatePage() {
  const router = useRouter();
  const { user } = useAuth();
  const [userPrompt, setUserPrompt] = useState('');
  const [loading, setLoading] = useState(false);
  const [player, setPlayer] = useState<Cultivator | null>(null);
  const [tempCultivatorId, setTempCultivatorId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [hasExistingCultivator, setHasExistingCultivator] = useState(false);
  const [checkingExisting, setCheckingExisting] = useState(true);

  // 检查用户是否已有角色
  useEffect(() => {
    if (!user) {
      setCheckingExisting(false);
      return;
    }

    const checkExistingCultivator = async () => {
      try {
        const response = await fetch('/api/cultivators');
        const result = await response.json();

        if (result.success && result.data.length > 0) {
          setHasExistingCultivator(true);
        }
      } catch (error) {
        console.error('检查角色失败:', error);
      } finally {
        setCheckingExisting(false);
      }
    };

    checkExistingCultivator();
  }, [user]);

  // 生成角色
  const handleGenerateCharacter = async () => {
    if (!userPrompt.trim()) {
      setError('请输入角色描述');
      return;
    }

    setLoading(true);
    setError(null);
    setPlayer(null);

    try {
      // 调用AI生成角色
      const aiResponse = await fetch('/api/generate-character', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ userInput: userPrompt }),
      });

      const aiResult = await aiResponse.json();

      if (!aiResponse.ok || !aiResult.success) {
        throw new Error(aiResult.error || '生成角色失败');
      }

      // 保存临时角色ID和角色数据
      setPlayer(aiResult.data.cultivator);
      setTempCultivatorId(aiResult.data.tempCultivatorId);
    } catch (error) {
      console.error('生成角色失败:', error);
      const errorMessage =
        error instanceof Error ? error.message : '生成角色失败，请检查控制台';
      setError(errorMessage);
    } finally {
      setLoading(false);
    }
  };

  // 保存角色到正式表
  const handleSaveCharacter = async () => {
    if (!player || !tempCultivatorId) {
      return;
    }

    setLoading(true);
    setError(null);

    try {
      // 调用保存角色API
      const saveResponse = await fetch('/api/save-character', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ tempCultivatorId }),
      });

      const saveResult = await saveResponse.json();

      if (!saveResponse.ok || !saveResult.success) {
        throw new Error(saveResult.error || '保存角色失败');
      }

      // 保存成功，跳转到首页
      router.push('/');
    } catch (error) {
      console.error('保存角色失败:', error);
      const errorMessage =
        error instanceof Error ? error.message : '保存角色失败，请检查控制台';
      setError(errorMessage);
    } finally {
      setLoading(false);
    }
  };

  // 立即挑战
  const handleChallenge = () => {
    if (player) {
      sessionStorage.setItem('player', JSON.stringify(player));
      router.push('/battle');
    }
  };

  // 重新生成
  const handleRegenerate = () => {
    setPlayer(null);
    setError(null);
  };

  return (
    <div className="bg-paper min-h-screen p-6">
      <div className="container mx-auto max-w-2xl">
        {/* 标题 */}
        <div className="text-center mb-8">
          <h1 className="font-ma-shan-zheng text-3xl md:text-4xl text-ink mb-2">
            凝气篇
          </h1>
          <p className="text-ink/70 text-sm">以心念唤道，凝气成形</p>
        </div>

        {/* 检查用户是否已有角色 */}
        {checkingExisting ? (
          <div className="text-center py-12">
            <div className="animate-spin inline-block w-8 h-8 border-4 border-ink/30 border-t-4 border-t-crimson rounded-full mb-4"></div>
            <p className="text-ink/70">检查道身状态...</p>
          </div>
        ) : hasExistingCultivator ? (
          <div className="text-center py-12">
            <div className="mb-4 text-4xl">🔄</div>
            <h2 className="font-ma-shan-zheng text-2xl text-ink mb-2">
              您已拥有道身
            </h2>
            <p className="text-ink/70 mb-6">
              每位修士只能拥有一位道身，若要重新凝练，请先进行转世重修
            </p>
            <Link
              href="/"
              className="btn-primary inline-flex items-center justify-center"
            >
              返回道身
            </Link>
          </div>
        ) : (
          <>
            {/* 输入区：仿砚台 */}
            <div className="mb-8">
              <label className="font-ma-shan-zheng text-ink mb-2 text-lg">
                以心念唤道：
              </label>
              <textarea
                value={userPrompt}
                onChange={(e) => setUserPrompt(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) {
                    handleGenerateCharacter();
                  }
                }}
                placeholder="例：我想成为一位靠炼丹逆袭的废柴少主..."
                className="w-full h-32 p-4 bg-paper-light border border-ink/20 rounded-lg focus:ring-1 focus:ring-crimson focus:outline-none text-ink placeholder-ink/40 resize-none"
                disabled={loading}
              />
              <p className="mt-2 text-xs text-ink/50">
                💡 提示：按 Cmd/Ctrl + Enter 快速提交
              </p>
            </div>

            {/* 生成按钮 */}
            <div className="text-center mb-10">
              <button
                onClick={handleGenerateCharacter}
                disabled={loading || !userPrompt.trim()}
                className="btn-primary"
              >
                {loading ? (
                  <span className="flex items-center">
                    <span className="animate-spin mr-2">🌀</span>
                    灵气汇聚中...
                  </span>
                ) : (
                  <span>凝气成形</span>
                )}
              </button>
            </div>

            {/* 错误提示 */}
            {error && (
              <div className="mb-6 p-4 rounded-lg bg-crimson/10 border-2 border-crimson/30 text-crimson">
                {error}
              </div>
            )}

            {/* 角色卡：仿卷轴 */}
            {player && (
              <div className="character-scroll animate-fade-in max-w-lg mx-auto">
                <div className="scroll-content">
                  <h3 className="font-ma-shan-zheng text-2xl text-ink mb-4 text-center">
                    {player.name}
                  </h3>

                  <div className="grid grid-cols-2 gap-2 text-sm mb-4">
                    <div>
                      <span className="text-ink/70">境界：</span>
                      <span className="text-ink font-semibold ml-1">
                        {player.cultivationLevel}
                      </span>
                    </div>
                    <div>
                      <span className="text-ink/70">灵根：</span>
                      <span className="text-ink font-semibold ml-1">
                        {player.spiritRoot}
                      </span>
                    </div>
                    <div>
                      <span className="text-ink/70">元素：</span>
                      <span className="text-ink font-semibold ml-1">
                        {player.battleProfile?.element || '无'}
                      </span>
                    </div>
                    <div>
                      <span className="text-ink/70">生命：</span>
                      <span className="text-ink font-semibold ml-1">
                        {player.battleProfile?.maxHp || 0}
                      </span>
                    </div>
                  </div>

                  {/* 基础属性 */}
                  {player.battleProfile && (
                    <div className="mb-4">
                      <span className="text-ink/70">基础属性：</span>
                      <div className="mt-2 grid grid-cols-2 gap-2 text-sm">
                        <div className="bg-ink/5 rounded p-2 border border-ink/10">
                          <p className="font-semibold">体魄</p>
                          <p className="text-ink/80">
                            {player.battleProfile.attributes.vitality}
                          </p>
                        </div>
                        <div className="bg-ink/5 rounded p-2 border border-ink/10">
                          <p className="font-semibold">灵力</p>
                          <p className="text-ink/80">
                            {player.battleProfile.attributes.spirit}
                          </p>
                        </div>
                        <div className="bg-ink/5 rounded p-2 border border-ink/10">
                          <p className="font-semibold">悟性</p>
                          <p className="text-ink/80">
                            {player.battleProfile.attributes.wisdom}
                          </p>
                        </div>
                        <div className="bg-ink/5 rounded p-2 border border-ink/10">
                          <p className="font-semibold">速度</p>
                          <p className="text-ink/80">
                            {player.battleProfile.attributes.speed}
                          </p>
                        </div>
                      </div>
                    </div>
                  )}

                  {/* 先天气运 */}
                  {player.preHeavenFates?.length ? (
                    <div className="mb-4">
                      <span className="text-ink/70">先天气运：</span>
                      <div className="mt-2 space-y-1 text-sm">
                        {player.preHeavenFates.map((fate, idx) => (
                          <div
                            key={fate.name + idx}
                            className="bg-ink/5 rounded p-2 border border-ink/10"
                          >
                            <p className="font-semibold">
                              {fate.name} · {fate.type}
                            </p>
                            <p className="text-ink/80">{fate.effect}</p>
                            <p className="text-ink/60 text-xs italic">
                              {fate.description}
                            </p>
                          </div>
                        ))}
                      </div>
                    </div>
                  ) : null}

                  {/* 技能 */}
                  {player.battleProfile?.skills &&
                  player.battleProfile.skills.length > 0 ? (
                    <div className="mb-4">
                      <span className="text-ink/70">技能：</span>
                      <div className="mt-2 space-y-1 text-sm">
                        {player.battleProfile.skills.map((skill, idx) => (
                          <div
                            key={skill.name + idx}
                            className="bg-ink/5 rounded p-2 border border-ink/10"
                          >
                            <p className="font-semibold">
                              {skill.name} · {skill.type} · {skill.element}
                            </p>
                            <p className="text-ink/80">
                              威力：{skill.power} | 效果：
                              {skill.effects?.join(', ') || '无'}
                            </p>
                          </div>
                        ))}
                      </div>
                    </div>
                  ) : null}

                  {/* 装备 */}
                  {player.battleProfile?.equipment &&
                  player.battleProfile.equipment.length > 0 ? (
                    <div className="mb-4">
                      <span className="text-ink/70">装备：</span>
                      <div className="mt-2 space-y-1 text-sm">
                        {player.battleProfile.equipment.map((eq, idx) => (
                          <div
                            key={eq.name + idx}
                            className="bg-ink/5 rounded p-2 border border-ink/10"
                          >
                            <p className="font-semibold">{eq.name}</p>
                            <p className="text-ink/80">
                              {eq.bonus &&
                                Object.entries(eq.bonus)
                                  .map(([key, value]) => {
                                    if (key === 'elementBoost') {
                                      return `${Object.entries(
                                        value as Record<string, number>,
                                      )
                                        .map(
                                          ([elem, boost]) =>
                                            `${elem}系技能威力+${(
                                              boost * 100
                                            ).toFixed(0)}%`,
                                        )
                                        .join(', ')}`;
                                    }
                                    return `${key} +${value}`;
                                  })
                                  .join(', ')}
                            </p>
                          </div>
                        ))}
                      </div>
                    </div>
                  ) : null}

                  <div className="mb-3">
                    <span className="text-ink/70">战力评估：</span>
                    <span className="text-crimson font-bold text-lg ml-1">
                      {getCombatRating(player)}
                    </span>
                  </div>

                  <p className="text-ink/90 mb-3 leading-relaxed">
                    {player.appearance}
                  </p>
                  <p className="text-ink/80 italic leading-relaxed">
                    「{player.backstory}」
                  </p>
                </div>
              </div>
            )}

            {/* 底部操作 */}
            {player && (
              <div className="flex justify-center gap-4 mt-6">
                <button onClick={handleRegenerate} className="btn-outline">
                  重凝
                </button>
                <button onClick={handleSaveCharacter} className="btn-primary">
                  保存道身
                </button>
                <button onClick={handleChallenge} className="btn-outline">
                  入世对战
                </button>
              </div>
            )}
          </>
        )}

        {/* 返回首页 */}
        <div className="text-center mt-8">
          <Link
            href="/"
            className="text-ink hover:underline"
          >
            [← 返回主界]
          </Link>
        </div>
      </div>
    </div>
  );
}
