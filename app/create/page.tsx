'use client';

import { useAuth } from '@/lib/auth/AuthContext';
import type { Cultivator } from '@/types/cultivator';
import {
  formatAttributeBonusMap,
  getAttributeLabel,
  getSkillTypeLabel,
  getStatusLabel,
} from '@/types/dictionaries';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';

const getCombatRating = (cultivator: Cultivator | null): string => {
  if (!cultivator?.attributes) return '--';
  const { vitality, spirit, wisdom, speed, willpower } = cultivator.attributes;
  return Math.round(
    (vitality + spirit + wisdom + speed + willpower) / 5,
  ).toString();
};

const BASE_ATTRIBUTE_KEYS: Array<keyof Cultivator['attributes']> = [
  'vitality',
  'spirit',
  'wisdom',
  'speed',
  'willpower',
];

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
  const [availableFates, setAvailableFates] = useState<
    Cultivator['pre_heaven_fates']
  >([]);
  const [selectedFateIndices, setSelectedFateIndices] = useState<number[]>([]);
  const [balanceNotes, setBalanceNotes] = useState<string[]>([]);
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
    setAvailableFates([]);
    setSelectedFateIndices([]);
    setBalanceNotes([]);

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
      setAvailableFates(aiResult.data.preHeavenFates || []);
      setSelectedFateIndices([]);
      setBalanceNotes(aiResult.data.balanceNotes || []);
    } catch (error) {
      console.error('生成角色失败:', error);
      const errorMessage =
        error instanceof Error ? error.message : '生成角色失败，请检查控制台';
      setError(errorMessage);
    } finally {
      setLoading(false);
    }
  };

  // 切换气运选择
  const toggleFateSelection = (index: number) => {
    setSelectedFateIndices((prev) => {
      if (prev.includes(index)) {
        return prev.filter((i) => i !== index);
      } else if (prev.length < 3) {
        return [...prev, index];
      }
      return prev;
    });
  };

  // 保存角色到正式表
  const handleSaveCharacter = async () => {
    if (!player || !tempCultivatorId) {
      return;
    }

    if (selectedFateIndices.length !== 3) {
      setError('请选择3个先天气运');
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
        body: JSON.stringify({
          tempCultivatorId,
          selectedFateIndices,
        }),
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
    setAvailableFates([]);
    setSelectedFateIndices([]);
    setBalanceNotes([]);
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
                        {player.realm}
                        {player.realm_stage}
                      </span>
                    </div>
                    <div>
                      <span className="text-ink/70">灵根：</span>
                      <span className="text-ink font-semibold ml-1">
                        {player.spiritual_roots[0]?.element || '无'}
                        {player.spiritual_roots[0]?.grade && (
                          <span className="text-crimson ml-1">
                            ·{player.spiritual_roots[0].grade}
                          </span>
                        )}
                        （强度：{player.spiritual_roots[0]?.strength || 0}）
                      </span>
                    </div>
                    <div>
                      <span className="text-ink/70">年龄/寿命：</span>
                      <span className="text-ink font-semibold ml-1">
                        {player.age}/{player.lifespan}
                      </span>
                    </div>
                    <div>
                      <span className="text-ink/70">最大气血：</span>
                      <span className="text-ink font-semibold ml-1">
                        {80 + player.attributes.vitality}
                      </span>
                    </div>
                  </div>

                  {/* 基础属性 */}
                  <div className="mb-4">
                    <span className="text-ink/70">基础属性：</span>
                    <div className="mt-2 grid grid-cols-2 gap-2 text-sm">
                      {BASE_ATTRIBUTE_KEYS.map((key) => (
                        <div
                          key={key}
                          className="bg-ink/5 rounded p-2 border border-ink/10"
                        >
                          <p className="font-semibold">
                            {getAttributeLabel(key)}
                          </p>
                          <p className="text-ink/80">
                            {player.attributes[key]}
                          </p>
                        </div>
                      ))}
                    </div>
                  </div>

                  {/* 天道平衡提示 */}
                  {balanceNotes.length > 0 && (
                    <div className="mb-4">
                      <span className="text-ink/70">天道评语：</span>
                      <ul className="mt-2 space-y-1 text-sm bg-ink/5 rounded p-3 border border-ink/10">
                        {balanceNotes.map((note) => (
                          <li key={note} className="text-ink/80">
                            · {note}
                          </li>
                        ))}
                      </ul>
                    </div>
                  )}

                  {/* 先天气运选择 */}
                  {availableFates.length > 0 && (
                    <div className="mb-4">
                      <span className="text-ink/70">
                        先天气运选择（已选择 {selectedFateIndices.length}/3）：
                      </span>
                      <div className="mt-2 space-y-2 text-sm">
                        {availableFates.map((fate, idx) => {
                          const isSelected = selectedFateIndices.includes(idx);
                          const qualityColors: Record<string, string> = {
                            凡品: 'text-gray-500',
                            灵品: 'text-blue-500',
                            玄品: 'text-purple-500',
                            真品: 'text-crimson',
                          };
                          return (
                            <div
                              key={idx}
                              onClick={() => toggleFateSelection(idx)}
                              className={`bg-ink/5 rounded p-2 border-2 cursor-pointer transition-all ${
                                isSelected
                                  ? 'border-crimson bg-crimson/10'
                                  : 'border-ink/10 hover:border-ink/30'
                              }`}
                            >
                              <div className="flex items-center justify-between">
                                <p className="font-semibold">
                                  {fate.name} · {fate.type}
                                  {fate.quality && (
                                    <span
                                      className={`ml-2 ${qualityColors[fate.quality] || 'text-ink/70'}`}
                                    >
                                      [{fate.quality}]
                                    </span>
                                  )}
                                </p>
                                {isSelected && (
                                  <span className="text-crimson">✓</span>
                                )}
                              </div>
                              <p className="text-ink/80">
                                {formatAttributeBonusMap(fate.attribute_mod) ||
                                  '无属性加成'}
                              </p>
                              {fate.description && (
                                <p className="text-ink/60 text-xs italic mt-1">
                                  {fate.description}
                                </p>
                              )}
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  )}

                  {/* 技能 */}
                  {player.skills && player.skills.length > 0 ? (
                    <div className="mb-4">
                      <span className="text-ink/70">技能：</span>
                      <div className="mt-2 space-y-1 text-sm">
                        {player.skills.map((skill, idx) => (
                          <div
                            key={skill.id || skill.name + idx}
                            className="bg-ink/5 rounded p-2 border border-ink/10"
                          >
                            <p className="font-semibold">
                              {skill.name} · {getSkillTypeLabel(skill.type)} ·{' '}
                              {skill.element}
                              {skill.grade && (
                                <span className="text-crimson ml-1">
                                  ·{skill.grade}
                                </span>
                              )}
                            </p>
                            <p className="text-ink/80">
                              威力：{skill.power} | 冷却：{skill.cooldown}回合
                              {skill.effect &&
                                ` | 效果：${getStatusLabel(skill.effect)}${
                                  skill.duration
                                    ? `（${skill.duration}回合）`
                                    : ''
                                }`}
                              {skill.cost !== undefined &&
                                skill.cost > 0 &&
                                ` | 消耗：${skill.cost} 灵力`}
                            </p>
                          </div>
                        ))}
                      </div>
                    </div>
                  ) : null}

                  {/* 功法 */}
                  {player.cultivations && player.cultivations.length > 0 ? (
                    <div className="mb-4">
                      <span className="text-ink/70">功法：</span>
                      <div className="mt-2 space-y-1 text-sm">
                        {player.cultivations.map((cult, idx) => (
                          <div
                            key={cult.name + idx}
                            className="bg-ink/5 rounded p-2 border border-ink/10"
                          >
                            <p className="font-semibold">
                              {cult.name}
                              {cult.grade && (
                                <span className="text-crimson ml-1">
                                  ·{cult.grade}
                                </span>
                              )}
                            </p>
                            <p className="text-ink/80">
                              {formatAttributeBonusMap(cult.bonus) ||
                                '无属性加成'}
                            </p>
                            <p className="text-ink/60 text-xs">
                              要求境界：{cult.required_realm}
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

                  {player.background && (
                    <p className="text-ink/80 italic leading-relaxed mb-3">
                      「{player.background}」
                    </p>
                  )}
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
          <Link href="/" className="text-ink hover:underline">
            [← 返回主界]
          </Link>
        </div>
      </div>
    </div>
  );
}
