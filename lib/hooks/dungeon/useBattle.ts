import { BattleEngineResult } from '@/engine/battle';
import {
  DungeonRound,
  DungeonSettlement,
  DungeonState,
} from '@/lib/dungeon/types';
import { useState } from 'react';

interface BattleCallbackData {
  isFinished: boolean;
  settlement?: DungeonSettlement;
  state?: DungeonState;
  roundData?: DungeonRound;
}

/**
 * 战斗逻辑Hook
 * 负责处理战斗执行和状态管理
 */
export function useBattle() {
  const [battleResult, setBattleResult] = useState<BattleEngineResult>();
  const [streamingReport, setStreamingReport] = useState('');
  const [isStreaming, setIsStreaming] = useState(false);
  const [battleEnd, setBattleEnd] = useState(false);

  /**
   * 执行战斗（SSE流式请求）
   */
  const executeBattle = async (battleId: string) => {
    try {
      setIsStreaming(true);
      setBattleEnd(false);
      setStreamingReport('');
      setBattleResult(undefined);

      const res = await fetch('/api/dungeon/battle/execute', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ battleId }),
      });

      const reader = res.body?.getReader();
      const decoder = new TextDecoder();

      if (!reader) {
        throw new Error('Failed to get response reader');
      }

      let fullReport = '';
      let result: BattleEngineResult | undefined;
      let callbackData: BattleCallbackData | null = null;

      while (true) {
        const { value, done } = await reader.read();
        if (done) break;

        const chunk = decoder.decode(value);
        const lines = chunk.split('\n');

        for (const line of lines) {
          if (line.startsWith('data: ')) {
            try {
              const data = JSON.parse(line.slice(6));

              if (data.type === 'battle_result') {
                result = data.data;
                setBattleResult(data.data);
              } else if (data.type === 'chunk') {
                fullReport += data.content;
                setStreamingReport(fullReport);
              } else if (data.type === 'done') {
                setIsStreaming(false);
                setStreamingReport(fullReport);
                setBattleEnd(true);
                callbackData = data;
              } else if (data.type === 'error') {
                throw new Error(data.error);
              }
            } catch (e) {
              // Ignore JSON parse errors for incomplete chunks
            }
          }
        }
      }

      return { battleResult: result, callbackData };
    } catch (error) {
      console.error('[useBattle] Error:', error);
      setIsStreaming(false);
      throw error;
    }
  };

  /**
   * 重置战斗状态
   */
  const resetBattle = () => {
    setBattleResult(undefined);
    setStreamingReport('');
    setIsStreaming(false);
    setBattleEnd(false);
  };

  return {
    battleResult,
    streamingReport,
    isStreaming,
    battleEnd,
    executeBattle,
    resetBattle,
  };
}
