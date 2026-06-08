import { InkButton } from '@app/components/ui/InkButton';
import type { QiLogEntry, QiLogsResponse } from '@shared/contracts/qi';
import { useEffect, useState } from 'react';
import {
  SettingsMessage,
  SettingsSection,
  settingsLabelClass,
} from './SettingsFields';
import { formatDateTime } from './utils';

const PAGE_SIZE = 20;

const ACTION_LABELS: Record<string, string> = {
  dungeon_start: '秘境探索',
  retreat_10_years: '闭关修行',
  breakthrough_attempt: '突破',
  alchemy_improvised: '即兴炼丹',
  alchemy_formula: '丹方炼丹',
  creation_artifact: '炼器',
  creation_gongfa: '创造功法',
  creation_skill: '创造神通',
  qi_restore_small: '小聚灵符',
  qi_restore_medium: '中聚灵符',
  qi_restore_large: '大聚灵符',
  qi_restore_fill_to_max: '天地引气符',
};

const STATUS_LABELS: Record<string, string> = {
  reserved: '预扣',
  committed: '已确认',
  failed_no_refund: '失败未退还',
  refunded: '已退还',
  restore_committed: '已恢复',
};

const SOURCE_LABELS: Record<string, string> = {
  talisman: '符箓',
  gm: '管理',
  compensation: '补偿',
};

function formatLogLabel(labels: Record<string, string>, value: string | null) {
  if (!value) return '—';
  return labels[value] ?? value;
}

function QiDeltaCell({ log }: { log: QiLogEntry }) {
  return (
    <span className="font-mono">
      {log.qiBefore}
      <span className="text-ink-secondary px-1">→</span>
      {log.qiAfter}
    </span>
  );
}

export function QiLogsTab() {
  const [page, setPage] = useState(1);
  const [data, setData] = useState<QiLogsResponse | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;

    const loadLogs = async () => {
      setIsLoading(true);
      setError(null);
      try {
        const response = await fetch(
          `/api/cultivator/qi/logs?page=${page}&pageSize=${PAGE_SIZE}`,
        );
        const json = (await response.json()) as {
          success: boolean;
          data?: QiLogsResponse;
          error?: string;
        };

        if (!response.ok || !json.success || !json.data) {
          throw new Error(json.error || '读取天地灵气日志失败');
        }
        if (!cancelled) {
          setData(json.data);
        }
      } catch (err) {
        if (!cancelled) {
          setData(null);
          setError(err instanceof Error ? err.message : '读取天地灵气日志失败');
        }
      } finally {
        if (!cancelled) {
          setIsLoading(false);
        }
      }
    };

    void loadLogs();

    return () => {
      cancelled = true;
    };
  }, [page]);

  const logs = data?.logs ?? [];
  const totalPages = data?.totalPages ?? 1;

  return (
    <SettingsSection
      title="天地灵气审计"
      description="查看当前角色的灵气扣减、恢复与退还记录。"
      aside={
        <span className="text-battle-muted text-sm">
          第 {data?.page ?? page} / {totalPages} 页
        </span>
      }
    >
      <div className="grid gap-4">
        {error ? <SettingsMessage type="error">{error}</SettingsMessage> : null}
        {isLoading && logs.length === 0 ? (
          <SettingsMessage>读取中</SettingsMessage>
        ) : null}
        {!isLoading && !error && logs.length === 0 ? (
          <SettingsMessage>暂无天地灵气审计日志</SettingsMessage>
        ) : null}

        {logs.length > 0 ? (
          <div className="border-ink/15 overflow-x-auto border border-dashed">
            <table className="w-full min-w-[48rem] border-collapse text-sm">
              <thead className="bg-ink/5 text-ink">
                <tr className={settingsLabelClass}>
                  <th className="px-3 py-2 text-left font-medium">时间</th>
                  <th className="px-3 py-2 text-left font-medium">动作</th>
                  <th className="px-3 py-2 text-left font-medium">状态</th>
                  <th className="px-3 py-2 text-right font-medium">消耗</th>
                  <th className="px-3 py-2 text-right font-medium">恢复</th>
                  <th className="px-3 py-2 text-right font-medium">变化</th>
                  <th className="px-3 py-2 text-left font-medium">来源</th>
                </tr>
              </thead>
              <tbody className="divide-ink/10 divide-y">
                {logs.map((log) => (
                  <tr key={log.id} className="text-ink-secondary">
                    <td className="px-3 py-2 whitespace-nowrap">
                      {formatDateTime(log.createdAt)}
                    </td>
                    <td className="text-ink px-3 py-2">
                      {formatLogLabel(ACTION_LABELS, log.action)}
                    </td>
                    <td className="px-3 py-2">
                      {formatLogLabel(STATUS_LABELS, log.status)}
                    </td>
                    <td className="text-ink px-3 py-2 text-right font-mono">
                      {log.qiCost}
                    </td>
                    <td className="text-ink px-3 py-2 text-right font-mono">
                      {log.qiGain}
                    </td>
                    <td className="text-ink px-3 py-2 text-right">
                      <QiDeltaCell log={log} />
                    </td>
                    <td className="px-3 py-2">
                      {formatLogLabel(SOURCE_LABELS, log.source)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : null}

        <div className="border-ink/10 flex flex-wrap items-center justify-between gap-3 border-t border-dashed pt-3">
          <SettingsMessage>
            共 {data?.total ?? 0} 条，每页 {data?.pageSize ?? PAGE_SIZE} 条
          </SettingsMessage>
          <div className="flex gap-2">
            <InkButton
              variant="secondary"
              onClick={() => setPage((current) => Math.max(1, current - 1))}
              disabled={isLoading || page <= 1}
            >
              上一页
            </InkButton>
            <InkButton
              variant="secondary"
              onClick={() =>
                setPage((current) => Math.min(totalPages, current + 1))
              }
              disabled={isLoading || page >= totalPages}
            >
              下一页
            </InkButton>
          </div>
        </div>
      </div>
    </SettingsSection>
  );
}
