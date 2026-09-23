import { useInkUI } from '@app/components/providers/InkUIProvider';
import { InkButton, InkInput, InkNotice, InkSelect } from '@app/components/ui';
import { MailAttachmentsSchema } from '@shared/lib/itemLibrary';
import { useEffect, useState } from 'react';
import { AdminDialog } from '../../_components/AdminDialog';
import { RewardSelectionPreview } from '../../_components/RewardSelectionEditor';
import type { RewardSelectionDraft } from '../../_components/RewardSelectionEditor.helpers';

interface RedeemCodeItem {
  id: string;
  code: string;
  rewardSummary: string[];
  rewardSource?: 'snapshot' | 'expired_legacy' | 'broken_snapshot';
  status: 'active' | 'disabled';
  rewardPresetId?: string;
  rewardAttachments?: unknown[] | null;
  totalLimit: number | null;
  claimedCount: number;
  startsAt: string | null;
  endsAt: string | null;
  createdAt: string;
}

function RewardPreview({ item }: { item: RedeemCodeItem }) {
  const parsed = MailAttachmentsSchema.safeParse(item.rewardAttachments);
  if (!parsed.success)
    return (
      <p className="text-ink-secondary text-sm">
        {item.rewardSummary.join('、') || '奖励数据不可用'}
      </p>
    );
  const current: RewardSelectionDraft[] = [];
  const historical: string[] = [];
  for (const attachment of parsed.data) {
    if (attachment.type === 'inventory_v1')
      current.push({
        type: 'inventory_v1',
        inventory: attachment.inventory,
        quantity: String(attachment.quantity),
      });
    else if (
      attachment.type === 'spirit_stones' ||
      attachment.type === 'reputation'
    )
      current.push({
        type: attachment.type,
        quantity: String(attachment.quantity),
      });
    else historical.push(`${attachment.name} ×${attachment.quantity}`);
  }
  return (
    <div className="space-y-3">
      {current.length > 0 && <RewardSelectionPreview value={current} />}
      {historical.length > 0 && (
        <p className="text-ink-secondary text-sm">
          历史附件：{historical.join('、')}
        </p>
      )}
    </div>
  );
}
const formatTime = (value: string | null) =>
  value ? new Date(value).toLocaleString() : '—';
function statusLabel(item: RedeemCodeItem) {
  if (item.status === 'disabled') return '已停用';
  if (item.endsAt && new Date(item.endsAt).getTime() <= Date.now())
    return '已过期';
  if (item.totalLimit !== null && item.claimedCount >= item.totalLimit)
    return '已领完';
  if (item.startsAt && new Date(item.startsAt).getTime() > Date.now())
    return '未生效';
  return '可领取';
}
export function RedeemCodesTable() {
  const { pushToast } = useInkUI();
  const [status, setStatus] = useState('all');
  const [query, setQuery] = useState('');
  const [loading, setLoading] = useState(true);
  const [items, setItems] = useState<RedeemCodeItem[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [pending, setPending] = useState(false);
  const [page, setPage] = useState(1);
  const [revision, setRevision] = useState(0);
  const selected = items.find((item) => item.id === selectedId);
  useEffect(() => {
    const controller = new AbortController();
    const load = async () => {
      setLoading(true);
      try {
        const params = new URLSearchParams();
        if (status !== 'all') params.set('status', status);
        const res = await fetch(`/api/admin/redeem-codes?${params}`, {
          signal: controller.signal,
        });
        const data = await res.json();
        if (!res.ok) throw new Error(data.error ?? '加载兑换码失败');
        if (!controller.signal.aborted) setItems(data.redeemCodes ?? []);
      } catch (e) {
        if (!controller.signal.aborted)
          pushToast({
            message: e instanceof Error ? e.message : '加载失败',
            tone: 'danger',
          });
      } finally {
        if (!controller.signal.aborted) setLoading(false);
      }
    };
    void load();
    return () => controller.abort();
  }, [pushToast, status, revision]);
  const toggleStatus = async (item: RedeemCodeItem) => {
    setPending(true);
    try {
      const res = await fetch(`/api/admin/redeem-codes/${item.id}/toggle`, {
        method: 'POST',
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? '切换状态失败');
      pushToast({
        message: item.status === 'active' ? '兑换码已停用' : '兑换码已启用',
        tone: 'success',
      });
      setSelectedId(null);
      setRevision((v) => v + 1);
    } catch (e) {
      pushToast({
        message: e instanceof Error ? e.message : '切换状态失败',
        tone: 'danger',
      });
    } finally {
      setPending(false);
    }
  };
  const filtered = items.filter((item) =>
    item.code.toLowerCase().includes(query.toLowerCase()),
  );
  const totalPages = Math.max(1, Math.ceil(filtered.length / 12));
  const currentPage = Math.min(page, totalPages);
  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-end gap-4">
        <InkInput
          label="搜索兑换码"
          value={query}
          onChange={(v) => {
            setQuery(v);
            setPage(1);
          }}
        />
        <InkSelect
          label="状态"
          value={status}
          onChange={(v) => {
            setStatus(v);
            setPage(1);
          }}
        >
          <option value="all">全部</option>
          <option value="active">已启用</option>
          <option value="disabled">已停用</option>
        </InkSelect>
      </div>
      {loading ? (
        <InkNotice>加载中…</InkNotice>
      ) : !filtered.length ? (
        <InkNotice>没有匹配的兑换码</InkNotice>
      ) : (
        <div>
          <div className="border-ink/15 text-ink-secondary hidden grid-cols-[minmax(0,2fr)_1fr_1fr_auto] gap-6 border-b py-2 text-xs md:grid">
            <span>兑换码 / 有效期</span>
            <span>状态</span>
            <span>已领 / 名额</span>
            <span>操作</span>
          </div>
          {filtered
            .slice((currentPage - 1) * 12, currentPage * 12)
            .map((item) => (
              <article
                key={item.id}
                className="border-ink/10 grid grid-cols-[minmax(0,1fr)_auto] items-center gap-x-6 gap-y-3 border-b py-4 md:grid-cols-[minmax(0,2fr)_1fr_1fr_auto]"
              >
                <div className="col-span-2 min-w-0 md:col-span-1">
                  <p className="font-mono text-sm font-semibold break-all">
                    {item.code}
                  </p>
                  <p className="text-ink-secondary mt-1 text-xs">
                    {item.endsAt
                      ? `有效至 ${formatTime(item.endsAt)}`
                      : '长期有效'}
                  </p>
                </div>
                <span className="text-sm">{statusLabel(item)}</span>
                <span className="text-right font-mono text-sm md:text-left">
                  {item.claimedCount} / {item.totalLimit ?? '不限'}
                </span>
                <div className="col-span-2 text-right md:col-span-1">
                  <InkButton onClick={() => setSelectedId(item.id)}>
                    查看详情
                  </InkButton>
                </div>
              </article>
            ))}
        </div>
      )}
      {totalPages > 1 && (
        <div className="flex items-center justify-between">
          <InkButton
            disabled={loading || currentPage <= 1}
            onClick={() => setPage(currentPage - 1)}
          >
            上一页
          </InkButton>
          <span className="font-mono text-sm">
            {currentPage} / {totalPages}
          </span>
          <InkButton
            disabled={loading || currentPage >= totalPages}
            onClick={() => setPage(currentPage + 1)}
          >
            下一页
          </InkButton>
        </div>
      )}
      <AdminDialog
        open={!!selected}
        onClose={() => setSelectedId(null)}
        busy={pending}
        title="兑换码详情"
        wide
        footer={
          selected && (
            <>
              <InkButton
                disabled={pending}
                onClick={async () => {
                  try {
                    await navigator.clipboard.writeText(selected.code);
                    pushToast({ message: '兑换码已复制', tone: 'success' });
                  } catch {
                    pushToast({
                      message: '复制失败，请手动复制',
                      tone: 'warning',
                    });
                  }
                }}
              >
                复制兑换码
              </InkButton>
              <InkButton
                pending={pending}
                onClick={() => void toggleStatus(selected)}
              >
                {selected.status === 'active' ? '停用兑换码' : '启用兑换码'}
              </InkButton>
            </>
          )
        }
      >
        {selected && (
          <div className="space-y-6">
            <div>
              <p className="font-mono text-xl break-all">{selected.code}</p>
              <p className="text-ink-secondary mt-2 text-sm">
                {statusLabel(selected)} · 已领取 {selected.claimedCount} /{' '}
                {selected.totalLimit ?? '不限'}
              </p>
            </div>
            <section className="space-y-3">
              <h4 className="text-sm font-semibold">兑换奖励</h4>
              <RewardPreview item={selected} />
            </section>
            <dl className="border-ink/10 grid grid-cols-[auto_1fr] gap-x-5 gap-y-3 border-t pt-4 text-sm">
              <dt className="text-ink-secondary">生效时间</dt>
              <dd>
                {selected.startsAt ? formatTime(selected.startsAt) : '立即生效'}
              </dd>
              <dt className="text-ink-secondary">结束时间</dt>
              <dd>
                {selected.endsAt ? formatTime(selected.endsAt) : '长期有效'}
              </dd>
              <dt className="text-ink-secondary">创建时间</dt>
              <dd>{formatTime(selected.createdAt)}</dd>
            </dl>
          </div>
        )}
      </AdminDialog>
    </div>
  );
}
