import { GameIcon } from '@app/components/ui/GameIcon';
import { InkButton } from '@app/components/ui/InkButton';
import { InkInput } from '@app/components/ui/InkInput';
import { cn } from '@app/lib/cn';
import {
  SPONSORSHIP_TIER_IDS,
  SPONSORSHIP_TIER_META,
  type SponsorshipTierId,
} from '@daoyou/game-domain/sponsorship';
import { useState } from 'react';
import { MeritRewardList } from './MeritRewardList';
import { MeritTierCard } from './MeritTierCard';
import type { MeritClientConfig } from './meritTypes';

export function MeritOffer({
  config,
  recipientName,
  busy,
  publicListing,
  claimCode,
  pendingCheckoutUrl,
  onPublicListing,
  onClaimCode,
  onClaim,
  onCheckout,
}: {
  config: MeritClientConfig | null;
  recipientName: string;
  busy: boolean;
  publicListing: boolean;
  claimCode: string;
  pendingCheckoutUrl: string | null;
  onPublicListing: (checked: boolean) => void;
  onClaimCode: (value: string) => void;
  onClaim: () => void;
  onCheckout: (tier: SponsorshipTierId) => void;
}) {
  const [picked, setPicked] = useState<SponsorshipTierId | null>(null);
  const selected =
    picked ??
    SPONSORSHIP_TIER_IDS.find((tier) => config?.tiers[tier].configured) ??
    'faint_light';
  const offer = config?.tiers[selected];
  const reputation = offer?.reputationPerMonth ?? 0;
  const supply = offer?.supply ?? null;

  return (
    <div className="space-y-6">
      {pendingCheckoutUrl && (
        <p className="border-crimson/35 bg-crimson/[0.025] border-l-2 px-4 py-3 text-sm">
          支付窗口未打开？
          <a
            className="ml-2 underline"
            href={pendingCheckoutUrl}
            target="_blank"
            rel="noreferrer"
          >
            点击此处继续前往爱发电
          </a>
        </p>
      )}
      {!config?.enabled ? (
        <p className="border-ink/15 text-ink-secondary border-y border-dashed py-3 text-sm">
          续添功德暂未开放；已有功德与站外订单认领不受影响。
        </p>
      ) : null}
      <div className="grid items-start gap-6 md:grid-cols-[13rem_minmax(0,1fr)]">
        <div className="border-ink/15 border-y">
          {SPONSORSHIP_TIER_IDS.map((tier) => {
            const item = config?.tiers[tier];
            const active = tier === selected;
            return (
              <button
                key={tier}
                type="button"
                className={cn(
                  'border-ink/15 flex w-full items-baseline justify-between gap-3 border-b border-l-2 px-1 py-3 text-left last:border-b-0',
                  active
                    ? 'border-l-current pl-3'
                    : 'text-ink-secondary border-l-transparent',
                )}
                onClick={() => setPicked(tier)}
              >
                <span className="text-sm">
                  {SPONSORSHIP_TIER_META[tier].name}
                </span>
                <span className="shrink-0 text-xs">
                  <GameIcon value="🏵️" /> 每月
                  <span className="font-mono font-semibold tracking-tight">
                    {' '}
                    {(item?.reputationPerMonth ?? 0).toLocaleString('zh-CN')}
                  </span>
                </span>
              </button>
            );
          })}
        </div>
        <MeritTierCard
          tier={selected}
          action={
            <div className="flex flex-wrap items-center gap-x-5 gap-y-3">
              <InkButton
                variant="outline"
                className="!px-0 !text-current"
                disabled={busy || !config?.enabled || !offer?.configured}
                onClick={() => onCheckout(selected)}
              >
                落印结缘
              </InkButton>
              <label className="text-ink-secondary flex items-center gap-2 text-xs leading-5">
                <input
                  type="checkbox"
                  checked={publicListing}
                  className="size-3.5 accent-[#a51f18]"
                  onChange={(event) => onPublicListing(event.target.checked)}
                />
                完成后公开留名
              </label>
            </div>
          }
        >
          <div className="space-y-4">
            <p className="text-sm">本次功德与声望归入：{recipientName}</p>
            <div>
              <p className="text-xs tracking-[0.14em] opacity-60">结缘即得</p>
              <p className="mt-1">
                <GameIcon value="🏵️" /> 声望
                <span className="font-mono font-semibold tracking-tight">
                  {' '}
                  {reputation.toLocaleString('zh-CN')}
                </span>
                <span className="opacity-75"> / 月 × 订阅月数</span>
              </p>
            </div>
            {supply && supply.dailyRewards.length > 0 ? (
              <div>
                <p className="text-xs tracking-[0.14em] opacity-60">
                  每日寄到传音
                </p>
                <div className="mt-2">
                  <MeritRewardList rewards={supply.dailyRewards} />
                </div>
                <p className="mt-2 text-xs opacity-75">
                  首次订阅归入本次角色；已有同一爱发电方案的订阅，续费沿用原受益角色。需换人可联系管理员转移订阅。
                </p>
              </div>
            ) : null}
          </div>
        </MeritTierCard>
      </div>
      <section className="border-ink/20 grid items-end gap-4 border-t border-dashed pt-6 md:grid-cols-[minmax(0,1fr)_auto]">
        <InkInput
          label="站外订单认领码"
          value={claimCode}
          onChange={onClaimCode}
          placeholder="爱发电私信中的认领码"
          disabled={busy}
        />
        <InkButton
          variant="outline"
          pending={busy}
          disabled={!claimCode.trim()}
          onClick={onClaim}
        >
          认领至当前角色
        </InkButton>
      </section>
    </div>
  );
}
