'use client';

import { useState } from 'react';
import type { Cultivator } from '../../types/cultivator';
import { getDefaultBoss } from '../../utils/prompts';
// AI 调用已移至 API 路由
import { createCultivatorFromAI } from '../../utils/cultivatorUtils';
import { simulateBattle, BattleEngineResult } from '../../engine/battleEngine';

const getCombatRating = (cultivator: Cultivator | null): string => {
  if (!cultivator?.battleProfile) return '--';
  const { vitality, spirit, wisdom, speed } = cultivator.battleProfile.attributes;
  return Math.round((vitality + spirit + wisdom + speed) / 4).toString();
};

/**
 * 第二阶段最小可运行 Demo
 * 演示：
 * 1. 角色数据模型
 * 2. 战力计算机制
 * 3. 战斗播报 Prompt 设计
 */
export default function DemoPage() {
  const [userPrompt, setUserPrompt] = useState('');
  const [loading, setLoading] = useState(false);
  const [player, setPlayer] = useState<Cultivator | null>(null);
  const [battleResult, setBattleResult] = useState<BattleEngineResult | null>(null);
  const [streamingReport, setStreamingReport] = useState<string>(''); // 流式生成的内容
  const [isStreaming, setIsStreaming] = useState(false); // 是否正在流式生成
  const [finalReport, setFinalReport] = useState<string>(''); // 最终战报内容

  // 生成角色
  const handleGenerateCharacter = async () => {
    if (!userPrompt.trim()) {
      alert('请输入角色描述');
      return;
    }

    setLoading(true);
    try {
      // 调用 API 生成角色
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
      console.log('AI 响应:', aiResponse);

      // 创建 Cultivator 对象
      const cultivator = createCultivatorFromAI(aiResponse, userPrompt);
      console.log('生成的角色:', cultivator);

      setPlayer(cultivator);
      setBattleResult(null);
    } catch (error) {
      console.error('生成角色失败:', error);
      const errorMessage = error instanceof Error ? error.message : '生成角色失败，请检查控制台';
      alert(errorMessage);
    } finally {
      setLoading(false);
    }
  };

  // 挑战 Boss
  const handleBattle = async () => {
    if (!player) {
      alert('请先生成角色');
      return;
    }

    setLoading(true);
    setIsStreaming(true);
    setStreamingReport('');
    setFinalReport('');
    setBattleResult(null);

    try {
      // 1. 获取 Boss
      const boss = getDefaultBoss();

      // 2. 执行战斗
      const result = simulateBattle(player, boss);
      console.log('战斗结果:', result);

      // 先显示战斗结果（不含播报）
      setBattleResult(result);

      // 3. 流式生成战斗播报
      const response = await fetch('/api/generate-battle-report', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          player,
          opponent: boss,
          battleSummary: {
            winnerId: result.winner.id,
            log: result.log,
            turns: result.turns,
            playerHp: result.playerHp,
            opponentHp: result.opponentHp,
            triggeredMiracle: result.triggeredMiracle,
          },
        }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || '生成战斗播报失败');
      }

      // 读取 SSE 流
      const reader = response.body?.getReader();
      const decoder = new TextDecoder();
      let buffer = '';

      if (!reader) {
        throw new Error('无法读取响应流');
      }

      let fullReport = '';

      while (true) {
        const { done, value } = await reader.read();
        
        if (done) {
          break;
        }

        // 解码数据
        buffer += decoder.decode(value, { stream: true });
        
        // 处理完整的 SSE 消息
        const lines = buffer.split('\n');
        buffer = lines.pop() || ''; // 保留不完整的行

        for (const line of lines) {
          if (line.startsWith('data: ')) {
            try {
              const data = JSON.parse(line.slice(6));
              
              if (data.type === 'chunk') {
                // 接收到内容块，实时更新 UI
                fullReport += data.content;
                setStreamingReport(fullReport);
              } else if (data.type === 'done') {
                // 生成完成
                setIsStreaming(false);
                setStreamingReport('');
                setFinalReport(fullReport);
              } else if (data.type === 'error') {
                // 发生错误
                throw new Error(data.error || '生成战斗播报失败');
              }
            } catch (e) {
              console.error('解析 SSE 数据失败:', e);
            }
          }
        }
      }
    } catch (error) {
      console.error('战斗失败:', error);
        setIsStreaming(false);
        setStreamingReport('');
        setFinalReport('');
      const errorMessage = error instanceof Error ? error.message : '战斗失败，请检查控制台';
      alert(errorMessage);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-linear-to-br from-purple-900 via-blue-900 to-indigo-900 p-8">
      <div className="max-w-4xl mx-auto">
        <h1 className="text-4xl font-bold text-white mb-2 text-center">
          万界道友 - 第二阶段 Demo
        </h1>
        <p className="text-blue-200 text-center mb-8">
          测试角色生成、战力计算和战斗播报功能
        </p>

        {/* 角色生成区域 */}
        <div className="bg-white/10 backdrop-blur-lg rounded-lg p-6 mb-6">
          <h2 className="text-2xl font-semibold text-white mb-4">1. 生成角色</h2>
          <div className="space-y-4">
            <textarea
              value={userPrompt}
              onChange={(e) => setUserPrompt(e.target.value)}
              placeholder="输入角色描述，例如：我想成为一位冷傲剑修，出身寒门，但悟性逆天"
              className="w-full p-3 rounded-lg bg-white/20 text-white placeholder-white/60 border border-white/30 focus:outline-none focus:ring-2 focus:ring-blue-400"
              rows={3}
            />
            <button
              onClick={handleGenerateCharacter}
              disabled={loading}
              className="px-6 py-3 bg-blue-600 hover:bg-blue-700 text-white rounded-lg font-medium disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
            >
              {loading ? '生成中...' : '生成角色'}
            </button>
          </div>
        </div>

        {/* 角色展示区域 */}
        {player && (
          <div className="bg-white/10 backdrop-blur-lg rounded-lg p-6 mb-6">
            <h2 className="text-2xl font-semibold text-white mb-4">角色信息</h2>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-white">
              <div>
                <p className="text-blue-200">姓名</p>
                <p className="text-xl font-bold">{player.name}</p>
              </div>
              <div>
                <p className="text-blue-200">境界</p>
                <p className="text-xl font-bold">{player.cultivationLevel}</p>
              </div>
              <div>
                <p className="text-blue-200">灵根</p>
                <p className="text-xl font-bold">{player.spiritRoot}</p>
              </div>
              <div className="md:col-span-2">
                <p className="text-blue-200">外观</p>
                <p className="text-lg">{player.appearance}</p>
              </div>
              <div className="md:col-span-2">
                <p className="text-blue-200">背景</p>
                <p className="text-lg">{player.backstory}</p>
              </div>
              {player.preHeavenFates?.length ? (
                <div className="md:col-span-2">
                  <p className="text-blue-200">先天气运</p>
                  <div className="mt-2 space-y-1 text-sm">
                    {player.preHeavenFates.map((fate, idx) => (
                      <div key={fate.name + idx} className="bg-white/5 p-2 rounded border border-white/10">
                        <p className="font-semibold text-white">
                          {fate.name} · {fate.type}
                        </p>
                        <p className="text-white/80">{fate.effect}</p>
                        <p className="text-white/60 text-xs italic">{fate.description}</p>
                      </div>
                    ))}
                  </div>
                </div>
              ) : null}
              <div className="md:col-span-2 border-t border-white/20 pt-4">
                <div className="grid grid-cols-3 gap-4">
                  <div>
                    <p className="text-blue-200">气血上限</p>
                    <p className="text-2xl font-bold text-yellow-400">
                      {player.battleProfile?.maxHp ?? '--'}
                    </p>
                  </div>
                  <div>
                    <p className="text-blue-200">灵力</p>
                    <p className="text-2xl font-bold text-green-400">
                      {player.battleProfile?.attributes.spirit ?? '--'}
                    </p>
                  </div>
                  <div>
                    <p className="text-blue-200">速度</p>
                    <p className="text-3xl font-bold text-red-400">
                      {player.battleProfile?.attributes.speed ?? '--'}
                    </p>
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-4 mt-4">
                  <div>
                    <p className="text-blue-200">悟性</p>
                    <p className="text-2xl font-bold text-purple-300">
                      {player.battleProfile?.attributes.wisdom ?? '--'}
                    </p>
                  </div>
                  <div>
                    <p className="text-blue-200">战力评估</p>
                    <p className="text-2xl font-bold text-orange-300">{getCombatRating(player)}</p>
                  </div>
                </div>
              </div>
            </div>
            <button
              onClick={handleBattle}
              disabled={loading}
              className="mt-4 px-6 py-3 bg-red-600 hover:bg-red-700 text-white rounded-lg font-medium disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
            >
              {loading ? '战斗中...' : '挑战 Boss（血手人屠）'}
            </button>
          </div>
        )}

        {/* 战斗结果区域 */}
        {(battleResult || isStreaming || finalReport) && (
          <div className="bg-white/10 backdrop-blur-lg rounded-lg p-6">
            <h2 className="text-2xl font-semibold text-white mb-4">战斗结果</h2>
            <div className="space-y-4 text-white">
              {battleResult && (
                <>
                  <div className="flex items-center justify-between p-4 bg-green-500/20 rounded-lg">
                    <div>
                      <p className="text-green-200">胜利者</p>
                      <p className="text-2xl font-bold">{battleResult.winner.name}</p>
                      <p className="text-sm text-green-300">
                        战力评估: {getCombatRating(battleResult.winner)}
                      </p>
                    </div>
                    {battleResult.triggeredMiracle && (
                      <div className="px-4 py-2 bg-yellow-500/30 rounded-lg">
                        <p className="text-yellow-200 font-bold">✨ 触发顿悟！</p>
                      </div>
                    )}
                  </div>
                  <div className="p-4 bg-red-500/20 rounded-lg">
                    <p className="text-red-200">失败者</p>
                    <p className="text-xl font-bold">{battleResult.loser.name}</p>
                    <p className="text-sm text-red-300">
                      战力评估: {getCombatRating(battleResult.loser)}
                    </p>
                  </div>
                </>
              )}
              <div className="p-4 bg-purple-500/20 rounded-lg">
                <div className="flex items-center gap-2 mb-2">
                  <p className="text-purple-200">战斗播报</p>
                  {isStreaming && (
                    <span className="inline-flex items-center gap-1 text-purple-300 text-sm">
                      <span className="animate-pulse">●</span>
                      <span>正在生成...</span>
                    </span>
                  )}
                </div>
                <div className="text-lg leading-relaxed whitespace-pre-wrap min-h-[100px]">
                  {isStreaming ? (
                    <span>
                      {streamingReport}
                      <span className="animate-pulse text-purple-400">▊</span>
                    </span>
                  ) : finalReport ? (
                    finalReport
                  ) : null}
                </div>
              </div>
            </div>
          </div>
        )}

        {/* 说明区域 */}
        <div className="mt-8 bg-white/5 backdrop-blur-lg rounded-lg p-6 text-white/80 text-sm">
          <h3 className="text-lg font-semibold mb-2">📝 说明</h3>
          <ul className="list-disc list-inside space-y-1">
            <li>这是一个最小可运行的 Demo，用于验证第二阶段的核心功能</li>
            <li>目前 AI 调用使用模拟响应，实际使用时需要配置真实的 API Key</li>
            <li>战力计算包括：属性成长 + 先天气运 + 装备加成</li>
            <li>战斗系统包含「顿悟」机制：低战力方有小概率逆袭</li>
            <li>所有数据结构和计算逻辑都已实现，可在控制台查看详细日志</li>
          </ul>
        </div>
      </div>
    </div>
  );
}


