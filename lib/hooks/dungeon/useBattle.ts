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
  dungeonState?: DungeonState;
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
    let result: BattleEngineResult | undefined;
    let callbackData: BattleCallbackData | null = null;

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

      while (true) {
        const { value, done } = await reader.read();
        if (done) break;

        const chunk = decoder.decode(value);
        const lines = chunk.split('\n');

        for (const line of lines) {
          if (line.startsWith('data: ')) {
            let data: Record<string, unknown>;
            try {
              data = JSON.parse(line.slice(6));
            } catch {
              // Ignore JSON parse errors for incomplete chunks
              continue;
            }

            if (data.type === 'battle_result') {
              result = data.data as BattleEngineResult;
              setBattleResult(result);
            } else if (data.type === 'chunk') {
              fullReport += String(data.content ?? '');
              setStreamingReport(fullReport);
            } else if (data.type === 'done') {
              setIsStreaming(false);
              setStreamingReport(fullReport);
              setBattleEnd(true);
              callbackData = data as unknown as BattleCallbackData;
            } else if (data.type === 'error') {
              throw new Error(String(data.error ?? '战斗流程异常中断'));
            }
          }
        }
      }

      return { battleResult: result, callbackData };
    } catch (error) {
      console.error('[useBattle] Error:', error);
      setIsStreaming(false);
      // 保持可点击“继续探险”，让上层通过 refresh 做恢复
      setBattleEnd(true);
      return { battleResult: result, callbackData };
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
