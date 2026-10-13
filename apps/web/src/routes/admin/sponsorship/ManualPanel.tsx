import { InkButton } from '@app/components/ui/InkButton';
import {
  SPONSORSHIP_TIER_IDS,
  SPONSORSHIP_TIER_META,
  type SponsorshipTierId,
} from '@daoyou/game-domain/sponsorship';
import { useState } from 'react';
import { sponsorshipRequest } from './sponsorshipAdmin';

export function ManualPanel({
  onNotice,
}: {
  onNotice: (message: string) => void;
}) {
  const [busy, setBusy] = useState(false);
  const [providerUserId, setProviderUserId] = useState('');
  const [cultivatorId, setCultivatorId] = useState('');
  const [grantCultivatorId, setGrantCultivatorId] = useState('');
  const [tier, setTier] = useState<SponsorshipTierId>('faint_light');
  const [supportedAt, setSupportedAt] = useState('');
  const [publicListing, setPublicListing] = useState(true);
  const [sendMail, setSendMail] = useState(true);

  const sync = async () => {
    setBusy(true);
    try {
      const result = await sponsorshipRequest<{
        updated: number;
        skipped: number;
      }>('/api/admin/sponsorship/subscription-sync', { method: 'POST' });
      onNotice(
        `订阅期限已同步：更新 ${result.updated}，跳过 ${result.skipped}`,
      );
    } catch (error) {
      onNotice(error instanceof Error ? error.message : '同步失败');
    } finally {
      setBusy(false);
    }
  };

  const rebind = async () => {
    setBusy(true);
    try {
      await sponsorshipRequest('/api/admin/sponsorship/provider-links/rebind', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          providerUserId: providerUserId.trim(),
          cultivatorId: cultivatorId.trim(),
        }),
      });
      setProviderUserId('');
      setCultivatorId('');
      onNotice('爱发电用户已改绑到指定角色');
    } catch (error) {
      onNotice(error instanceof Error ? error.message : '改绑失败');
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
        <InkButton className="mt-3" variant="primary" disabled={busy} onClick={() => void sync()}>
          开始同步
        </InkButton>
      </section>
      <section className="py-6">
        <h3 className="text-lg">改绑爱发电用户</h3>
        <p className="text-ink-secondary mt-1 max-w-xl text-sm">
          一个爱发电用户只对应一个角色。订单提示已绑定其他角色时，先改绑，再回到订单里重试。
        </p>
        <div className="mt-3 grid gap-3 md:grid-cols-[minmax(0,1fr)_minmax(0,1fr)_auto] md:items-end">
          <label className="text-sm">
            爱发电用户 ID
            <input
              className="mt-1 w-full border p-2 font-mono text-sm"
              value={providerUserId}
              disabled={busy}
              onChange={(event) => setProviderUserId(event.target.value)}
            />
          </label>
          <label className="text-sm">
            角色 ID
            <input
              className="mt-1 w-full border p-2 font-mono text-sm"
              value={cultivatorId}
              disabled={busy}
              onChange={(event) => setCultivatorId(event.target.value)}
            />
          </label>
          <InkButton
            variant="primary"
            disabled={busy || !providerUserId.trim() || !cultivatorId.trim()}
            onClick={() => void rebind()}
          >
            改绑
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
