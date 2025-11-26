'use client';

import { useState } from 'react';
import type { Cultivator } from '../../types/cultivator';
import { calculateCultivatorPower, battle } from '../../utils/powerCalculator';
import { getCharacterGenerationPrompt, getBattleReportPrompt, getDefaultBoss } from '../../utils/prompts';
// AI 调用已移至 API 路由
import { createCultivatorFromAI } from '../../utils/cultivatorUtils';

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
  const [battleResult, setBattleResult] = useState<{
    winner: Cultivator;
    loser: Cultivator;
    report: string;
    triggeredMiracle: boolean;
  } | null>(null);

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
    try {
      // 1. 获取 Boss
      const boss = getDefaultBoss();

      // 2. 执行战斗
      const result = battle(player, boss);
      console.log('战斗结果:', result);

      // 3. 生成战斗播报
      const battlePrompt = getBattleReportPrompt(player, boss, result.winner);
      console.log('战斗播报 Prompt:', battlePrompt);

      // 调用 API 生成战斗播报
      const reportResponse = await fetch('/api/generate-battle-report', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          cultivatorA: player,
          cultivatorB: boss,
          winner: result.winner,
        }),
      });

      const reportResult = await reportResponse.json();

      if (!reportResponse.ok || !reportResult.success) {
        throw new Error(reportResult.error || '生成战斗播报失败');
      }

      const report = reportResult.data;
      console.log('战斗播报:', report);

      setBattleResult({
        winner: result.winner,
        loser: result.loser,
        report,
        triggeredMiracle: result.triggeredMiracle,
      });
    } catch (error) {
      console.error('战斗失败:', error);
      alert('战斗失败，请检查控制台');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-purple-900 via-blue-900 to-indigo-900 p-8">
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
              <div>
                <p className="text-blue-200">天赋</p>
                <p className="text-xl font-bold">{player.talents.join('、')}</p>
              </div>
              <div className="md:col-span-2">
                <p className="text-blue-200">外观</p>
                <p className="text-lg">{player.appearance}</p>
              </div>
              <div className="md:col-span-2">
                <p className="text-blue-200">背景</p>
                <p className="text-lg">{player.backstory}</p>
              </div>
              <div className="md:col-span-2 border-t border-white/20 pt-4">
                <div className="grid grid-cols-3 gap-4">
                  <div>
                    <p className="text-blue-200">基础战力</p>
                    <p className="text-2xl font-bold text-yellow-400">{player.basePower}</p>
                  </div>
                  <div>
                    <p className="text-blue-200">天赋加成</p>
                    <p className="text-2xl font-bold text-green-400">+{player.talentBonus}</p>
                  </div>
                  <div>
                    <p className="text-blue-200">总战力</p>
                    <p className="text-3xl font-bold text-red-400">{player.totalPower}</p>
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
        {battleResult && (
          <div className="bg-white/10 backdrop-blur-lg rounded-lg p-6">
            <h2 className="text-2xl font-semibold text-white mb-4">战斗结果</h2>
            <div className="space-y-4 text-white">
              <div className="flex items-center justify-between p-4 bg-green-500/20 rounded-lg">
                <div>
                  <p className="text-green-200">胜利者</p>
                  <p className="text-2xl font-bold">{battleResult.winner.name}</p>
                  <p className="text-sm text-green-300">战力: {battleResult.winner.totalPower}</p>
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
                <p className="text-sm text-red-300">战力: {battleResult.loser.totalPower}</p>
              </div>
              <div className="p-4 bg-purple-500/20 rounded-lg">
                <p className="text-purple-200 mb-2">战斗播报</p>
                <p className="text-lg leading-relaxed whitespace-pre-wrap">{battleResult.report}</p>
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
            <li>战力计算包括：基础战力（根据境界）+ 天赋加成 + 随机波动</li>
            <li>战斗系统包含"顿悟"机制：低战力方有小概率逆袭</li>
            <li>所有数据结构和计算逻辑都已实现，可在控制台查看详细日志</li>
          </ul>
        </div>
      </div>
    </div>
  );
}

