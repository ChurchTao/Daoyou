'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import type { Cultivator } from '@/types/cultivator';
import { createCultivatorFromAI } from '@/utils/cultivatorUtils';
import { AlchemyFurnaceIcon } from '@/components/SVGIcon';

/**
 * 角色创建页 —— 「凝气篇」
 */
export default function CreatePage() {
  const router = useRouter();
  const [userPrompt, setUserPrompt] = useState('');
  const [loading, setLoading] = useState(false);
  const [player, setPlayer] = useState<Cultivator | null>(null);
  const [error, setError] = useState<string | null>(null);

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
      const response = await fetch('/api/generate-character', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ userInput: userPrompt }),
      });

      const result = await response.json();

      if (!response.ok || !result.success) {
        throw new Error(result.error || '生成角色失败');
      }

      const aiResponse = result.data;
      const cultivator = createCultivatorFromAI(aiResponse, userPrompt);
      setPlayer(cultivator);
    } catch (error) {
      console.error('生成角色失败:', error);
      const errorMessage = error instanceof Error ? error.message : '生成角色失败，请检查控制台';
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

        {/* 输入区：仿砚台 */}
        <div className="mb-8">
          <label className="block font-ma-shan-zheng text-ink mb-2 text-lg">
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
              <span className="flex items-center">
                <AlchemyFurnaceIcon className="w-5 h-5 mr-1" />
                凝气成形
              </span>
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
                  <span className="text-ink font-semibold ml-1">{player.cultivationLevel}</span>
                </div>
                <div>
                  <span className="text-ink/70">灵根：</span>
                  <span className="text-ink font-semibold ml-1">{player.spiritRoot}</span>
                </div>
              </div>

              <div className="mb-3">
                <span className="text-ink/70">天赋：</span>
                <span className="text-teal-700 font-semibold ml-1">
                  {player.talents.join('｜')}
                </span>
              </div>

              <div className="mb-3">
                <span className="text-ink/70">战力：</span>
                <span className="text-crimson font-bold text-lg ml-1">
                  {player.totalPower}
                </span>
              </div>

              <p className="text-ink/90 mb-3 leading-relaxed">{player.appearance}</p>
              <p className="text-ink/80 italic leading-relaxed">「{player.backstory}」</p>
            </div>
          </div>
        )}

        {/* 底部操作 */}
        {player && (
          <div className="flex justify-center gap-4 mt-6">
            <button onClick={handleRegenerate} className="btn-outline">
              重凝
            </button>
            <button onClick={handleChallenge} className="btn-primary">
              入世对战
            </button>
          </div>
        )}

        {/* 返回首页 */}
        <div className="text-center mt-8">
          <Link
            href="/"
            className="text-sm text-ink/50 hover:text-ink/70 transition-colors"
          >
            ← 返回首页
          </Link>
        </div>
      </div>
    </div>
  );
}
