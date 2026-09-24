import { useInkUI } from '@app/components/providers/InkUIProvider';
import { InkButton, InkInput } from '@app/components/ui';
import {
  formatMailTime,
  systemMailConditionSummary,
  systemMailStatusLabel,
  type SystemMailCampaign,
  type SystemMailListItem,
} from '@shared/contracts/systemMail';
import { useEffect, useState } from 'react';
import { AdminDialog } from '../../_components/AdminDialog';
import { AdminPageHeader } from '../../_components/AdminPage';
import { RewardSelectionPreview } from '../../_components/RewardSelectionEditor';
import { SystemMailEditor } from './SystemMailEditor';
import { rewardDrafts, systemMailRequest } from './systemMailUi';

export default function AdminSystemMailPage() {
  const { pushToast } = useInkUI();
  const [items, setItems] = useState<SystemMailListItem[]>([]);
  const [page, setPage] = useState(1);
  const [searchDraft, setSearchDraft] = useState('');
  const [search, setSearch] = useState('');
  const [hasMore, setHasMore] = useState(false);
  const [loading, setLoading] = useState(true);
  const [version, setVersion] = useState(0);
  const [error, setError] = useState('');
  const [detail, setDetail] = useState<SystemMailCampaign | null>(null);
  const [editor, setEditor] = useState<{
    initial?: SystemMailCampaign;
    copy?: boolean;
  } | null>(null);
  const [busy, setBusy] = useState(false);
  const [detailError, setDetailError] = useState('');
  const [confirmStop, setConfirmStop] = useState(false);
  const [now, setNow] = useState(Date.now);
  useEffect(() => {
    const timer = setInterval(() => setNow(Date.now()), 30000);
    return () => clearInterval(timer);
  }, []);
  useEffect(() => {
    const controller = new AbortController();
    void systemMailRequest<{ items: SystemMailListItem[]; hasMore: boolean }>(
      `?page=${page}&search=${encodeURIComponent(search)}`,
      'GET',
      undefined,
      controller.signal,
    )
      .then((data) => {
        setNow(Date.now());
        setItems(data.items);
        setHasMore(data.hasMore);
      })
      .catch((e) => {
        if (!controller.signal.aborted)
          setError(e instanceof Error ? e.message : '加载失败');
      })
      .finally(() => {
        if (!controller.signal.aborted) setLoading(false);
      });
    return () => controller.abort();
  }, [page, search, version]);
  function refresh() {
    setNow(Date.now());
    setLoading(true);
    setError('');
    setVersion((v) => v + 1);
  }
  async function open(item: SystemMailListItem) {
    setBusy(true);
    setError('');
    try {
      const campaign = await systemMailRequest<SystemMailCampaign>(
        `/${item.id}`,
      );
      if (campaign.status === 'draft') setEditor({ initial: campaign });
      else {
        setDetail(campaign);
        setDetailError('');
        setConfirmStop(false);
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : '加载失败');
    } finally {
      setBusy(false);
    }
  }
  async function stop() {
    if (!detail || busy) return;
    setBusy(true);
    setDetailError('');
    try {
      await systemMailRequest(`/${detail.id}/stop`, 'POST', {
        revision: detail.revision,
      });
      setDetail(null);
      refresh();
      pushToast({ message: '已停止后续投递', tone: 'success' });
    } catch (e) {
      setDetailError(e instanceof Error ? e.message : '停用失败');
    } finally {
      setBusy(false);
    }
  }
  return (
    <div className="space-y-6">
      <AdminPageHeader
        title="系统邮件"
        description="发布内容与条件，符合条件的角色活跃时投递。"
        actions={
          <InkButton variant="primary" onClick={() => setEditor({})}>
            新建邮件
          </InkButton>
        }
      />
      <form
        className="flex flex-wrap items-end gap-3"
        onSubmit={(e) => {
          e.preventDefault();
          setSearch(searchDraft.trim());
          setPage(1);
          refresh();
        }}
      >
        <div className="min-w-0 flex-1">
          <InkInput
            label="搜索标题"
            value={searchDraft}
            onChange={setSearchDraft}
          />
        </div>
        <InkButton type="submit" disabled={loading}>
          搜索
        </InkButton>
        <InkButton disabled={loading} onClick={refresh}>
          刷新
        </InkButton>
      </form>
      {error && (
        <p role="alert" className="text-crimson text-sm">
          {error}
        </p>
      )}
      {loading ? (
        <p className="text-ink-secondary py-8 text-center">加载中…</p>
      ) : (
        <div className="border-ink/10 divide-ink/10 divide-y border-y">
          {items.length === 0 && (
            <p className="text-ink-secondary py-10 text-center">暂无系统邮件</p>
          )}
          {items.map((item) => (
            <article
              key={item.id}
              className="flex flex-wrap items-center justify-between gap-4 py-4"
            >
              <div className="min-w-0 flex-1 space-y-2">
                <p className="font-semibold break-words">{item.title}</p>
                <p className="text-ink-secondary text-sm">
                  {systemMailStatusLabel(item, now)} · 已投递{' '}
                  <span className="font-mono">{item.deliveredCount}</span> 封
                </p>
                <p className="text-ink-secondary text-xs leading-6">
                  {formatMailTime(item.startsAt)} 至{' '}
                  {formatMailTime(item.endsAt)}（北京时间）
                </p>
              </div>
              <InkButton disabled={busy} onClick={() => void open(item)}>
                {item.status === 'draft' ? '编辑草稿' : '查看详情'}
              </InkButton>
            </article>
          ))}
        </div>
      )}
      <div className="flex items-center justify-between gap-3">
        <InkButton
          disabled={page === 1 || loading}
          onClick={() => {
            setPage((p) => p - 1);
            refresh();
          }}
        >
          上一页
        </InkButton>
        <span className="text-ink-secondary text-sm">
          第 <span className="font-mono">{page}</span> 页
        </span>
        <InkButton
          disabled={!hasMore || loading}
          onClick={() => {
            setPage((p) => p + 1);
            refresh();
          }}
        >
          下一页
        </InkButton>
      </div>
      {editor && (
        <SystemMailEditor
          initial={editor.initial}
          copy={editor.copy}
          onClose={() => {
            setEditor(null);
            refresh();
          }}
          onSaved={(published) => {
            setEditor(null);
            refresh();
            pushToast({
              message: published
                ? '已发布，符合条件的角色活跃时投递'
                : '草稿已保存',
              tone: 'success',
            });
          }}
        />
      )}
      <AdminDialog
        open={!!detail}
        title="系统邮件详情"
        wide
        busy={busy}
        error={detailError}
        onClose={() => setDetail(null)}
        footer={
          detail && (
            <>
              <InkButton
                disabled={busy}
                onClick={() => {
                  setEditor({ initial: detail, copy: true });
                  setDetail(null);
                }}
              >
                复制为新邮件
              </InkButton>
              {detail.status === 'published' &&
                (confirmStop ? (
                  <>
                    <span className="text-sm">
                      停止后不能恢复，已投递邮件保留。
                    </span>
                    <InkButton
                      disabled={busy}
                      onClick={() => setConfirmStop(false)}
                    >
                      取消
                    </InkButton>
                    <InkButton pending={busy} onClick={() => void stop()}>
                      确认停用
                    </InkButton>
                  </>
                ) : (
                  <InkButton onClick={() => setConfirmStop(true)}>
                    停止后续投递
                  </InkButton>
                ))}
            </>
          )
        }
      >
        {detail && (
          <div className="space-y-5">
            <article className="space-y-3">
              <h4 className="text-lg font-semibold break-words">
                {detail.title}
              </h4>
              <p className="text-sm leading-7 break-words whitespace-pre-wrap">
                {detail.content}
              </p>
            </article>
            <p className="text-sm">
              {systemMailStatusLabel(detail, now)} · 已投递{' '}
              <span className="font-mono">{detail.deliveredCount}</span> 封
            </p>
            <section className="border-ink/10 space-y-2 border-y py-4">
              <p className="text-sm">
                {formatMailTime(detail.startsAt)} 至{' '}
                {formatMailTime(detail.endsAt)}（北京时间，结束时刻不含）
              </p>
              {systemMailConditionSummary(detail.conditions).map((line) => (
                <p key={line} className="text-sm break-words">
                  {line}
                </p>
              ))}
            </section>
            <RewardSelectionPreview
              value={rewardDrafts(detail.rewardSelections)}
            />
          </div>
        )}
      </AdminDialog>
    </div>
  );
}
