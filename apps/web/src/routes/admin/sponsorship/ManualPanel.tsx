import { InkButton } from '@app/components/ui/InkButton';
import type { SponsorshipSubscriptionSummary } from '@daoyou/contracts/sponsorship';
import {
  SPONSORSHIP_TIER_IDS,
  SPONSORSHIP_TIER_META,
  type SponsorshipTierId,
} from '@daoyou/game-domain/sponsorship';
import { useEffect, useState } from 'react';
import { sponsorshipRequest } from './sponsorshipAdmin';

export function ManualPanel({
  onNotice,
}: {
  onNotice: (message: string) => void;
}) {
  const [busy, setBusy] = useState(false);
  const [subscriptions, setSubscriptions] = useState<
    SponsorshipSubscriptionSummary[]
  >([]);
  const [subscriptionId, setSubscriptionId] = useState('');
  const [cultivatorId, setCultivatorId] = useState('');
  const [grantCultivatorId, setGrantCultivatorId] = useState('');
  const [tier, setTier] = useState<SponsorshipTierId>('faint_light');
  const [supportedAt, setSupportedAt] = useState('');
  const [publicListing, setPublicListing] = useState(true);
  const [sendMail, setSendMail] = useState(true);

  const selectedSubscription = subscriptions.find(
    (term) => term.id === subscriptionId,
  );
  useEffect(() => {
    let cancelled = false;
    void sponsorshipRequest<SponsorshipSubscriptionSummary[]>(
      '/api/admin/sponsorship/subscriptions',
    )
      .then((rows) => {
        if (!cancelled) setSubscriptions(rows);
      })
      .catch((error) => {
        if (!cancelled)
          onNotice(error instanceof Error ? error.message : '订阅读取失败');
      });
    return () => {
      cancelled = true;
    };
  }, [onNotice]);

  const sync = async () => {
    setBusy(true);
    try {
      const result = await sponsorshipRequest<{
        updated: number;
        skipped: number;
      }>('/api/admin/sponsorship/subscription-sync', { method: 'POST' });
      setSubscriptions(
        await sponsorshipRequest<SponsorshipSubscriptionSummary[]>(
          '/api/admin/sponsorship/subscriptions',
        ),
      );
      onNotice(
        `订阅期限已同步：更新 ${result.updated}，跳过 ${result.skipped}`,
      );
    } catch (error) {
      onNotice(error instanceof Error ? error.message : '同步失败');
    } finally {
      setBusy(false);
    }
  };

  const transfer = async () => {
    if (!selectedSubscription) return;
    if (
      !window.confirm(
        `确认将「${selectedSubscription.name}」从${selectedSubscription.cultivatorName ?? '未分配角色'}转移到角色 ${cultivatorId.trim()}？历史功德不迁移，当日已发物资不重复发放。`,
      )
    )
      return;
    setBusy(true);
    try {
      await sponsorshipRequest(
        `/api/admin/sponsorship/subscriptions/${selectedSubscription.id}/transfer`,
        {
          method: 'POST',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify({
            expectedCultivatorId: selectedSubscription.cultivatorId,
            cultivatorId: cultivatorId.trim(),
          }),
        },
      );
      setSubscriptions(
        await sponsorshipRequest<SponsorshipSubscriptionSummary[]>(
          '/api/admin/sponsorship/subscriptions',
        ),
      );
      setCultivatorId('');
      onNotice('订阅受益角色已转移，历史订单与功德记录保留原归属');
    } catch (error) {
      onNotice(error instanceof Error ? error.message : '转移失败');
    } finally {
      setBusy(false);
    }
  };

  const grant = async () => {
    if (!window.confirm('确认向该角色补记一笔历史功德？')) return;
    setBusy(true);
    try {
      await sponsorshipRequest('/api/admin/sponsorship/manual-grants', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          cultivatorId: grantCultivatorId.trim(),
          tier,
          supportedAt: supportedAt
            ? new Date(supportedAt).toISOString()
            : undefined,
          publicListing,
          sendMail,
        }),
      });
      setGrantCultivatorId('');
      setSupportedAt('');
      onNotice('历史功德已补记');
    } catch (error) {
      onNotice(error instanceof Error ? error.message : '补记失败');
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="divide-ink/10 divide-y">
      <section className="pb-6">
        <h3 className="text-lg">同步订阅期限</h3>
        <p className="text-ink-secondary mt-1 max-w-xl text-sm">
          按已履约、且不早于自动处理起点的订阅订单，向爱发电核对到期时间。
        </p>
        <InkButton
          className="mt-3"
          variant="primary"
          disabled={busy}
          onClick={() => void sync()}
        >
          开始同步
        </InkButton>
      </section>
      <section className="py-6">
        <h3 className="text-lg">转移订阅受益角色</h3>
        <p className="text-ink-secondary mt-1 max-w-xl text-sm">
          每笔订单按下单或认领角色发放功德。订阅续费保留原受益角色，需换人时在此单独转移。
        </p>
        <div className="mt-3 grid gap-3 md:grid-cols-[minmax(0,1fr)_minmax(0,1fr)_auto] md:items-end">
          <label className="text-sm">
            订阅权益（最近更新的 200 条）
            <select
              className="mt-1 w-full border p-2 text-sm"
              value={subscriptionId}
              disabled={busy}
              onChange={(event) => setSubscriptionId(event.target.value)}
            >
              <option value="">请选择订阅</option>
              {subscriptions.map((term) => (
                <option key={term.id} value={term.id}>
                  {term.name} · {term.cultivatorName ?? '未分配'} ·{' '}
                  {term.providerUserId}
                </option>
              ))}
            </select>
          </label>
          <label className="text-sm">
            目标角色 ID
            <input
              className="mt-1 w-full border p-2 font-mono text-sm"
              value={cultivatorId}
              disabled={busy}
              onChange={(event) => setCultivatorId(event.target.value)}
            />
          </label>
          <InkButton
            variant="primary"
            disabled={busy || !selectedSubscription || !cultivatorId.trim()}
            onClick={() => void transfer()}
          >
            转移订阅
          </InkButton>
        </div>
      </section>
      <section className="pt-6">
        <h3 className="text-lg">补记历史功德</h3>
        <p className="text-ink-secondary mt-1 max-w-xl text-sm">
          用于自动处理起点之前的订单。只写功德簿。
        </p>
        <div className="mt-3 flex flex-wrap items-end gap-3">
          <label className="text-sm">
            角色 ID
            <input
              className="mt-1 w-72 border p-2 font-mono text-sm"
              value={grantCultivatorId}
              disabled={busy}
              onChange={(event) => setGrantCultivatorId(event.target.value)}
            />
          </label>
          <label className="text-sm">
            档位
            <select
              className="mt-1 border p-2 text-sm"
              value={tier}
              disabled={busy}
              onChange={(event) =>
                setTier(event.target.value as SponsorshipTierId)
              }
            >
              {SPONSORSHIP_TIER_IDS.map((item) => (
                <option key={item} value={item}>
                  {SPONSORSHIP_TIER_META[item].name}
                </option>
              ))}
            </select>
          </label>
          <label className="text-sm">
            支持时间
            <input
              className="mt-1 border p-2 text-sm"
              type="datetime-local"
              value={supportedAt}
              disabled={busy}
              onChange={(event) => setSupportedAt(event.target.value)}
            />
          </label>
          <label className="flex items-center gap-2 pb-2 text-sm">
            <input
              type="checkbox"
              checked={publicListing}
              disabled={busy}
              onChange={(event) => setPublicListing(event.target.checked)}
            />
            公开留名
          </label>
          <label className="flex items-center gap-2 pb-2 text-sm">
            <input
              type="checkbox"
              checked={sendMail}
              disabled={busy}
              onChange={(event) => setSendMail(event.target.checked)}
            />
            寄送谢信
          </label>
          <InkButton
            variant="primary"
            disabled={busy || !grantCultivatorId.trim()}
            onClick={() => void grant()}
          >
            补记
          </InkButton>
        </div>
      </section>
    </div>
  );
}
