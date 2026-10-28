import { InkButton } from '@app/components/ui/InkButton';
import { PaperSurface } from '@app/components/ui/PaperSurface';
import { apiFetch } from '@app/lib/api/fetch';
import { requireUserLoader } from '@app/lib/router/loaders';
import { useCallback, useEffect, useState } from 'react';
import { useSearchParams } from 'react-router';
import { PreviewCard, type Preview } from './preview';

export const loader = requireUserLoader;

const CONFIRM_TEXT = '我已知晓虚空风险';
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

function StepHeader({ title, steps, current }: { title: string; steps: string[]; current: number }) {
  return <div className="space-y-4">
    <h2 className="font-heading text-2xl">{title}</h2>
    <ol className="grid gap-2 sm:grid-cols-3" aria-label={`${title}步骤`}>
      {steps.map((step, index) => <li key={step} aria-current={index + 1 === current ? 'step' : undefined}
        className={`border px-3 py-2 text-sm ${index + 1 === current ? 'border-crimson/50 bg-crimson/5 text-crimson font-semibold' : 'border-ink/15 text-ink-secondary'}`}>
        <span className="font-mono">{String(index + 1).padStart(2, '0')}</span> {step}
      </li>)}
    </ol>
  </div>;
}

function TransferVista({ mode, onBack }: { mode: 'import' | 'export'; onBack: () => void }) {
  const arrival = mode === 'import';
  return <section className="relative" aria-labelledby="transfer-vista-title">
    <img
      src={`/assets/transfer/${arrival ? 'void-arrival' : 'ascension-departure'}.webp`}
      alt={arrival ? '修士穿过虚空裂隙，降临山水之间' : '修士撕裂虚空，飞升离界'}
      width={arrival ? 1536 : 1774}
      height={arrival ? 1024 : 887}
      className={`block h-[min(52svh,24rem)] w-full object-cover sm:h-[min(72svh,44rem)] ${arrival ? 'object-[74%_18%]' : 'object-[32%_42%]'}`}
    />
    <div aria-hidden className="pointer-events-none absolute inset-0 bg-[linear-gradient(to_bottom,rgba(12,8,6,0.82)_0%,rgba(12,8,6,0.4)_18%,rgba(12,8,6,0.08)_36%,rgba(12,8,6,0)_52%)]" />
    <div className="absolute top-0 left-0 w-full px-[max(1.25rem,env(safe-area-inset-left))] pt-[max(1rem,env(safe-area-inset-top))] sm:pl-[max(1.5rem,env(safe-area-inset-left))]">
      <div className="max-w-xl">
        <div className="flex flex-wrap gap-x-4 gap-y-1">
          <InkButton href="/game" className="text-paper hover:text-white">返回游戏</InkButton>
          <InkButton className="text-paper hover:text-white" onClick={onBack}>返回跨界入口</InkButton>
        </div>
        <div className="mt-5 sm:mt-8">
          <p className="text-sm tracking-[0.28em] text-paper [text-shadow:0_1px_10px_rgba(8,5,4,0.85)] sm:tracking-[0.32em]">撕裂虚空 · 跨界飞升</p>
          <h1 id="transfer-vista-title" className="font-heading mt-3 text-5xl text-paper [text-shadow:0_2px_14px_rgba(8,5,4,0.9)] sm:mt-4 sm:text-6xl">{arrival ? '降临此界' : '飞升离界'}</h1>
        </div>
      </div>
    </div>
  </section>;
}

export default function TransferPage() {
  const [searchParams, setSearchParams] = useSearchParams();
  const requestedMode = searchParams.get('mode');
  const mode = requestedMode === 'import' || requestedMode === 'export' ? requestedMode : null;
  const [requests, setRequests] = useState<ImportRequest[]>([]);
  const [exports, setExports] = useState<ExportRecord[]>([]);
  const [importStep, setImportStep] = useState(1);
  const [exportStep, setExportStep] = useState(1);
  const [confirm, setConfirm] = useState('');
  const [preview, setPreview] = useState<Preview | null>(null);
  const [challenge, setChallenge] = useState('');
  const [packageText, setPackageText] = useState('');
  const [fileName, setFileName] = useState('');
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
  const openMode = (next: 'import' | 'export') => {
    setSearchParams({ mode: next });
    setError('');
    setMessage('');
  };
  const currentIssued = requests.find((request) => request.status === 'issued');
  const latestSubmitted = requests.find((request) => request.status !== 'issued');
  const pendingExport = exports.find((record) => record.status === 'pending');
  const completedExport = exports[0]?.status === 'imported' ? exports[0] : undefined;
  const displayedImportStep = latestSubmitted?.status === 'pending' || (latestSubmitted?.status === 'imported' && !currentIssued) ? 3 : importStep;

  const openEntry = () => setSearchParams({});

  return <PaperSurface as="main" className={`min-h-dvh text-ink ${mode ? '' : 'app-safe-area-page'}`}>
    {mode && <TransferVista mode={mode} onBack={openEntry} />}
    <div className={mode ? 'relative z-10 mx-auto -mt-28 max-w-6xl space-y-4 px-4 pb-[max(1.5rem,env(safe-area-inset-bottom))] sm:-mt-[clamp(8.5rem,22svh,15rem)] sm:px-6' : 'mx-auto max-w-5xl space-y-6 px-4 py-8 sm:px-6'}>
      {!mode && <header className="border-ink/15 space-y-3 border-b pb-6">
          <p className="text-crimson text-sm tracking-widest">撕裂虚空 · 跨界飞升</p>
          <h1 className="font-heading text-3xl sm:text-4xl">选择跨界方向</h1>
          <p className="text-ink-secondary max-w-2xl text-sm leading-7">每台服务器是一方世界。先在目标界注册正式账号并领取凭证，再回原界打包；抵达目标界仍需管理员审核。</p>
          <div className="flex flex-wrap gap-3"><InkButton href="/game" variant="secondary">返回游戏</InkButton></div>
      </header>}
      {!mode && error && <p role="alert" className="border-crimson/30 text-crimson border p-3 text-sm">{error}</p>}
      {!mode && message && <p role="status" className="border-teal/30 text-teal border p-3 text-sm">{message}</p>}

      {!mode && <div className="grid gap-4 sm:grid-cols-2">
        <button type="button" onClick={() => openMode('import')} className="border-ink/20 bg-paper hover:border-crimson/50 min-h-44 space-y-3 border p-6 text-left transition-colors">
          <span className="block space-y-3"><span className="text-crimson block text-sm">目标服务器 · 来到此界</span><span className="font-heading block text-2xl">降临此界 · 转入 →</span>
          <span className="text-ink-secondary block max-w-xs text-sm leading-7">领取接引凭证，上传原界存档，等待守界管理员审核。</span>
          {requests.some((request) => request.status === 'pending') && <span className="text-crimson block text-sm">有待审核申请</span>}</span>
        </button>
        <button type="button" onClick={() => openMode('export')} className="border-ink/20 bg-paper hover:border-crimson/50 min-h-44 space-y-3 border p-6 text-left transition-colors">
          <span className="block space-y-3"><span className="text-crimson block text-sm">原服务器 · 离开此界</span><span className="font-heading block text-2xl">飞升离界 · 转出 →</span>
          <span className="text-ink-secondary block max-w-xs text-sm leading-7">知晓虚空风险，核对可携行之物，再用目标界凭证打包。</span>
          {pendingExport && <span className="text-crimson block text-sm">有待处理的转出</span>}</span>
        </button>
      </div>}

      {mode && <div className="space-y-4">
        {error && <p role="alert" className="border-crimson/30 bg-paper text-crimson border p-3 text-sm">{error}</p>}
        {message && <p role="status" className="border-teal/30 bg-paper text-teal border p-3 text-sm">{message}</p>}
      {mode === 'import' && <section className="border-ink/15 bg-bgpaper space-y-6 border p-5 shadow-[0_18px_40px_rgba(44,24,16,0.08)] sm:p-7">
        <p className="text-ink-secondary max-w-2xl text-sm leading-7">从别的界来到当前服务器。先领取接引凭证，待原服打包后上传存档，守界管理员审核通过才会真正降临。</p>
        <StepHeader title="转入流程" steps={['领取接引凭证', '上传跨界存档', '等待守界审核']} current={displayedImportStep} />
        {displayedImportStep === 1 && <div className="space-y-4 text-sm leading-7">
          <p>请确认你已在<strong>目标服务器</strong>注册并登录正式账号。凭证仅供这次转入使用，有效期一小时；请复制后到原服务器的转出页面使用。</p>
          <InkButton disabled={busy} onClick={() => void run(async () => {
            const result = await transferApi<{ challenge: string }>('requests', {});
            try { await navigator.clipboard.writeText(result.challenge); setMessage('凭证已生成并复制。'); }
            catch { setMessage('凭证已生成，请使用下方按钮复制。'); }
          })}>领取一次性凭证</InkButton>
          {currentIssued && <div className="border-ink/15 bg-paper space-y-3 border p-4">
            <p>当前凭证有效至 {new Date(currentIssued.expiresAt).toLocaleString()}</p>
            <InkButton variant="secondary" onClick={() => void navigator.clipboard.writeText(currentIssued.challenge)}>复制凭证</InkButton>
            <p className="text-ink-secondary">在原服完成打包并下载存档后，回到这里上传。</p>
            <InkButton onClick={() => setImportStep(2)}>下一步：上传存档</InkButton>
          </div>}
        </div>}
        {displayedImportStep === 2 && <div className="space-y-4 text-sm leading-7">
          <p>将原服下载的加密存档上传到这里。提交后进入管理员审核，审核通过后才会创建角色。</p>
          <label className="border-ink/30 bg-paper hover:border-crimson/50 inline-flex cursor-pointer items-center border px-5 py-3 font-semibold transition-colors">
            选择存档文件<input className="sr-only" type="file" accept=".txt,text/plain" onChange={(event) => {
              const file = event.target.files?.[0];
              if (!file) return;
              if (file.size > 500_000) { setError('存档文件过大（最多 500 KB）'); return; }
              setError('');
              void file.text().then((value) => { setPackageText(value); setFileName(file.name); }).catch(() => setError('读取存档文件失败'));
            }} />
          </label>
          {fileName && <p>已选择：<strong>{fileName}</strong></p>}
          <details className="text-ink-secondary"><summary className="cursor-pointer">没有文件？粘贴存档文本</summary>
            <textarea className="border-ink/20 bg-paper mt-3 w-full border p-3 font-mono text-xs" rows={4} value={packageText} onChange={(event) => { setPackageText(event.target.value); setFileName(''); }} placeholder="粘贴原服导出的加密存档" />
          </details>
          <div className="flex flex-wrap gap-3"><InkButton variant="secondary" onClick={() => setImportStep(1)}>上一步</InkButton>
            <InkButton disabled={busy || !currentIssued || !packageText.trim()} onClick={() => void run(async () => {
              await transferApi(`requests/${currentIssued!.id}/submit`, { package: packageText.trim() });
              setPackageText(''); setFileName(''); setImportStep(3);
              setMessage('存档已提交，等待管理员审核。');
            })}>提交存档，等待审核</InkButton></div>
        </div>}
        {displayedImportStep === 3 && <div className="space-y-4 text-sm leading-7">
          <p className="font-semibold">{latestSubmitted?.status === 'pending' ? '存档已提交，等待目标服管理员审核。' : latestSubmitted?.status === 'imported' ? '角色已转入目标服。' : '请查看最近一次申请结果。'}</p>
          {latestSubmitted?.preview && <PreviewCard preview={latestSubmitted.preview} detailed />}
          {latestSubmitted?.reviewNote && <p className="text-crimson">审核意见：{latestSubmitted.reviewNote}</p>}
          {latestSubmitted?.status === 'pending' && <InkButton variant="secondary" disabled={busy} onClick={() => void run(async () => {
            await transferApi(`requests/${latestSubmitted.id}/cancel`, {});
            setMessage('申请已撤销。请复制回执带回原服解冻角色。');
          })}>撤销申请</InkButton>}
          {latestSubmitted?.receipt && <div className="space-y-2"><p>请把审核回执带回原服的转出页面，完成角色状态更新。</p>
            <InkButton variant="secondary" onClick={() => void navigator.clipboard.writeText(latestSubmitted.receipt!)}>复制审核回执</InkButton></div>}
          {currentIssued && <InkButton variant="secondary" onClick={() => setImportStep(1)}>查看当前凭证</InkButton>}
        </div>}
        {requests.length > 1 && <details className="border-ink/10 border-t pt-4 text-sm"><summary className="cursor-pointer">查看全部转入申请（{requests.length}）</summary>
          <ul className="mt-3 space-y-2">{requests.map((request) => <li key={request.id}>{request.preview?.name ?? '未提交存档'} · {request.status === 'issued' ? '凭证已领取' : request.status === 'pending' ? '待审核' : request.status === 'imported' ? '已转入' : '已驳回'}{request.receipt && <InkButton variant="secondary" onClick={() => void navigator.clipboard.writeText(request.receipt!)}>复制回执</InkButton>}</li>)}</ul>
        </details>}
      </section>}

      {mode === 'export' && <section className="border-ink/15 bg-bgpaper space-y-6 border p-5 shadow-[0_18px_40px_rgba(44,24,16,0.08)] sm:p-7">
        <p className="text-ink-secondary max-w-2xl text-sm leading-7">从当前服务器撕裂虚空，前往目标界。虚空会损伤自身修为，也会吞噬超出携带上限的财物与灵兽。</p>
        {pendingExport || completedExport && !pendingExport ? <div className="space-y-4 text-sm leading-7">
          <h2 className="font-heading text-2xl">转出进度</h2>
          {pendingExport ? <><p><strong>{pendingExport.characterName}</strong> 已冻结，等待目标服审核。请保存存档并提交到目标服；审核结束后把回执粘贴在此处。</p>
            <InkButton onClick={() => downloadPackage(pendingExport.package, pendingExport.id)}>重新下载存档</InkButton>
            <label className="block">目标服审核回执<textarea className="border-ink/20 bg-paper mt-2 w-full border p-3 font-mono text-xs" rows={4} value={receipt} onChange={(event) => setReceipt(event.target.value)} placeholder="粘贴目标服审核回执" /></label>
            <InkButton disabled={busy || !receipt.trim()} onClick={() => void run(async () => {
              await transferApi(`exports/${pendingExport.id}/receipt`, { receipt: receipt.trim() });
              setReceipt(''); setMessage('原服角色状态已按审核结果更新。');
            })}>应用审核回执</InkButton></> : <p>{completedExport?.characterName} 已完成转出。</p>}
          {exports.length > 1 && <details><summary className="cursor-pointer">查看历史转出（{exports.length}）</summary>
            <ul className="mt-3 space-y-2">{exports.map((record) => <li key={record.id}>{record.characterName} → {record.targetServerId} · {record.status === 'pending' ? '待回执' : record.status === 'imported' ? '已转出' : '已驳回、已解冻'} <InkButton variant="secondary" onClick={() => downloadPackage(record.package, record.id)}>下载存档</InkButton></li>)}</ul>
          </details>}</div> : <>
          <StepHeader title="转出流程" steps={['知晓虚空风险', '核对携行之物', '凭证打包']} current={exportStep} />
          {exportStep === 1 && <div className="space-y-4 text-sm leading-7">
            <div className="border-crimson/20 bg-crimson/5 space-y-2 border p-4">
              <p className="font-semibold">撕裂虚空前请确认</p>
              <ul className="list-inside list-disc space-y-1">
                <li>导出成功后，原服角色立即冻结；目标服管理员审核通过后才能使用新角色。冻结是指这个角色立刻不能再修行，账号也不能另开新角色；角色和家当都还在，只是被扣住。审核通过前可以反悔：到目标服撤销申请；若存档还没提交，先提交再撤销。把驳回回执贴回原服的转出页，角色就会解冻。审核一旦通过，原角色记为已转出，不能再恢复。</li>
                <li>虚空只能容纳 1500 万灵石；声望、宗门贡献和职位无法跨界。</li>
                <li>撕裂虚空会损伤自身修为，宗门心法因此每门降低 10 级，最低保留 1 级。</li>
                <li>只带穿戴装备和背包前 8 格；符箓每格最多 10 张，其他物品每格最多 30 个，v1 材料会被虚空吞噬。</li>
                <li>灵兽袋前 3 只可以同行。超出上限的物品与灵兽不入存档，目标服不会补发。</li>
                <li>目标服需要信任原服，且目标账号必须是正式账号。</li>
              </ul>
            </div>
            <label className="block">请输入 <strong className="text-crimson">{CONFIRM_TEXT}</strong> 以继续<input className="border-ink/20 bg-paper mt-2 block w-full border p-3" value={confirm} onChange={(event) => setConfirm(event.target.value)} autoComplete="off" /></label>
            <InkButton disabled={busy || confirm !== CONFIRM_TEXT} onClick={() => void run(async () => {
              setPreview(await transferApi<Preview>('export-preview'));
              setExportStep(2);
            })}>下一步：查看可转出内容</InkButton>
          </div>}
          {exportStep === 2 && preview && <div className="space-y-5 text-sm leading-7">
            <p className="text-ink-secondary">以下由原服实时计算，显示抵达目标界后的预计状态。请逐项核对；继续游玩可能改变最终打包结果。</p>
            <PreviewCard preview={preview} detailed />
            <div className="flex flex-wrap gap-3 border-ink/10 border-t pt-4"><InkButton variant="secondary" onClick={() => setExportStep(1)}>上一步</InkButton>
              <InkButton onClick={() => setExportStep(3)}>已核对，下一步输入凭证</InkButton></div>
          </div>}
          {exportStep === 3 && <div className="space-y-4 text-sm leading-7">
            <p>请在目标服的转入流程领取一次性凭证，再粘贴到这里。打包完成后原服角色会立即冻结，请下载并妥善保存存档文件。</p>
            <label className="block">目标服一次性凭证<textarea className="border-ink/20 bg-paper mt-2 w-full border p-3 font-mono text-xs" rows={4} value={challenge} onChange={(event) => setChallenge(event.target.value)} placeholder="粘贴目标服一次性凭证" /></label>
            <div className="flex flex-wrap gap-3"><InkButton variant="secondary" onClick={() => setExportStep(2)}>上一步</InkButton>
              <InkButton disabled={busy || !challenge.trim()} onClick={() => void run(async () => {
                const result = await transferApi<{ exportId: string; package: string }>('exports', { challenge: challenge.trim() });
                downloadPackage(result.package, result.exportId);
                setChallenge(''); setMessage('存档已下载，角色已冻结。请到目标服提交存档。');
              })}>冻结角色并打包下载</InkButton></div>
          </div>}
        </>}
      </section>}
      </div>}
    </div>
  </PaperSurface>;
}
