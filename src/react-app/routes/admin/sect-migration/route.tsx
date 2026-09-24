import { InkButton } from '@app/components/ui/InkButton';
import type { SectMigrationReport } from '@shared/contracts/sectMigration';
import {
  MIGRATION_INSIGHT_PER_FRUIT,
  migrationInsightQuantity,
} from '@shared/sect-migration/insightItem';
import { useCallback, useEffect, useState } from 'react';
import { AdminPageHeader } from '../_components/AdminPage';

const labels = { ready: '待迁移', completed: '已核对', blocked: '需处理' };
export default function SectMigrationPage() {
  const [report, setReport] = useState<SectMigrationReport | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [results, setResults] = useState<string[]>([]);
  const [page, setPage] = useState(0);
  const [filter, setFilter] = useState('all');
  const [maintenanceConfirmed, setMaintenanceConfirmed] = useState(false);
  const load = useCallback(async () => {
    const response = await fetch('/api/admin/sect-migration');
    const data = await response.json();
    if (!response.ok) throw new Error(data.error ?? '加载失败');
    setReport(data as SectMigrationReport);
  }, []);
  useEffect(() => {
    let cancelled = false;
    void fetch('/api/admin/sect-migration')
      .then(async (response) => {
        const data = await response.json();
        if (!response.ok) throw new Error(data.error ?? '加载失败');
        if (!cancelled) setReport(data as SectMigrationReport);
      })
      .catch((e) => {
        if (!cancelled) setError(e instanceof Error ? e.message : '加载失败');
      });
    return () => {
      cancelled = true;
    };
  }, []);
  const refresh = async () => {
    setBusy(true);
    setError('');
    try {
      await load();
    } catch (e) {
      setError(e instanceof Error ? e.message : '核对失败');
    } finally {
      setBusy(false);
    }
  };
  const execute = async () => {
    if (!report?.enabled || !maintenanceConfirmed) return;
    const membershipIds = report.rows
      .filter((r) => r.status === 'ready')
      .slice(0, 20)
      .map((r) => r.membershipId);
    if (!membershipIds.length) return;
    setBusy(true);
    setError('');
    setResults([]);
    try {
      const response = await fetch('/api/admin/sect-migration/batch', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ membershipIds, maintenanceConfirmed }),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error ?? '迁移失败');
      setResults(
        data.results.map(
          (r: { membershipId: string; status: string; error?: string }) =>
            `${r.membershipId}：${r.error ?? (r.status === 'completed' ? '迁移完成' : '已处理，跳过')}`,
        ),
      );
      await load();
    } catch (e) {
      setError(e instanceof Error ? e.message : '执行失败；请刷新核对后重试');
    } finally {
      setBusy(false);
    }
  };
  const rows =
    report?.rows.filter((r) => filter === 'all' || r.status === filter) ?? [];
  const pageCount = Math.max(1, Math.ceil(rows.length / 50));
  const currentPage = Math.min(page, pageCount - 1);
  const ready = report?.rows.filter((r) => r.status === 'ready').length ?? 0;
  return (
    <div className="space-y-5">
      <AdminPageHeader
        title="宗门迁移"
        description="心法按槽位继承等级；经脉继承最高层数，退还另一流派投入。成功后删除待迁移记录，保留核对凭证。"
      />
      {error ? (
        <p role="alert" className="text-crimson break-words">
          {error}
        </p>
      ) : null}
      {!report ? (
        <p>正在读取迁移记录…</p>
      ) : (
        <>
          <p>
            本工具不控制游戏停机。操作前请在部署侧停止游戏实例、消息消费者和定时任务，仅保留临时管理服务。
          </p>
          <label className="flex items-start gap-2 text-sm">
            <input
              type="checkbox"
              checked={maintenanceConfirmed}
              onChange={(e) => setMaintenanceConfirmed(e.target.checked)}
              disabled={busy}
            />
            已完成停机，并确认旧数据保留后到迁移结束期间没有其他写入
          </label>
          <p>
            旧数据保留时间：{report.stagedAt ?? '未保留'}
            。感悟补偿发放为宗门感悟果，每颗增加 {MIGRATION_INSIGHT_PER_FRUIT}
            点，可分次服用。建议感悟不高于 50 时服用，超出 100
            上限的部分不保留；感悟已满时不消耗。
          </p>
          {report.phase === 'legacy' ? (
            <p>
              当前为旧数据库。停机后执行包含来源保留步骤的 0044
              数据库升级，再返回这里迁移。升级会自动保存旧宗门来源。
            </p>
          ) : null}
          {report.issues.map((issue) => (
            <p key={issue} role="alert" className="text-crimson break-words">
              {issue}
            </p>
          ))}
          <div className="flex flex-wrap gap-5 font-mono text-sm">
            <span>总人数 {report.rows.length}</span>
            <span>待迁移 {ready}</span>
            <span>
              已核对{' '}
              {report.rows.filter((r) => r.status === 'completed').length}
            </span>
            <span>
              需处理 {report.rows.filter((r) => r.status === 'blocked').length}
            </span>
          </div>
          <p className="text-sm">
            预计退款总额（含已完成）：修为{' '}
            <span className="font-mono">
              {report.totals.cultivationExp.toLocaleString()}
            </span>
            ，灵石{' '}
            <span className="font-mono">
              {report.totals.spiritStones.toLocaleString()}
            </span>
            ，宗门感悟果{' '}
            <span className="font-mono">
              {(
                report.totals.comprehensionInsight / MIGRATION_INSIGHT_PER_FRUIT
              ).toLocaleString()}
            </span>
            。
          </p>
          <div className="flex flex-wrap items-center gap-3">
            <InkButton
              disabled={
                busy ||
                !maintenanceConfirmed ||
                !report.enabled ||
                !ready ||
                report.issues.length > 0
              }
              onClick={() => void execute()}
            >
              迁移下一批（最多 20 人）
            </InkButton>
            <InkButton
              variant="secondary"
              disabled={busy}
              onClick={() => void refresh()}
            >
              刷新并核对
            </InkButton>
            <a
              className="underline"
              href="/api/admin/sect-migration/audit"
              download
            >
              下载迁移凭证
            </a>
          </div>
          {report.complete ? (
            <p role="status">所有清单成员迁移及退款核对通过。</p>
          ) : null}
          {results.length ? (
            <details open>
              <summary>本批结果</summary>
              <ul className="text-sm break-all">
                {results.map((r) => (
                  <li key={r}>{r}</li>
                ))}
              </ul>
            </details>
          ) : null}
          <label className="flex items-center gap-2 text-sm">
            筛选
            <select
              value={filter}
              onChange={(e) => {
                setFilter(e.target.value);
                setPage(0);
              }}
              className="border-ink/20 border p-2"
            >
              <option value="all">全部</option>
              {Object.entries(labels).map(([value, label]) => (
                <option key={value} value={value}>
                  {label}
                </option>
              ))}
            </select>
          </label>
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead>
                <tr>
                  {[
                    '玩家 / 宗门',
                    '心法等级（槽位顺序）',
                    '经脉层数',
                    '补偿：修为 / 灵石 / 感悟果',
                    '状态',
                  ].map((label) => (
                    <th
                      key={label}
                      className="border-ink/20 border-b p-2 whitespace-nowrap"
                    >
                      {label}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {rows
                  .slice(currentPage * 50, currentPage * 50 + 50)
                  .map((row) => (
                    <tr key={row.membershipId}>
                      <td className="border-ink/10 border-b p-2">
                        <p>
                          {row.name} / {row.sectId}
                        </p>
                        <small className="text-ink-secondary break-all">
                          {row.membershipId}
                        </small>
                      </td>
                      <td className="p-2 font-mono whitespace-nowrap">
                        {row.plan?.methods.map((m) => m.level).join(' / ') ??
                          '—'}
                      </td>
                      <td className="p-2 font-mono">
                        {row.plan?.meridianDepth ?? '—'}
                      </td>
                      <td className="p-2 font-mono whitespace-nowrap">
                        {row.plan
                          ? [
                              row.plan.refund.cultivationExp,
                              row.plan.refund.spiritStones,
                              migrationInsightQuantity(
                                row.plan.refund.comprehensionInsight,
                              ),
                            ]
                              .map((n) => n.toLocaleString())
                              .join(' / ')
                          : '—'}
                      </td>
                      <td className="min-w-40 p-2">
                        {labels[row.status]}
                        {row.error ? (
                          <p className="text-crimson">{row.error}</p>
                        ) : null}
                      </td>
                    </tr>
                  ))}
              </tbody>
            </table>
          </div>
          <div className="flex items-center gap-3">
            <InkButton
              variant="secondary"
              disabled={currentPage === 0}
              onClick={() => setPage(currentPage - 1)}
            >
              上一页
            </InkButton>
            <span className="font-mono">
              {currentPage + 1} / {pageCount}
            </span>
            <InkButton
              variant="secondary"
              disabled={currentPage + 1 >= pageCount}
              onClick={() => setPage(currentPage + 1)}
            >
              下一页
            </InkButton>
          </div>
        </>
      )}
    </div>
  );
}
