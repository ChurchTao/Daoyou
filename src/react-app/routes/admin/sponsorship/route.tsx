import { InkButton } from '@app/components/ui/InkButton';
import {
  SPONSORSHIP_TIER_IDS,
  SPONSORSHIP_TIER_META,
  type SponsorshipTierId,
} from '@shared/lib/sponsorship';
import { useCallback, useEffect, useState } from 'react';

type TierConfig = { planId: string; minimumAmountFen: number };
type Config = {
  ordersAcceptedAfter: string | null;
  tiers: Record<SponsorshipTierId, TierConfig>;
};
type Order = {
  id: string;
  providerOrderId: string;
  resolvedTier: SponsorshipTierId | null;
  verificationStatus: string;
  fulfillmentStatus: string;
  lastErrorMessage: string | null;
  createdAt: string;
};
type OrderDetail = {
  order: Order;
  claims: {
    id: string;
    status: string;
    messageStatus: string;
    expiresAt: string;
  }[];
  records: {
    id: string;
    cultivatorId: string;
    tier: SponsorshipTierId;
    revokedAt: string | null;
  }[];
  snapshots: {
    id: string;
    source: string;
    createdAt: string;
    purgeAfter: string;
  }[];
};
type OrderFilter =
  'all' | 'attention' | 'awaiting_claim' | 'fulfilled' | 'revoked';

async function request<T>(url: string, init?: RequestInit): Promise<T> {
  const response = await fetch(url, init);
  const data = await response.json();
  if (!response.ok) throw new Error(data.error ?? '请求失败');
  return data as T;
}

export default function SponsorshipAdminPage() {
  const [config, setConfig] = useState<Config | null>(null);
  const [orders, setOrders] = useState<Order[]>([]);
  const [message, setMessage] = useState('');
  const [cultivatorId, setCultivatorId] = useState('');
  const [manualTier, setManualTier] =
    useState<SponsorshipTierId>('faint_light');
  const [manualSupportedAt, setManualSupportedAt] = useState('');
  const [manualPublic, setManualPublic] = useState(true);
  const [manualSendMail, setManualSendMail] = useState(true);
  const [orderFilter, setOrderFilter] = useState<OrderFilter>('all');
  const [orderPage, setOrderPage] = useState(1);
  const [orderTotal, setOrderTotal] = useState(0);
  const [busy, setBusy] = useState(false);
  const [detail, setDetail] = useState<OrderDetail | null>(null);
  const [revealedSnapshot, setRevealedSnapshot] = useState<unknown>(null);

  const load = useCallback(async () => {
    const [nextConfig, nextOrders] = await Promise.all([
      request<Config>('/api/admin/sponsorship/config'),
      request<{ orders: Order[]; total: number }>(
        `/api/admin/sponsorship/orders?page=${orderPage}&pageSize=50&filter=${orderFilter}`,
      ),
    ]);
    setConfig(nextConfig);
    setOrders(nextOrders.orders);
    setOrderTotal(nextOrders.total);
  }, [orderFilter, orderPage]);
  useEffect(() => {
    void (async () => {
      try {
        await load();
      } catch (error) {
        setMessage(error instanceof Error ? error.message : '加载失败');
      }
    })();
  }, [load]);

  const save = async () => {
    if (!config) return;
    setBusy(true);
    try {
      await request('/api/admin/sponsorship/config', {
        method: 'PUT',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ tiers: config.tiers }),
      });
      await load();
      setMessage('档位映射已保存');
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
        '确认撤销该订单的功德记录？此操作会重新计算角色最高档位。',
      )
    )
      return;
    setBusy(true);
    try {
      await request(`/api/admin/sponsorship/orders/${orderId}/${action}`, {
        method: 'POST',
      });
      await load();
      setMessage('操作完成');
    } finally {
      setBusy(false);
    }
  };
  const manualGrant = async () => {
    if (!window.confirm('确认向该角色手动写入历史功德？')) return;
    setBusy(true);
    try {
      await request('/api/admin/sponsorship/manual-grants', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          cultivatorId,
          tier: manualTier,
          supportedAt: manualSupportedAt
            ? new Date(manualSupportedAt).toISOString()
            : undefined,
          publicListing: manualPublic,
          sendMail: manualSendMail,
        }),
      });
      setCultivatorId('');
      setManualSupportedAt('');
      setMessage('历史功德已手动发放');
    } finally {
      setBusy(false);
    }
  };
  const showDetail = async (orderId: string) => {
    setRevealedSnapshot(null);
    setDetail(
      await request<OrderDetail>(`/api/admin/sponsorship/orders/${orderId}`),
    );
  };
  const revealSnapshot = async (snapshotId: string) => {
    if (!window.confirm('原始快照可能包含支付相关敏感信息，确认审计查看？'))
      return;
    const result = await request<{ snapshot: unknown }>(
      `/api/admin/sponsorship/snapshots/${snapshotId}/reveal`,
      { method: 'POST' },
    );
    setRevealedSnapshot(result.snapshot);
  };

  return (
    <div className="space-y-5">
      <header className="border-ink/15 bg-bgpaper/90 border border-dashed p-6">
        <p className="text-ink-secondary text-xs tracking-[0.2em]">
          SPONSORSHIP
        </p>
        <h2 className="font-heading text-ink mt-2 text-4xl">功德簿管理</h2>
        <p className="text-ink-secondary mt-2 text-sm">
          配置爱发电方案映射，核查订单、重试认领与手动处理历史订单。
        </p>
      </header>
      {message && <p className="border-ink/15 border p-3 text-sm">{message}</p>}
      <section className="border-ink/15 bg-bgpaper/90 border border-dashed p-6">
        <h3 className="text-xl">档位映射</h3>
        <p className="text-ink-secondary mt-1 text-sm">
          仅方案 ID 与最低金额（分）可修改，档位名称和主题固定在代码中。
        </p>
        {config?.ordersAcceptedAfter && (
          <p className="text-ink-secondary mt-1 text-xs">
            自动处理起始：
            {new Date(config.ordersAcceptedAfter).toLocaleString('zh-CN')}
            （更早订单仅手动发放）
          </p>
        )}
        <div className="mt-4 grid gap-3 md:grid-cols-2">
          {config &&
            SPONSORSHIP_TIER_IDS.map((tier) => (
              <label key={tier} className="border-ink/15 border p-3 text-sm">
                <span className="block font-medium">
                  {SPONSORSHIP_TIER_META[tier].name}
                </span>
                <input
                  className="mt-2 w-full border p-2"
                  value={config.tiers[tier].planId}
                  placeholder="爱发电 plan_id"
                  onChange={(event) =>
                    setConfig({
                      ...config,
                      tiers: {
                        ...config.tiers,
                        [tier]: {
                          ...config.tiers[tier],
                          planId: event.target.value,
                        },
                      },
                    })
                  }
                />
                <span className="text-ink-secondary mt-2 block text-xs">
                  最低金额（分）
                </span>
                <input
                  className="mt-1 w-full border p-2"
                  type="number"
                  min={1}
                  value={config.tiers[tier].minimumAmountFen}
                  onChange={(event) =>
                    setConfig({
                      ...config,
                      tiers: {
                        ...config.tiers,
                        [tier]: {
                          ...config.tiers[tier],
                          minimumAmountFen: Number(event.target.value),
                        },
                      },
                    })
                  }
                />
              </label>
            ))}
        </div>
        <div className="mt-4 flex gap-3">
          <InkButton
            variant="primary"
            disabled={busy}
            onClick={() =>
              void save().catch((error) => setMessage(error.message))
            }
          >
            保存映射
          </InkButton>
          <InkButton
            variant="secondary"
            disabled={busy}
            onClick={() =>
              void request('/api/admin/sponsorship/ping', { method: 'POST' })
                .then(() => setMessage('爱发电连接正常'))
                .catch((error) => setMessage(error.message))
            }
          >
            测试连接
          </InkButton>
        </div>
      </section>
      <section className="border-ink/15 bg-bgpaper/90 border border-dashed p-6">
        <h3 className="text-xl">历史手动发放</h3>
        <div className="mt-3 flex flex-wrap items-center gap-2">
          <input
            className="min-w-72 border p-2"
            value={cultivatorId}
            onChange={(event) => setCultivatorId(event.target.value)}
            placeholder="角色 UUID"
          />
          <select
            className="border p-2"
            value={manualTier}
            onChange={(event) =>
              setManualTier(event.target.value as SponsorshipTierId)
            }
          >
            {SPONSORSHIP_TIER_IDS.map((tier) => (
              <option key={tier} value={tier}>
                {SPONSORSHIP_TIER_META[tier].name}
              </option>
            ))}
          </select>
          <input
            className="border p-2"
            type="datetime-local"
            value={manualSupportedAt}
            onChange={(event) => setManualSupportedAt(event.target.value)}
          />
          <label className="text-sm">
            <input
              type="checkbox"
              checked={manualPublic}
              onChange={(event) => setManualPublic(event.target.checked)}
            />{' '}
            公开留名
          </label>
          <label className="text-sm">
            <input
              type="checkbox"
              checked={manualSendMail}
              onChange={(event) => setManualSendMail(event.target.checked)}
            />{' '}
            寄送谢信
          </label>
          <InkButton
            variant="primary"
            disabled={!cultivatorId || busy}
            onClick={() =>
              void manualGrant().catch((error) => setMessage(error.message))
            }
          >
            手动发放
          </InkButton>
        </div>
      </section>
      <section className="border-ink/15 bg-bgpaper/90 overflow-x-auto border border-dashed p-6">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h3 className="text-xl">订单</h3>
          <select
            className="border p-2 text-sm"
            value={orderFilter}
            onChange={(event) => {
              setOrderFilter(event.target.value as OrderFilter);
              setOrderPage(1);
            }}
          >
            <option value="all">全部</option>
            <option value="attention">需人工关注</option>
            <option value="awaiting_claim">待认领</option>
            <option value="fulfilled">已履约</option>
            <option value="revoked">已撤销</option>
          </select>
        </div>
        <table className="mt-4 w-full min-w-[760px] text-left text-sm">
          <thead>
            <tr>
              <th className="p-2">订单</th>
              <th>档位</th>
              <th>校验</th>
              <th>履约</th>
              <th>错误</th>
              <th>操作</th>
            </tr>
          </thead>
          <tbody>
            {orders.map((order) => (
              <tr key={order.id} className="border-ink/10 border-t">
                <td className="p-2 font-mono">{order.providerOrderId}</td>
                <td>
                  {order.resolvedTier
                    ? SPONSORSHIP_TIER_META[order.resolvedTier].name
                    : '-'}
                </td>
                <td>{order.verificationStatus}</td>
                <td>{order.fulfillmentStatus}</td>
                <td className="max-w-52 truncate">
                  {order.lastErrorMessage ?? '-'}
                </td>
                <td className="space-x-2">
                  <button
                    disabled={busy}
                    onClick={() =>
                      void showDetail(order.id).catch((error) =>
                        setMessage(error.message),
                      )
                    }
                  >
                    详情
                  </button>
                  <button
                    disabled={busy || order.fulfillmentStatus === 'revoked'}
                    onClick={() =>
                      void act(order.id, 'retry').catch((error) =>
                        setMessage(error.message),
                      )
                    }
                  >
                    重试
                  </button>
                  <button
                    disabled={
                      busy ||
                      order.fulfillmentStatus === 'fulfilled' ||
                      order.fulfillmentStatus === 'revoked'
                    }
                    onClick={() =>
                      void act(order.id, 'rotate-claim').catch((error) =>
                        setMessage(error.message),
                      )
                    }
                  >
                    轮换认领码
                  </button>
                  <button
                    disabled={busy || order.fulfillmentStatus === 'revoked'}
                    onClick={() =>
                      void act(order.id, 'revoke').catch((error) =>
                        setMessage(error.message),
                      )
                    }
                  >
                    撤销
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        <div className="mt-4 flex items-center justify-center gap-3">
          <InkButton
            variant="secondary"
            disabled={orderPage <= 1 || busy}
            onClick={() => setOrderPage((page) => page - 1)}
          >
            上一页
          </InkButton>
          <span className="text-sm">
            第 {orderPage} 页 · 共 {orderTotal} 条
          </span>
          <InkButton
            variant="secondary"
            disabled={orderPage * 50 >= orderTotal || busy}
            onClick={() => setOrderPage((page) => page + 1)}
          >
            下一页
          </InkButton>
        </div>
      </section>
      {detail && (
        <section className="border-ink/15 bg-bgpaper/90 border border-dashed p-6">
          <h3 className="text-xl">订单详情 · {detail.order.providerOrderId}</h3>
          <div className="mt-3 grid gap-4 md:grid-cols-2">
            <div>
              <h4 className="font-medium">认领</h4>
              {detail.claims.length ? (
                detail.claims.map((claim) => (
                  <p key={claim.id} className="mt-1 text-sm">
                    {claim.status} · 私信 {claim.messageStatus} ·{' '}
                    {new Date(claim.expiresAt).toLocaleString('zh-CN')}
                  </p>
                ))
              ) : (
                <p className="text-ink-secondary mt-1 text-sm">无认领码</p>
              )}
            </div>
            <div>
              <h4 className="font-medium">功德记录</h4>
              {detail.records.map((record) => (
                <p key={record.id} className="mt-1 text-sm">
                  {record.cultivatorId} ·{' '}
                  {SPONSORSHIP_TIER_META[record.tier].name}
                  {record.revokedAt ? ' · 已撤销' : ''}
                </p>
              ))}
            </div>
          </div>
          <div className="mt-5">
            <h4 className="font-medium">原始快照</h4>
            <p className="text-ink-secondary mt-1 text-xs">
              查看会写入管理员审计日志，请仅在排障时使用。
            </p>
            {detail.snapshots.map((snapshot) => (
              <div
                key={snapshot.id}
                className="mt-2 flex items-center justify-between border-b py-2 text-sm"
              >
                <span>
                  {snapshot.source} ·{' '}
                  {new Date(snapshot.createdAt).toLocaleString('zh-CN')}
                </span>
                <button
                  onClick={() =>
                    void revealSnapshot(snapshot.id).catch((error) =>
                      setMessage(error.message),
                    )
                  }
                >
                  审计查看
                </button>
              </div>
            ))}
            {revealedSnapshot !== null && (
              <pre className="mt-3 max-h-96 overflow-auto border p-3 text-xs whitespace-pre-wrap">
                {JSON.stringify(revealedSnapshot, null, 2)}
              </pre>
            )}
          </div>
        </section>
      )}
    </div>
  );
}
