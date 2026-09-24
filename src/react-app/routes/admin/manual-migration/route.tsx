import { combatV6Request } from '@app/components/feature/combat-v6/request';
import { InkButton } from '@app/components/ui/InkButton';
import type { ManualMigrationAdminView } from '@shared/contracts/manualMigration';
import { useEffect, useRef, useState } from 'react';
import { AdminPageHeader } from '../_components/AdminPage';
const endpoint = '/api/admin/manual-migration';
export default function Page() {
  const [view, setView] = useState<ManualMigrationAdminView>();
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const lock = useRef(false);
  const [page, setPage] = useState(0);
  useEffect(() => {
    const controller = new AbortController();
    void combatV6Request<ManualMigrationAdminView>(endpoint, {
      signal: controller.signal,
    })
      .then(setView)
      .catch((e) => {
        if (!controller.signal.aborted) setError(e.message);
      });
    return () => controller.abort();
  }, []);
  async function refresh() {
    if (lock.current) return;
    lock.current = true;
    setBusy(true);
    setError('');
    try {
      setView(await combatV6Request<ManualMigrationAdminView>(endpoint));
    } catch (e) {
      setError(e instanceof Error ? e.message : '操作失败，请刷新核对');
    } finally {
      setBusy(false);
      lock.current = false;
    }
  }
  const owners = view?.owners ?? [];
  return (
    <div className="space-y-5">
      <AdminPageHeader
        title="旧功法传承"
        description="直接读取原表，查看待兑换功法与异常记录。"
      />
      {error && (
        <p role="alert" className="text-crimson">
          {error}
        </p>
      )}
      <p>
        评分达到 3000 分额外自选 1 本，达到 3200 分额外自选 2
        本。随机玉简沿用参悟境界权重；天品金丹与元婴权重为 5∶1。
      </p>
      <div className="flex flex-wrap gap-3">
        <InkButton
          variant="secondary"
          disabled={busy}
          onClick={() => void refresh()}
        >
          刷新核对
        </InkButton>
      </div>
      <details>
        <summary className="cursor-pointer">查看固定补偿与产出概率</summary>
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead>
              <tr>
                <th className="p-2">品质</th>
                <th className="p-2">随机本数</th>
                <th className="p-2">境界概率</th>
              </tr>
            </thead>
            <tbody>
              {view?.policy &&
                Object.entries(view.policy.rules).map(([quality, rule]) => (
                  <tr key={quality}>
                    <td className="p-2">{quality}</td>
                    <td className="p-2 font-mono">{rule.count}</td>
                    <td className="p-2">
                      {rule.realms
                        .map(
                          (r, i) =>
                            `${r} ${Number((rule.weights[i] * 100).toFixed(2))}%`,
                        )
                        .join('、')}
                    </td>
                  </tr>
                ))}
            </tbody>
          </table>
        </div>
      </details>
      <p className="text-sm">
        待兑换清单直接读取当前有效角色持有的旧功法成品，不包含材料或宗门心法。原成品在玩家成功兑换时删除。异常品质和评分保留待核对。
      </p>
      <div className="overflow-x-auto">
        <table className="w-full text-left text-sm">
          <caption className="py-2 text-left">
            当前旧成品评分分布（兑换后数量会减少）
          </caption>
          <thead>
            <tr>
              {['品质', '数量', '最低', '中位', 'P90', '最高'].map((t) => (
                <th key={t} className="p-2">
                  {t}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {view?.stats.map((s) => (
              <tr key={s.quality}>
                <td className="p-2">{s.quality}</td>
                {[s.count, s.min, s.median, s.p90, s.max].map((n, i) => (
                  <td key={i} className="p-2 font-mono">
                    {n}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <p className="text-sm">
        玩家 <span className="font-mono">{owners.length}</span> · 待兑换{' '}
        <span className="font-mono">
          {owners.reduce((n, o) => n + o.pending, 0)}
        </span>{' '}
        · 异常{' '}
        <span className="font-mono">
          {owners.reduce((n, o) => n + o.problems, 0)}
        </span>
      </p>
      <div className="overflow-x-auto">
        <table className="w-full text-left text-sm">
          <thead>
            <tr>
              {['玩家', '待兑换', '异常'].map((t) => (
                <th key={t} className="p-2">
                  {t}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {owners.slice(page * 50, page * 50 + 50).map((o) => (
              <tr key={o.ownerId}>
                <td className="p-2">
                  <p>{o.name}</p>
                  <small>{o.ownerId}</small>
                </td>
                {[o.pending, o.problems].map((n, i) => (
                  <td key={i} className="p-2 font-mono">
                    {n}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {owners.length > 50 && (
        <div className="flex gap-3">
          <InkButton disabled={!page} onClick={() => setPage(page - 1)}>
            上一页
          </InkButton>
          <InkButton
            disabled={(page + 1) * 50 >= owners.length}
            onClick={() => setPage(page + 1)}
          >
            下一页
          </InkButton>
        </div>
      )}
      {view && owners.length === 0 && (
        <p role="status">当前没有待兑换功法或异常记录。</p>
      )}
    </div>
  );
}
