import { MeritStamp } from '@app/components/feature/merit/MeritStamp';
import { GameSceneFrame } from '@app/components/game-shell';
import { useInkUI } from '@app/components/providers/InkUIProvider';
import { InkButton } from '@app/components/ui/InkButton';
import { InkInput } from '@app/components/ui/InkInput';
import { usePlayerMailSummary } from '@app/lib/resources/player';
import {
  SPONSORSHIP_TIER_IDS,
  SPONSORSHIP_TIER_META,
  type SponsorshipTierId,
} from '@shared/lib/sponsorship';
import { useCallback, useEffect, useRef, useState } from 'react';
import { MeritTierCard } from './components/MeritTierCard';
import { MeritWall, type MeritPublicRow } from './components/MeritWall';

type Tab = 'mine' | 'world' | 'support';
type ClientConfig = {
  enabled: boolean;
  fulfillmentEnabled: boolean;
  tiers: Record<
    SponsorshipTierId,
    {
      name: string;
      theme: string;
      configured: boolean;
      minimumAmountFen: number;
    }
  >;
};
type MeritState = {
  profile: {
    isPublic: boolean;
    highestTier: SponsorshipTierId;
    firstSupportedAt: string;
    lastSupportedAt: string;
    meritCount: number;
  } | null;
  records: { id: string; tier: SponsorshipTierId; supportedAt: string }[];
  pending: {
    id: string;
    tier: SponsorshipTierId;
    status: string;
    expiresAt: string;
    createdAt: string;
  }[];
};
function formatMonth(value: string): string {
  return new Intl.DateTimeFormat('zh-CN', {
    year: 'numeric',
    month: '2-digit',
  }).format(new Date(value));
}

async function readJson<T>(response: Response): Promise<T> {
  const data = await response.json();
  if (!response.ok) throw new Error(data.error ?? '请求失败');
  return data as T;
}

async function fetchWorld(): Promise<MeritPublicRow[]> {
  const pageSize = 50;
  const first = await readJson<{ items: MeritPublicRow[]; total: number }>(
    await fetch(`/api/sponsorship/public?page=1&pageSize=${pageSize}`),
  );
  const totalPages = Math.ceil(first.total / pageSize);
  const remaining = await Promise.all(
    Array.from({ length: totalPages - 1 }, async (_, index) =>
      readJson<{ items: MeritPublicRow[]; total: number }>(
        await fetch(
          `/api/sponsorship/public?page=${index + 2}&pageSize=${pageSize}`,
        ),
      ),
    ),
  );
  return [first, ...remaining].flatMap((page) => page.items);
}

export default function MeritLedgerPage() {
  const { pushToast } = useInkUI();
  const mailSummary = usePlayerMailSummary();
  const [tab, setTab] = useState<Tab>('mine');
  const [config, setConfig] = useState<ClientConfig | null>(null);
  const [mine, setMine] = useState<MeritState | null>(null);
  const [world, setWorld] = useState<MeritPublicRow[]>([]);
  const [publicListing, setPublicListing] = useState(true);
  const [claimCode, setClaimCode] = useState('');
  const [pendingCheckoutUrl, setPendingCheckoutUrl] = useState<string | null>(
    null,
  );
  const [busy, setBusy] = useState(false);
  const pollingGeneration = useRef(0);

  const load = useCallback(async () => {
    const [nextConfig, nextMine, nextWorld] = await Promise.all([
      readJson<ClientConfig>(await fetch('/api/sponsorship/config')),
      readJson<MeritState>(await fetch('/api/sponsorship/me')),
      fetchWorld(),
    ]);
    setConfig(nextConfig);
    setMine(nextMine);
    setWorld(nextWorld);
    setPublicListing(nextMine.profile?.isPublic ?? true);
  }, []);

  useEffect(() => {
    void (async () => {
      try {
        await load();
      } catch (error) {
        pushToast({
          message: error instanceof Error ? error.message : '功德簿加载失败',
          tone: 'danger',
        });
      }
    })();
  }, [load, pushToast]);

  useEffect(
    () => () => {
      pollingGeneration.current += 1;
    },
    [],
  );

  const updateVisibility = async (checked: boolean) => {
    setPublicListing(checked);
    if (!mine?.profile) return;
    try {
      await readJson(
        await fetch('/api/sponsorship/me/visibility', {
          method: 'PATCH',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify({ isPublic: checked }),
        }),
      );
      await load();
    } catch (error) {
      setPublicListing(!checked);
      pushToast({
        message: error instanceof Error ? error.message : '公开设置更新失败',
        tone: 'danger',
      });
    }
  };

  const claim = async () => {
    if (!claimCode.trim()) return;
    setBusy(true);
    try {
      await readJson(
        await fetch('/api/sponsorship/claims', {
          method: 'POST',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify({ code: claimCode.trim(), publicListing }),
        }),
      );
      setClaimCode('');
      await load();
      await mailSummary.reload();
      setTab('mine');
      pushToast({ message: '功德已归入当前角色，感谢同行', tone: 'success' });
    } catch (error) {
      pushToast({
        message: error instanceof Error ? error.message : '认领失败',
        tone: 'danger',
      });
    } finally {
      setBusy(false);
    }
  };

  const checkout = async (tier: SponsorshipTierId) => {
    const generation = ++pollingGeneration.current;
    setBusy(true);
    try {
      const intent = await readJson<{ id: string; checkoutUrl: string }>(
        await fetch('/api/sponsorship/checkout-intents', {
          method: 'POST',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify({ tier, publicListing }),
        }),
      );
      setPendingCheckoutUrl(intent.checkoutUrl);
      window.open(intent.checkoutUrl, '_blank', 'noopener,noreferrer');
      pushToast({
        message: '已发起爱发电支付；若窗口未打开，请点击页面中的备用链接',
        tone: 'success',
      });
      for (let attempt = 0; attempt < 60; attempt += 1) {
        await new Promise((resolve) => window.setTimeout(resolve, 3_000));
        if (pollingGeneration.current !== generation) return;
        const status = await readJson<{ status: string }>(
          await fetch(`/api/sponsorship/checkout-intents/${intent.id}`),
        );
        if (status.status === 'fulfilled') {
          await load();
          await mailSummary.reload();
          setTab('mine');
          pushToast({
            message: '功德已记，谢信已送至传音玉简',
            tone: 'success',
          });
          return;
        }
      }
      pushToast({
        message: '暂未收到支付结果；订单仍会由后台继续核对，无需重复支付',
        tone: 'warning',
      });
    } catch (error) {
      pushToast({
        message: error instanceof Error ? error.message : '发起支持失败',
        tone: 'danger',
      });
    } finally {
      if (pollingGeneration.current === generation) setBusy(false);
    }
  };

  return (
    <GameSceneFrame
      variant="default"
      title="功德簿"
      description="不记灵石多寡，只录同行之缘。每笔支持留下一页功德与一封无附件谢信。"
      contentClassName="!mt-4"
    >
      <nav
        aria-label="功德簿页签"
        className="border-ink/20 mb-6 flex flex-wrap gap-x-5 gap-y-2 border-b border-dashed pb-3"
      >
        {(
          [
            ['mine', '我的功德'],
            ['world', '天下功德'],
            ['support', '续添功德'],
          ] as const
        ).map(([id, label]) => (
          <InkButton
            key={id}
            variant={tab === id ? 'primary' : 'ghost'}
            className="text-base"
            onClick={() => setTab(id)}
          >
            {label}
          </InkButton>
        ))}
      </nav>

      {tab === 'mine' && (
        <div className="space-y-6">
          {mine?.profile ? (
            <MeritTierCard
              tier={mine.profile.highestTier}
              eyebrow="当前角色功德总卡"
            >
              <p className="text-sm leading-6">
                初录于 {formatMonth(mine.profile.firstSupportedAt)}
              </p>
            </MeritTierCard>
          ) : (
            <div className="border-ink/20 bg-ink/[0.025] border-l-2 px-5 py-8">
              <p className="text-lg">此页尚待落印</p>
              <p className="text-ink-secondary mt-2 text-sm leading-7">
                当前角色尚未在功德簿留名，同行之缘自下一笔开始记述。
              </p>
            </div>
          )}

          <label className="border-ink/15 flex items-start gap-3 border-y border-dashed py-4 text-sm leading-7">
            <input
              type="checkbox"
              checked={publicListing}
              className="mt-1.5 size-4 accent-[#a51f18]"
              onChange={(event) => void updateVisibility(event.target.checked)}
            />
            <span className="min-w-0">
              <span className="block text-base">向天下道友公开此页留名</span>
              <span className="text-ink-secondary block text-xs leading-6">
                仅展示角色名、称号、境界、最高档位与首次支持月份。
              </span>
            </span>
          </label>

          {mine?.pending.length ? (
            <section className="border-crimson/35 bg-crimson/[0.025] border-l-2 px-4 py-3">
              <p className="text-sm font-medium">尚有功德正在核验</p>
              {mine.pending.map((item) => (
                <p key={item.id} className="text-ink-secondary mt-1 text-xs">
                  {SPONSORSHIP_TIER_META[item.tier].name} ·
                  请勿重复支付，结果会自动续入此页
                </p>
              ))}
            </section>
          ) : null}

          <section>
            <div className="mb-2 flex items-baseline justify-between gap-4">
              <h3 className="text-base font-medium tracking-[0.12em]">册页</h3>
              <span className="text-ink-secondary text-xs">按时间由近及远</span>
            </div>
            {mine?.records.map((record) => (
              <div
                key={record.id}
                className="border-ink/15 group flex items-center justify-between gap-4 border-b py-3 text-sm"
              >
                <span className="flex min-w-0 items-center gap-3">
                  <MeritStamp
                    tier={record.tier}
                    className="size-8 shrink-0 opacity-75"
                  />
                  <span>{SPONSORSHIP_TIER_META[record.tier].name}</span>
                </span>
                <span className="text-ink-secondary shrink-0 text-xs">
                  {new Date(record.supportedAt).toLocaleDateString('zh-CN')}
                </span>
              </div>
            ))}
          </section>
        </div>
      )}

      {tab === 'world' && <MeritWall rows={world} />}

      {tab === 'support' && (
        <div className="space-y-7">
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
          <label className="flex items-start gap-3 text-sm leading-7">
            <input
              type="checkbox"
              checked={publicListing}
              className="mt-1.5 size-4 accent-[#a51f18]"
              onChange={(event) => setPublicListing(event.target.checked)}
            />
            <span>
              <span className="block text-base">本次功德完成后公开留名</span>
              <span className="text-ink-secondary block text-xs leading-6">
                默认开启，只公开角色基础信息与最高档位，不公开金额和次数。
              </span>
            </span>
          </label>
          <div className="grid gap-4 md:grid-cols-2">
            {SPONSORSHIP_TIER_IDS.map((tier) => {
              const item = config?.tiers[tier];
              return (
                <MeritTierCard
                  key={tier}
                  tier={tier}
                  action={
                    <InkButton
                      variant="outline"
                      className="!px-0 !text-current"
                      disabled={busy || !config?.enabled || !item?.configured}
                      onClick={() => void checkout(tier)}
                    >
                      落印结缘
                    </InkButton>
                  }
                >
                  <p className="max-w-48 opacity-65">
                    一纸落印，只记同行，不添战力与数值。
                  </p>
                </MeritTierCard>
              );
            })}
          </div>
          <section className="border-ink/20 grid items-end gap-4 border-t border-dashed pt-6 md:grid-cols-[minmax(0,1fr)_auto]">
            <InkInput
              label="站外订单认领码"
              value={claimCode}
              onChange={(value) => setClaimCode(value.toUpperCase())}
              placeholder="请输入爱发电私信中的功德认领码"
              disabled={busy}
            />
            <InkButton
              variant="outline"
              pending={busy}
              disabled={!claimCode.trim()}
              onClick={() => void claim()}
            >
              认领至当前角色
            </InkButton>
          </section>
        </div>
      )}
    </GameSceneFrame>
  );
}
