import { useInkUI } from '@app/components/providers/InkUIProvider';
import { InkButton } from '@app/components/ui/InkButton';
import { apiFetch } from '@app/lib/api/fetch';
import { PreviewCard, type Preview } from '@app/routes/transfer/preview';
import { useCallback, useEffect, useState } from 'react';

type TransferReview = {
  id: string;
  userId: string;
  sourceServerId: string;
  sourceCultivatorId: string;
  submittedAt: string;
  packageHash: string;
  preview: Preview;
};
type TrustedServer = { serverId: string; signingPublicKey: string; enabled: boolean };
type LocalIdentity = { enabled: true; serverId: string; signingPublicKey: string } | { enabled: false };

async function adminTransferApi<T>(path: string, body?: object): Promise<T> {
  const response = await apiFetch(`/api/admin/transfers${path}`, {
    method: body ? 'POST' : 'GET',
    headers: body ? { 'Content-Type': 'application/json' } : undefined,
    body: body ? JSON.stringify(body) : undefined,
    cache: 'no-store',
  });
  const payload = await response.json().catch(() => ({})) as T & { error?: string };
  if (!response.ok) throw new Error(payload.error || '操作失败');
  return payload;
}

export default function AdminTransfersPage() {
  const { pushToast } = useInkUI();
  const [reviews, setReviews] = useState<TransferReview[]>([]);
  const [trusted, setTrusted] = useState<TrustedServer[]>([]);
  const [identity, setIdentity] = useState<LocalIdentity | null>(null);
  const [serverId, setServerId] = useState('');
  const [publicKey, setPublicKey] = useState('');
  const [notes, setNotes] = useState<Record<string, string>>({});
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  const refresh = useCallback(async () => {
    const [nextReviews, nextTrusted, nextIdentity] = await Promise.all([
      adminTransferApi<TransferReview[]>(''),
      adminTransferApi<TrustedServer[]>('/trusted-servers'),
      adminTransferApi<LocalIdentity>('/identity'),
    ]);
    setReviews(nextReviews);
    setTrusted(nextTrusted);
    setIdentity(nextIdentity);
  }, []);
  useEffect(() => {
    const timer = window.setTimeout(() => { void refresh().catch((cause) => setError(String(cause))); }, 0);
    return () => window.clearTimeout(timer);
  }, [refresh]);

  const run = async (action: () => Promise<void>) => {
    setBusy(true);
    setError('');
    try { await action(); await refresh(); }
    catch (cause) { setError(cause instanceof Error ? cause.message : '操作失败'); }
    finally { setBusy(false); }
  };

  const copyText = async (value: string, label: string) => {
    try {
      await navigator.clipboard.writeText(value);
      pushToast({ message: `${label}已复制`, tone: 'success' });
    } catch {
      pushToast({ message: `复制失败，请手动选择${label}`, tone: 'warning' });
    }
  };

  return <div className="space-y-6">
    <header className="border-ink/15 bg-paper border border-dashed p-6">
      <h2 className="font-heading text-ink text-3xl">跨服转入审核</h2>
      <p className="text-ink-secondary mt-2 text-sm">仅接收白名单服务器签发的存档。来源服签名公钥可在该服本页复制，核对后录入。</p>
    </header>
    <section className="border-ink/15 bg-paper space-y-3 border border-dashed p-6">
      <h3 className="text-xl font-semibold">本服签名身份</h3>
      <p className="text-ink-secondary text-sm">其他服务器接收本服转出时，录入下面的服务器 ID 和 Ed25519 签名公钥。解密公钥随玩家凭证传递，不必手工登记。</p>
      {identity?.enabled === false && <p className="text-ink-secondary text-sm">此服务器未启用转服，未配置签名身份。</p>}
      {identity?.enabled && <>
        <div className="flex flex-wrap items-center justify-between gap-3">
          <p className="text-sm">服务器 ID：<span className="font-mono">{identity.serverId}</span></p>
          <InkButton variant="secondary" onClick={() => void copyText(identity.serverId, '服务器 ID')}>复制服务器 ID</InkButton>
        </div>
        <pre className="border-ink/15 bg-paper text-ink overflow-x-auto border p-3 font-mono text-xs break-all whitespace-pre-wrap">{identity.signingPublicKey}</pre>
        <InkButton variant="secondary" onClick={() => void copyText(identity.signingPublicKey, '签名公钥')}>复制签名公钥</InkButton>
      </>}
    </section>
    {error && <p className="border-crimson/30 text-crimson border p-3 text-sm">{error}</p>}
    <section className="border-ink/15 bg-paper space-y-4 border border-dashed p-6">
      <h3 className="text-xl font-semibold">待审核申请</h3>
      <InkButton variant="secondary" disabled={busy} onClick={() => void run(async () => {})}>刷新</InkButton>
      {reviews.length === 0 && <p className="text-ink-secondary text-sm">暂无待审核申请</p>}
      {reviews.map((review) => <article key={review.id} className="border-ink/15 space-y-2 border-t pt-4 text-sm">
        <p>来源：{review.sourceServerId} · 来源角色：{review.sourceCultivatorId}</p>
        <p>目标账号：{review.userId} · 提交：{new Date(review.submittedAt).toLocaleString()}</p>
        <PreviewCard preview={review.preview} detailed />
        <p className="text-ink-secondary font-mono text-xs break-all">SHA-256: {review.packageHash}</p>
        <input className="border-ink/20 bg-paper w-full border p-2" value={notes[review.id] ?? ''} onChange={(event) => setNotes((current) => ({ ...current, [review.id]: event.target.value }))} placeholder="驳回理由（选填）" maxLength={1000} />
        <div className="flex gap-2">
          <InkButton disabled={busy} onClick={() => {
            if (window.confirm(`确认转入 ${review.preview.name}？此操作会创建真实角色。`)) void run(async () => { await adminTransferApi(`/${review.id}/approve`, {}); });
          }}>审核通过并转入</InkButton>
          <InkButton variant="secondary" disabled={busy} onClick={() => {
            if (window.confirm(`确认驳回 ${review.preview.name} 的申请？`)) void run(async () => { await adminTransferApi(`/${review.id}/reject`, { note: notes[review.id] ?? '' }); });
          }}>驳回</InkButton>
        </div>
      </article>)}
    </section>
    <section className="border-ink/15 bg-paper space-y-4 border border-dashed p-6">
      <h3 className="text-xl font-semibold">来源服务器白名单</h3>
      <input className="border-ink/20 bg-paper w-full border p-2 text-sm" value={serverId} onChange={(event) => setServerId(event.target.value)} placeholder="来源服务器 ID" />
      <textarea className="border-ink/20 bg-paper w-full border p-2 font-mono text-xs" rows={5} value={publicKey} onChange={(event) => setPublicKey(event.target.value)} placeholder="Ed25519 PEM 公钥" />
      <InkButton disabled={busy || !serverId.trim() || !publicKey.trim()} onClick={() => void run(async () => {
        await adminTransferApi('/trusted-servers', { serverId: serverId.trim(), signingPublicKey: publicKey.trim() });
        setServerId(''); setPublicKey('');
      })}>添加或更新来源服</InkButton>
      {trusted.map((server) => <div key={server.serverId} className="border-ink/10 flex flex-wrap items-center justify-between gap-3 border-t pt-3 text-sm">
        <div><p className="font-semibold">{server.serverId} · {server.enabled ? '已启用' : '已停用'}</p><p className="text-ink-secondary max-w-xl font-mono text-xs break-all">{server.signingPublicKey}</p></div>
        <InkButton variant="secondary" disabled={busy} onClick={() => void run(async () => { await adminTransferApi(`/trusted-servers/${encodeURIComponent(server.serverId)}/enabled`, { enabled: !server.enabled }); })}>{server.enabled ? '停用' : '启用'}</InkButton>
      </div>)}
    </section>
  </div>;
}
