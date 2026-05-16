import { GameSceneAsideSection, GameSceneFrame } from '@app/components/game-shell';
import { InkSection } from '@app/components/layout';
import { InkButton } from '@app/components/ui/InkButton';
import { InkCard } from '@app/components/ui/InkCard';
import { InkList, InkListItem } from '@app/components/ui/InkList';
import { InkNotice } from '@app/components/ui/InkNotice';
import { getResourceTypeLabel } from '@shared/types/dictionaries';
import { useEffect, useState } from 'react';

/**
 * 日志条目结构
 */
interface LogEntry {
  round: number;
  scene: string;
  choice: string | null;
}

/**
 * 解析副本日志字符串
 *
 * @param log 原始日志字符串，格式为：[Round 1] 场景描述 -> Choice: 选项\n[Round 2] ...
 * @returns 解析后的结构化数组
 */
function parseDungeonLog(log: string): LogEntry[] {
  if (!log || typeof log !== 'string') {
    return [];
  }

  try {
    const lines = log.split('\n').filter((line) => line.trim());
    const entries: LogEntry[] = [];

    for (const line of lines) {
      // 正则匹配：[Round X] 场景描述 -> Choice: 选择文本
      const match = line.match(/\[Round (\d+)\] (.+?)(?: -> Choice: (.+))?$/);

      if (match) {
        const [, roundStr, scene, choice] = match;
        entries.push({
          round: parseInt(roundStr, 10),
          scene: scene.trim(),
          choice: choice ? choice.trim() : null,
        });
      }
    }

    return entries;
  } catch (error) {
    console.error('日志解析失败:', error);
    return [];
  }
}

interface DungeonHistoryRecord {
  id: string;
  theme: string;
  result: {
    ending_narrative?: string;
    settlement?: {
      reward_tier?: string;
      reward_blueprints?: Array<{
        name: string;
        description: string;
      }>;
    };
  };
  log: string;
  realGains: Array<{
    type: string;
    name?: string;
    value?: number;
  }> | null;
  createdAt: string;
}

interface PaginationInfo {
  page: number;
  pageSize: number;
  total: number;
  totalPages: number;
}

export default function DungeonHistoryPage() {
  const [records, setRecords] = useState<DungeonHistoryRecord[]>([]);
  const [pagination, setPagination] = useState<PaginationInfo>({
    page: 1,
    pageSize: 10,
    total: 0,
    totalPages: 0,
  });
  const [loading, setLoading] = useState(true);
  const [expandedId, setExpandedId] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;

    const loadHistory = async () => {
      try {
        const res = await fetch('/api/dungeon/history?page=1&pageSize=10');
        const data = await res.json();
        if (!cancelled && data.success) {
          setRecords(data.data.records);
          setPagination(data.data.pagination);
        }
      } catch (error) {
        if (!cancelled) {
          console.error('获取历史记录失败:', error);
        }
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    };

    void loadHistory();

    return () => {
      cancelled = true;
    };
  }, []);

  const fetchHistory = async (page: number) => {
    try {
      const res = await fetch(`/api/dungeon/history?page=${page}&pageSize=${pagination.pageSize}`);
      const data = await res.json();
      if (data.success) {
        setRecords(data.data.records);
        setPagination(data.data.pagination);
      }
    } catch (error) {
      console.error('获取历史记录失败:', error);
    }
  };

  const formatDate = (dateStr: string) => {
    const date = new Date(dateStr);
    return date.toLocaleDateString('zh-CN', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  const getTierColor = (tier?: string) => {
    switch (tier) {
      case 'S':
        return 'text-gold';
      case 'A':
        return 'text-crimson';
      case 'B':
        return 'text-wood';
      case 'C':
        return 'text-teal';
      case 'D':
        return 'text-ink-secondary';
      default:
        return 'text-ink-secondary';
    }
  };

  if (loading && records.length === 0) {
    return (
      <GameSceneFrame
        variant="lite"
        title="探险札记"
        description="副本骨架仍保持沉浸式，这页则作为常规卷宗页，专门整理已经发生过的探险过程与收获。"
      >
        <InkNotice>翻阅旧事…</InkNotice>
      </GameSceneFrame>
    );
  }

  if (records.length === 0) {
    return (
      <GameSceneFrame
        variant="lite"
        title="探险札记"
        description="副本骨架仍保持沉浸式，这页则作为常规卷宗页，专门整理已经发生过的探险过程与收获。"
        actionBar={
          <div className="flex flex-wrap gap-2">
            <InkButton href="/game/dungeon" variant="primary">
              开始探险
            </InkButton>
            <InkButton href="/game">返回洞府</InkButton>
          </div>
        }
      >
        <InkCard className="p-6 text-center">
          <p className="text-ink-secondary">尚无探险记录</p>
        </InkCard>
      </GameSceneFrame>
    );
  }

  return (
    <GameSceneFrame
      title="探险札记"
      description="副本骨架仍保持沉浸式，这页则作为常规卷宗页，专门整理已经发生过的探险过程与收获。"
      aside={
        <>
          <GameSceneAsideSection title="札记摘要">
            <div className="space-y-2 text-sm leading-7">
              <p>累计探险：{pagination.total} 次</p>
              <p>当前页次：{pagination.page} / {Math.max(pagination.totalPages, 1)}</p>
            </div>
          </GameSceneAsideSection>
          <GameSceneAsideSection title="奖励品阶" className="text-sm leading-7">
            <p>S / A 越高，表示本次探险机缘与回收层级越高。</p>
            <p className="mt-2">展开单条札记可继续查看逐回合路线。</p>
          </GameSceneAsideSection>
        </>
      }
      actionBar={
        <div className="flex flex-wrap gap-2">
          <InkButton href="/game/dungeon" variant="primary">
            返回云游探秘
          </InkButton>
          <InkButton href="/game">返回洞府</InkButton>
        </div>
      }
    >
      <InkSection title={`共 ${pagination.total} 次探险`}>
        <div className="space-y-4">
          {records.map((record) => (
            <InkCard key={record.id} className="p-4">
              <div
                className="cursor-pointer"
                onClick={() =>
                  setExpandedId(expandedId === record.id ? null : record.id)
                }
              >
                <div className="flex items-center justify-between">
                  <div>
                    <h3 className="font-medium">{record.theme}</h3>
                    <p className="text-ink-secondary text-xs">
                      {formatDate(record.createdAt)}
                    </p>
                  </div>
                  <div
                    className={`text-2xl font-bold ${getTierColor(record.result.settlement?.reward_tier)}`}
                  >
                    {record.result.settlement?.reward_tier || '—'}
                  </div>
                </div>
              </div>

              {expandedId === record.id && (
                <div className="border-ink/10 mt-4 space-y-4 border-t pt-4">
                  {record.result.ending_narrative && (
                    <p className="text-ink/80 text-sm leading-relaxed">
                      {record.result.ending_narrative}
                    </p>
                  )}

                  {record.realGains && record.realGains.length > 0 && (
                    <div>
                      <p className="text-ink-secondary mb-2 text-xs">
                        获得物品:
                      </p>
                      <InkList dense>
                        {record.realGains.map((gain, idx) => (
                          <InkListItem
                            key={idx}
                            title={gain.name || getResourceTypeLabel(gain.type)}
                            meta={gain.value ? `×${gain.value}` : undefined}
                          />
                        ))}
                      </InkList>
                    </div>
                  )}

                  <details className="text-xs">
                    <summary className="text-ink-secondary cursor-pointer">
                      查看详细日志
                    </summary>
                    <div className="mt-3 space-y-4">
                      {(() => {
                        const entries = parseDungeonLog(record.log);

                        if (entries.length === 0) {
                          // 降级处理：解析失败时显示原始日志
                          return (
                            <pre className="bg-paper-dark text-ink/70 border border-dashed border-ink/10 p-2 text-xs whitespace-pre-wrap">
                              {record.log || '暂无详细记录'}
                            </pre>
                          );
                        }

                        // 结构化时间线展示
                        return entries.map((entry) => (
                          <div
                            key={entry.round}
                            className="border-ink/10 border-l-2 pl-3"
                          >
                            <div className="text-ink/90 mb-1 font-bold">
                              第 {entry.round} 回
                            </div>
                            <p className="text-ink/70 mb-2 text-sm leading-relaxed">
                              {entry.scene}
                            </p>
                            {entry.choice && (
                              <div className="text-crimson text-sm">
                                ➜ {entry.choice}
                              </div>
                            )}
                          </div>
                        ));
                      })()}
                    </div>
                  </details>
                </div>
              )}
            </InkCard>
          ))}
        </div>

        {/* 分页控制 */}
        {pagination.totalPages > 1 && (
          <div className="mt-6 flex justify-center gap-4">
            <InkButton
              variant="ghost"
              disabled={pagination.page <= 1 || loading}
              onClick={() => fetchHistory(pagination.page - 1)}
            >
              上一页
            </InkButton>
            <span className="text-ink-secondary self-center">
              {pagination.page} / {pagination.totalPages}
            </span>
            <InkButton
              variant="ghost"
              disabled={pagination.page >= pagination.totalPages || loading}
              onClick={() => fetchHistory(pagination.page + 1)}
            >
              下一页
            </InkButton>
          </div>
        )}
      </InkSection>
    </GameSceneFrame>
  );
}
