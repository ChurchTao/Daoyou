import { InkButton } from '@app/components/ui/InkButton';
import { AdminDialog } from '@app/routes/admin/_components/AdminDialog';
import { SPONSORSHIP_TIER_META } from '@daoyou/game-domain/sponsorship';
import { useCallback, useEffect, useState } from 'react';
import {
  fulfillmentLabel,
  ORDER_FILTERS,
  sponsorshipRequest,
  verificationLabel,
  type OrderFilter,
  type SponsorshipOrder,
  type SponsorshipOrderDetail,
} from './sponsorshipAdmin';

export function OrdersPanel({
  onNotice,
}: {
  onNotice: (message: string) => void;
}) {
  const [orders, setOrders] = useState<SponsorshipOrder[]>([]);
  const [filter, setFilter] = useState<OrderFilter>('attention');
  const [page, setPage] = useState(1);
  const [total, setTotal] = useState(0);
  const [busy, setBusy] = useState(false);
  const [detail, setDetail] = useState<SponsorshipOrderDetail | null>(null);
  const [revealedSnapshot, setRevealedSnapshot] = useState<unknown>(null);

  const load = useCallback(async () => {
    const result = await sponsorshipRequest<{
      orders: SponsorshipOrder[];
      total: number;
    }>(
      `/api/admin/sponsorship/orders?page=${page}&pageSize=20&filter=${filter}`,
    );
    setOrders(result.orders);
    setTotal(result.total);
  }, [filter, page]);

  useEffect(() => {
    const controller = new AbortController();
    void sponsorshipRequest<{ orders: SponsorshipOrder[]; total: number }>(
      `/api/admin/sponsorship/orders?page=${page}&pageSize=20&filter=${filter}`,
    )
      .then((result) => {
        if (controller.signal.aborted) return;
        setOrders(result.orders);
        setTotal(result.total);
      })
      .catch((error) => {
        if (controller.signal.aborted) return;
        onNotice(error instanceof Error ? error.message : '订单加载失败');
      });
    return () => controller.abort();
  }, [filter, page, onNotice]);

  const openOrder = async (orderId: string) => {
    setBusy(true);
    setRevealedSnapshot(null);
    try {
      setDetail(
        await sponsorshipRequest<SponsorshipOrderDetail>(
          `/api/admin/sponsorship/orders/${orderId}`,
        ),
      );
    } catch (error) {
      onNotice(error instanceof Error ? error.message : '订单详情加载失败');
    } finally {
      setBusy(false);
    }
  };

  const act = async (
    orderId: string,
    action: 'retry' | 'revoke' | 'rotate-claim',
  ) => {
    if (
      action === 'revoke' &&
      !window.confirm(
        '确认撤销该订单的功德记录？角色最高档位会按剩余记录重算。',
      )
    )
      return;
    setBusy(true);
    try {
      const result = await sponsorshipRequest<{
        fulfillmentStatus?: string;
        message?: string | null;
      }>(`/api/admin/sponsorship/orders/${orderId}/${action}`, {
        method: 'POST',
      });
      await load();
      setDetail(
        await sponsorshipRequest<SponsorshipOrderDetail>(
          `/api/admin/sponsorship/orders/${orderId}`,
        ),
      );
      onNotice(
        action === 'revoke'
          ? '订单已撤销'
          : action === 'retry'
            ? `当前状态：${fulfillmentLabel(result.fulfillmentStatus ?? '')}${result.message ? `；${result.message}` : ''}`
            : '认领码已轮换',
      );
    } catch (error) {
      onNotice(error instanceof Error ? error.message : '操作失败');
    } finally {
      setBusy(false);
    }
  };

  const revealSnapshot = async (snapshotId: string) => {
    if (
      !window.confirm(
        '原始快照可能包含支付信息，查看会写入审计日志。确认继续？',
      )
    )
      return;
    setBusy(true);
    try {
      const result = await sponsorshipRequest<{ snapshot: unknown }>(
        `/api/admin/sponsorship/snapshots/${snapshotId}/reveal`,
        { method: 'POST' },
      );
      setRevealedSnapshot(result.snapshot);
    } catch (error) {
      onNotice(error instanceof Error ? error.message : '快照查看失败');
    } finally {
      setBusy(false);
    }
  };

  const order = detail?.order;

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap gap-4 text-sm">
        {ORDER_FILTERS.map((item) => (
          <button
            key={item.id}
            type="button"
            className={
              filter === item.id
                ? 'text-crimson font-semibold'
                : 'text-ink-secondary hover:text-ink'
            }
            onClick={() => {
              setFilter(item.id);
              setPage(1);
            }}
          >
            {item.label}
          </button>
        ))}
      </div>
      {orders.length === 0 ? (
        <p className="text-ink-secondary border-ink/10 border-y py-8 text-sm">
          这个范围里没有订单。
        </p>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full min-w-[720px] text-left text-sm">
            <thead className="text-ink-secondary">
              <tr>
                <th className="py-2 font-normal">订单</th>
                <th className="font-normal">档位</th>
                <th className="font-normal">状态</th>
                <th className="font-normal">说明</th>
                <th className="font-normal" />
              </tr>
            </thead>
            <tbody>
              {orders.map((item) => (
                <tr key={item.id} className="border-ink/10 border-t">
                  <td className="py-3 pr-3 font-mono text-xs">
                    <span className="block">{item.providerOrderId}</span>
                    <span className="text-ink-secondary mt-1 block">
                      {new Date(item.createdAt).toLocaleString('zh-CN')}
                    </span>
                  </td>
                  <td>
                    {item.resolvedTier
                      ? SPONSORSHIP_TIER_META[item.resolvedTier].name
                      : '未定档'}
                  </td>
                  <td>
                    {verificationLabel(item.verificationStatus)}
                    {' · '}
                    {fulfillmentLabel(item.fulfillmentStatus)}
                  </td>
                  <td className="max-w-64 truncate">
                    {item.lastErrorMessage ?? '—'}
                  </td>
                  <td className="text-right">
                    <InkButton
                      disabled={busy}
                      onClick={() => void openOrder(item.id)}
                    >
                      处理
                    </InkButton>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      <div className="flex items-center justify-between text-sm">
        <span className="text-ink-secondary">
          第 {page} 页 · 共 {total} 条
        </span>
        <div className="flex gap-3">
          <InkButton
            variant="secondary"
            disabled={page <= 1 || busy}
            onClick={() => setPage((current) => current - 1)}
          >
            上一页
          </InkButton>
          <InkButton
            variant="secondary"
            disabled={page * 20 >= total || busy}
            onClick={() => setPage((current) => current + 1)}
          >
            下一页
          </InkButton>
        </div>
      </div>
      <AdminDialog
        wide
        open={detail !== null}
        busy={busy}
        title={order ? `订单 ${order.providerOrderId}` : '订单'}
        onClose={() => {
          setDetail(null);
          setRevealedSnapshot(null);
        }}
        footer={
          order && (
            <>
              <InkButton
                variant="secondary"
                disabled={busy || order.fulfillmentStatus === 'revoked'}
                onClick={() => void act(order.id, 'retry')}
              >
                重试
              </InkButton>
              {detail?.claims.some((claim) =>
                ['active', 'expired'].includes(claim.status),
              ) &&
                !order.checkoutIntentId &&
                !order.recipientCultivatorId &&
                order.verificationStatus === 'verified' &&
                ['awaiting_claim', 'retry_wait', 'needs_attention'].includes(
                  order.fulfillmentStatus,
                ) && (
                  <InkButton
                    variant="secondary"
                    disabled={busy}
                    onClick={() => void act(order.id, 'rotate-claim')}
                  >
                    轮换认领码
                  </InkButton>
                )}
              <InkButton
                variant="primary"
                disabled={busy || order.fulfillmentStatus === 'revoked'}
                onClick={() => void act(order.id, 'revoke')}
              >
                撤销功德
              </InkButton>
            </>
          )
        }
      >
        {order && detail && (
          <div className="space-y-5 text-sm">
            <p>
              {verificationLabel(order.verificationStatus)} ·{' '}
              {fulfillmentLabel(order.fulfillmentStatus)}
              {order.resolvedTier
                ? ` · ${SPONSORSHIP_TIER_META[order.resolvedTier].name}`
                : ''}
            </p>
            {order.providerUserId && (
              <p className="font-mono text-xs">{order.providerUserId}</p>
            )}
            {order.lastErrorMessage && <p>{order.lastErrorMessage}</p>}
            <div>
              <h4 className="font-medium">订单收件角色</h4>
              <p className="mt-1">
                {detail.recipient?.name ??
                  (order.recipientCultivatorId
                    ? '角色已不可用'
                    : '尚未确定或原角色已不存在')}
              </p>
              {detail.recipient && (
                <p className="mt-1 font-mono text-xs">{detail.recipient.id}</p>
              )}
              {detail.subscription && (
                <p className="text-ink-secondary mt-2">
                  订阅每日物资归属：
                  {detail.subscription.cultivatorName ?? '未分配角色'}
                  。需变更时请前往「人工处理」转移订阅。
                </p>
              )}
            </div>
            <div>
              <h4 className="font-medium">认领</h4>
              {detail.claims.length ? (
                detail.claims.map((claim) => (
                  <p key={claim.id} className="text-ink-secondary mt-1">
                    {claim.status} · 私信 {claim.messageStatus} ·{' '}
                    {new Date(claim.expiresAt).toLocaleString('zh-CN')}
                  </p>
                ))
              ) : (
                <p className="text-ink-secondary mt-1">没有认领码</p>
              )}
            </div>
            <div>
              <h4 className="font-medium">功德记录</h4>
              {detail.records.length ? (
                detail.records.map((record) => (
                  <p key={record.id} className="mt-1 font-mono text-xs">
                    {record.cultivatorId} ·{' '}
                    {SPONSORSHIP_TIER_META[record.tier].name}
                    {record.revokedAt ? ' · 已撤销' : ''}
                  </p>
                ))
              ) : (
                <p className="text-ink-secondary mt-1">还没有功德记录</p>
              )}
            </div>
            <div>
              <h4 className="font-medium">原始快照</h4>
              <p className="text-ink-secondary mt-1 text-xs">
                只在排障时查看。每次查看都会留下管理员审计。
              </p>
              {detail.snapshots.map((snapshot) => (
                <div
                  key={snapshot.id}
                  className="border-ink/10 mt-2 flex items-center justify-between border-b py-2"
                >
                  <span>
                    {snapshot.source} ·{' '}
                    {new Date(snapshot.createdAt).toLocaleString('zh-CN')}
                  </span>
                  <InkButton
                    disabled={busy}
                    onClick={() => void revealSnapshot(snapshot.id)}
                  >
                    查看
                  </InkButton>
                </div>
              ))}
              {revealedSnapshot !== null && (
                <pre className="border-ink/10 mt-3 max-h-80 overflow-auto border p-3 text-xs whitespace-pre-wrap">
                  {JSON.stringify(revealedSnapshot, null, 2)}
                </pre>
              )}
            </div>
          </div>
        )}
      </AdminDialog>
    </div>
  );
}
