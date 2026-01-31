'use client';

import { InkPageShell, InkSection } from '@/components/layout';
import { InkButton } from '@/components/ui/InkButton';
import { InkCard } from '@/components/ui/InkCard';
import { InkList, InkListItem } from '@/components/ui/InkList';
import { getResourceTypeLabel } from '@/types/dictionaries';
import { useCallback, useEffect, useState } from 'react';

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

  const fetchHistory = useCallback(async (page: number) => {
    setLoading(true);
    try {
      const res = await fetch(`/api/dungeon/history?page=${page}&pageSize=10`);
      const data = await res.json();
      if (data.success) {
        setRecords(data.data.records);
        setPagination(data.data.pagination);
      }
    } catch (error) {
      console.error('获取历史记录失败:', error);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchHistory(1);
  }, [fetchHistory]);

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
        return 'text-amber-500';
      case 'A':
        return 'text-crimson';
      case 'B':
        return 'text-blue-500';
      case 'C':
        return 'text-green-600';
      case 'D':
        return 'text-ink-secondary';
      default:
        return 'text-ink-secondary';
    }
  };

  if (loading && records.length === 0) {
    return (
      <InkPageShell title="探险札记" backHref="/game/dungeon">
        <div className="flex justify-center p-12">
          <p className="animate-pulse">翻阅旧事...</p>
        </div>
      </InkPageShell>
    );
  }

  if (records.length === 0) {
    return (
      <InkPageShell title="探险札记" backHref="/game/dungeon">
        <InkCard className="p-6 text-center">
          <p className="text-ink-secondary">尚无探险记录</p>
          <InkButton href="/game/dungeon" variant="primary" className="mt-4">
            开始探险
          </InkButton>
        </InkCard>
      </InkPageShell>
    );
  }

  return (
    <InkPageShell title="探险札记" backHref="/game/dungeon">
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
                    <p className="text-xs text-ink-secondary">
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
                <div className="mt-4 pt-4 border-t border-ink/10 space-y-4">
                  {record.result.ending_narrative && (
                    <p className="text-ink/80 text-sm leading-relaxed">
                      {record.result.ending_narrative}
                    </p>
                  )}

                  {record.realGains && record.realGains.length > 0 && (
                    <div>
                      <p className="text-xs text-ink-secondary mb-2">
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
                            <pre className="p-2 bg-paper-dark rounded whitespace-pre-wrap text-ink/70 text-xs">
                              {record.log || '暂无详细记录'}
                            </pre>
                          );
                        }

                        // 结构化时间线展示
                        return entries.map((entry) => (
                          <div
                            key={entry.round}
                            className="border-l-2 border-ink/10 pl-3"
                          >
                            <div className="font-bold text-ink/90 mb-1">
                              第 {entry.round} 回
                            </div>
                            <p className="text-sm text-ink/70 leading-relaxed mb-2">
                              {entry.scene}
                            </p>
                            {entry.choice && (
                              <div className="text-sm text-crimson">
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
          <div className="flex justify-center gap-4 mt-6">
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
    </InkPageShell>
  );
}
