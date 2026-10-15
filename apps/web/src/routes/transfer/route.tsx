import { InkButton } from '@app/components/ui/InkButton';
import { apiFetch } from '@app/lib/api/fetch';
import { requireUserLoader } from '@app/lib/router/loaders';
import { useCallback, useEffect, useState } from 'react';

export const loader = requireUserLoader;

type Preview = {
  name: string;
  realm: string;
  realmStage: string;
  spiritStones: number;
  sectId: string | null;
  manualCount: number;
  equippedCount: number;
  items: { slot: number | null; definitionId: string; quantity: number }[];
  beastCount: number;
};
type ImportRequest = {
  id: string;
  status: string;
  challenge: string;
  preview: Preview | null;
  expiresAt: string;
  reviewNote: string | null;
  receipt: string | null;
};
type ExportRecord = {
  id: string;
  status: string;
  targetServerId: string;
  package: string;
  characterName: string;
};

async function transferApi<T>(path: string, body?: object): Promise<T> {
  const response = await apiFetch(`/api/transfer/${path}`, {
    method: body ? 'POST' : 'GET',
    headers: body ? { 'Content-Type': 'application/json' } : undefined,
    body: body ? JSON.stringify(body) : undefined,
    cache: 'no-store',
  });
  const payload = await response.json().catch(() => ({})) as T & { error?: string };
  if (!response.ok) throw new Error(payload.error || '转服请求失败');
  return payload;
}

function downloadPackage(value: string, name: string) {
  const url = URL.createObjectURL(new Blob([value], { type: 'text/plain;charset=utf-8' }));
  const link = document.createElement('a');
  link.href = url;
  link.download = `daoyou-transfer-${name}.txt`;
  link.click();
  URL.revokeObjectURL(url);
}

function PreviewCard({ preview }: { preview: Preview }) {
  return (
    <div className="text-ink-secondary space-y-1 text-sm">
      <p className="text-ink font-semibold">{preview.name} · {preview.realm} {preview.realmStage}</p>
      <p>灵石 {preview.spiritStones.toLocaleString()} · 功法 {preview.manualCount} · 穿戴 {preview.equippedCount} · 灵兽 {preview.beastCount}</p>
      <p>宗门：{preview.sectId ?? '无'}；背包与装备共 {preview.items.length} 格</p>
    </div>
  );
}

export default function TransferPage() {
  const [requests, setRequests] = useState<ImportRequest[]>([]);
  const [exports, setExports] = useState<ExportRecord[]>([]);
  const [challenge, setChallenge] = useState('');
  const [packageText, setPackageText] = useState('');
  const [receipt, setReceipt] = useState('');
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');

  const refresh = useCallback(async () => {
    const [nextRequests, nextExports] = await Promise.all([
      transferApi<ImportRequest[]>('requests'), transferApi<ExportRecord[]>('exports'),
    ]);
    setRequests(nextRequests);
    setExports(nextExports);
  }, []);

  useEffect(() => {
    const timer = window.setTimeout(() => { void refresh().catch((cause) => setError(String(cause))); }, 0);
    return () => window.clearTimeout(timer);
  }, [refresh]);

  const run = async (action: () => Promise<void>) => {
    setBusy(true);
    setError('');
    setMessage('');
    try { await action(); await refresh(); }
    catch (cause) { setError(cause instanceof Error ? cause.message : '操作失败'); }
    finally { setBusy(false); }
  };

  const currentIssued = requests.find((request) => request.status === 'issued');
  const pendingExports = exports.filter((record) => record.status === 'pending');

  return (
    <main className="app-safe-area-page bg-paper min-h-dvh text-ink">
      <div className="mx-auto max-w-4xl space-y-6 py-8">
        <header className="space-y-2">
          <h1 className="font-heading text-3xl">跨服转移</h1>
          <p className="text-ink-secondary text-sm leading-7">先在目标服注册并登录账号，领取一次性凭证；回到原服导出角色存档，再到目标服提交。目标服管理员审核通过后才会创建角色。</p>
          <InkButton href="/game" variant="secondary">返回游戏</InkButton>
        </header>
        {error && <p className="border-crimson/30 text-crimson border p-3 text-sm">{error}</p>}
        {message && <p className="border-teal/30 text-teal border p-3 text-sm">{message}</p>}

        <section className="border-ink/15 bg-bgpaper/90 space-y-4 border border-dashed p-5">
          <h2 className="text-xl font-semibold">目标服 · 申请导入</h2>
          <InkButton disabled={busy} onClick={() => void run(async () => {
            const result = await transferApi<{ challenge: string }>('requests', {});
            await navigator.clipboard.writeText(result.challenge);
            setMessage('凭证已复制。请到原服务器的转服页面粘贴。');
          })}>申请并复制一次性凭证</InkButton>
          {currentIssued && <div className="space-y-2 text-sm">
            <p>当前凭证有效至 {new Date(currentIssued.expiresAt).toLocaleString()}</p>
            <InkButton variant="secondary" onClick={() => void navigator.clipboard.writeText(currentIssued.challenge)}>复制凭证</InkButton>
          </div>}
          <label className="block text-sm">上传原服存档文件
            <input className="mt-2 block w-full" type="file" accept=".txt,text/plain" onChange={(event) => {
              const file = event.target.files?.[0];
              if (file) void file.text().then(setPackageText).catch(() => setError('读取存档文件失败'));
            }} />
          </label>
          <textarea className="border-ink/20 bg-paper w-full border p-3 font-mono text-xs" rows={3} value={packageText} onChange={(event) => setPackageText(event.target.value)} placeholder="也可以直接粘贴加密存档" />
          <InkButton disabled={busy || !currentIssued || !packageText.trim()} onClick={() => void run(async () => {
            await transferApi(`requests/${currentIssued!.id}/submit`, { package: packageText.trim() });
            setPackageText('');
            setMessage('存档已提交，等待管理员审核。');
          })}>提交审核</InkButton>
          {requests.filter((request) => request.status !== 'issued').map((request) => <div key={request.id} className="border-ink/10 border-t pt-3 text-sm">
            <p>申请 {request.id} · {request.status === 'pending' ? '待审核' : request.status === 'imported' ? '已转入' : '已驳回'}</p>
            {request.preview && <PreviewCard preview={request.preview} />}
            {request.reviewNote && <p className="text-crimson">审核意见：{request.reviewNote}</p>}
            {request.status === 'pending' && <InkButton variant="secondary" disabled={busy} onClick={() => void run(async () => {
              await transferApi(`requests/${request.id}/cancel`, {});
              setMessage('导入申请已撤销。请把驳回回执带回原服解冻角色。');
            })}>撤销导入申请</InkButton>}
            {request.receipt && <InkButton variant="secondary" onClick={() => void navigator.clipboard.writeText(request.receipt!)}>复制审核回执，带回原服</InkButton>}
          </div>)}
        </section>

        <section className="border-ink/15 bg-bgpaper/90 space-y-4 border border-dashed p-5">
          <h2 className="text-xl font-semibold">原服 · 导出角色</h2>
          <p className="text-ink-secondary text-sm">导出后角色冻结；请保存存档文件，目标服审核结束后将回执带回此处。</p>
          <textarea className="border-ink/20 bg-paper w-full border p-3 font-mono text-xs" rows={3} value={challenge} onChange={(event) => setChallenge(event.target.value)} placeholder="粘贴目标服一次性凭证" />
          <InkButton disabled={busy || !challenge.trim()} onClick={() => void run(async () => {
            const result = await transferApi<{ exportId: string; package: string }>('exports', { challenge: challenge.trim() });
            downloadPackage(result.package, result.exportId);
            setChallenge('');
            setMessage('存档已下载，原角色已冻结。请到目标服提交存档。');
          })}>冻结角色并下载存档</InkButton>
          {exports.map((record) => <div key={record.id} className="border-ink/10 space-y-2 border-t pt-3 text-sm">
            <p>{record.characterName} → {record.targetServerId} · {record.status === 'pending' ? '等待审核回执' : record.status === 'imported' ? '已转出' : '转入被拒，角色已解冻'}</p>
            <InkButton variant="secondary" onClick={() => downloadPackage(record.package, record.id)}>重新下载存档</InkButton>
          </div>)}
          {pendingExports.length > 0 && <div className="space-y-2">
            <textarea className="border-ink/20 bg-paper w-full border p-3 font-mono text-xs" rows={3} value={receipt} onChange={(event) => setReceipt(event.target.value)} placeholder="粘贴目标服审核回执" />
            {pendingExports.map((record) => <InkButton key={record.id} disabled={busy || !receipt.trim()} onClick={() => void run(async () => {
              await transferApi(`exports/${record.id}/receipt`, { receipt: receipt.trim() });
              setReceipt('');
              setMessage('原服角色状态已按目标服审核结果更新。');
            })}>应用回执：{record.characterName}</InkButton>)}
          </div>}
        </section>
      </div>
    </main>
  );
}
