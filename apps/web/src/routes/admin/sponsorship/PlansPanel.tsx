import { InkButton } from '@app/components/ui/InkButton';
import {
  SPONSORSHIP_TIER_IDS,
  SPONSORSHIP_TIER_META,
  type SponsorshipTierId,
} from '@daoyou/game-domain/sponsorship';
import { useEffect, useState } from 'react';
import {
  editableSubscriptionPlans,
  serializeSubscriptionPlans,
  type EditableSubscriptionPlan,
} from './SubscriptionPlansSection.helpers';
import { SubscriptionPlansSection } from './SubscriptionPlansSection';
import {
  sponsorshipRequest,
  type SponsorshipConfig,
} from './sponsorshipAdmin';

export function PlansPanel({
  onNotice,
}: {
  onNotice: (message: string) => void;
}) {
  const [config, setConfig] = useState<SponsorshipConfig | null>(null);
  const [plans, setPlans] = useState<EditableSubscriptionPlan[]>([]);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    void sponsorshipRequest<SponsorshipConfig>('/api/admin/sponsorship/config')
      .then((next) => {
        setConfig(next);
        setPlans(editableSubscriptionPlans(next.subscriptionPlans));
      })
      .catch((error) =>
        onNotice(error instanceof Error ? error.message : '方案加载失败'),
      );
  }, [onNotice]);

  const save = async () => {
    if (!config) return;
    setBusy(true);
    try {
      await sponsorshipRequest('/api/admin/sponsorship/config', {
        method: 'PUT',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          tiers: config.tiers,
          subscriptionPlans: serializeSubscriptionPlans(plans),
        }),
      });
      const next = await sponsorshipRequest<SponsorshipConfig>(
        '/api/admin/sponsorship/config',
      );
      setConfig(next);
      setPlans(editableSubscriptionPlans(next.subscriptionPlans));
      onNotice('方案已保存');
    } catch (error) {
      onNotice(error instanceof Error ? error.message : '保存失败');
    } finally {
      setBusy(false);
    }
  };

  const updateTier = (
    tier: SponsorshipTierId,
    patch: Partial<SponsorshipConfig['tiers'][SponsorshipTierId]>,
  ) => {
    if (!config) return;
    setConfig({
      ...config,
      tiers: {
        ...config.tiers,
        [tier]: { ...config.tiers[tier], ...patch },
      },
    });
  };

  return (
    <div className="space-y-8">
      <section>
        <div className="flex flex-wrap items-end justify-between gap-3">
          <div>
            <h3 className="text-lg">功德档位</h3>
            <p className="text-ink-secondary mt-1 max-w-xl text-sm">
              名称和主题固定。方案 ID 对应爱发电订阅，最低金额只用于没有方案 ID 的自选订单。每月声望在订单履约时乘以订阅月数，直接计入角色。
            </p>
          </div>
          {config?.ordersAcceptedAfter && (
            <p className="text-ink-secondary text-xs">
              自动处理自{' '}
              {new Date(config.ordersAcceptedAfter).toLocaleString('zh-CN')}{' '}
              起。更早的订单只能手动补记。
            </p>
          )}
        </div>
        <div className="mt-4 overflow-x-auto">
          <table className="w-full min-w-[760px] text-left text-sm">
            <thead className="text-ink-secondary">
              <tr>
                <th className="py-2 font-normal">档位</th>
                <th className="font-normal">爱发电 plan_id</th>
                <th className="w-36 font-normal">最低金额（分）</th>
                <th className="w-32 font-normal">每月声望</th>
              </tr>
            </thead>
            <tbody>
              {config &&
                SPONSORSHIP_TIER_IDS.map((tier) => (
                  <tr key={tier} className="border-ink/10 border-t">
                    <td className="py-3 pr-3">{SPONSORSHIP_TIER_META[tier].name}</td>
                    <td className="pr-3">
                      <input
                        className="w-full border p-2 font-mono text-sm"
                        value={config.tiers[tier].planId}
                        placeholder="留空表示尚未接入"
                        disabled={busy}
                        onChange={(event) =>
                          updateTier(tier, { planId: event.target.value })
                        }
                      />
                    </td>
                    <td>
                      <input
                        className="w-full border p-2 font-mono text-sm font-semibold"
                        type="number"
                        min={1}
                        value={config.tiers[tier].minimumAmountFen}
                        disabled={busy}
                        onChange={(event) =>
                          updateTier(tier, {
                            minimumAmountFen: Number(event.target.value),
                          })
                        }
                      />
                    </td>
                    <td className="pl-3">
                      <input
                        className="w-full border p-2 font-mono text-sm font-semibold"
                        type="number"
                        min={0}
                        value={config.tiers[tier].reputationPerMonth}
                        disabled={busy}
                        onChange={(event) =>
                          updateTier(tier, {
                            reputationPerMonth: Number(event.target.value),
                          })
                        }
                      />
                    </td>
                  </tr>
                ))}
            </tbody>
          </table>
        </div>
      </section>
      <section className="border-ink/10 border-t pt-6">
        <h3 className="text-lg">订阅每日物资</h3>
        <div className="mt-3">
          <SubscriptionPlansSection
            plans={plans}
            disabled={busy || !config}
            onChange={setPlans}
          />
        </div>
      </section>
      <div className="flex gap-4">
        <InkButton variant="primary" disabled={busy || !config} onClick={() => void save()}>
          保存方案
        </InkButton>
        <InkButton
          variant="secondary"
          disabled={busy}
          onClick={() =>
            void sponsorshipRequest('/api/admin/sponsorship/ping', {
              method: 'POST',
            })
              .then(() => onNotice('爱发电连接正常'))
              .catch((error) =>
                onNotice(error instanceof Error ? error.message : '连接失败'),
              )
          }
        >
          测试连接
        </InkButton>
      </div>
    </div>
  );
}
