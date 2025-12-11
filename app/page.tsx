'use client';

import { LingGen } from '@/components/func';
import {
  InkBadge,
  InkButton,
  InkList,
  InkListItem,
  InkNotice,
  InkStatusBar,
} from '@/components/InkComponents';
import { InkPageShell, InkSection } from '@/components/InkLayout';
import { InkModal } from '@/components/InkModal';
import { useInkUI } from '@/components/InkUIProvider';
import { RecentBattles } from '@/components/RecentBattles';
import { DivineFortune } from '@/components/welcome/DivineFortune';
import { WelcomeRedirect } from '@/components/welcome/WelcomeRedirect';
import { YieldCard } from '@/components/YieldCard';
import { useAuth } from '@/lib/auth/AuthContext';
import { useCultivatorBundle } from '@/lib/hooks/useCultivatorBundle';
import Image from 'next/image';
import { usePathname } from 'next/navigation';
import { useState } from 'react';

const quickActions = [
  { label: '🧘 闭关', href: '/retreat' },
  { label: '🎒 储物袋', href: '/inventory' },
  { label: '📖 神通', href: '/skills' },
  { label: '📜 顿悟', href: '/ritual' },
  { label: '🛖 修仙坊市', href: '/market' },
  { label: '⚗️ 造物仙炉', href: '/craft' },
  { label: '🔐 神识认主', href: '/shenshi-renzhu', anonymousOnly: true },
];

function HomePageContent() {
  const pathname = usePathname();
  const { isAnonymous } = useAuth();
  const { cultivator, isLoading, note, refresh } = useCultivatorBundle();
  const { pushToast } = useInkUI();
  const spiritualRoots = cultivator?.spiritual_roots ?? [];

  const [yieldResult, setYieldResult] = useState<{
    amount: number;
    hours: number;
    story: string;
  } | null>(null);

  const maxHp = cultivator ? 100 + cultivator.attributes.vitality * 5 : 100;
  const spirit = cultivator?.attributes.spirit ?? 0;
  const maxSpirit = spirit;

  const [claiming, setClaiming] = useState(false);

  // 历练相关
  const handleClaimYield = async () => {
    if (!cultivator) return;
    setClaiming(true);

    try {
      const response = await fetch('/api/cultivators/yield', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ cultivatorId: cultivator.id }),
      });

      const result = await response.json();
      if (!response.ok || !result.success) {
        throw new Error(result.error || '领取失败');
      }

      // Show story modal/overlay
      setYieldResult({
        amount: result.data.amount,
        hours: result.data.hours,
        story: result.data.story,
      });
    } catch (error) {
      pushToast({
        message: error instanceof Error ? error.message : '领取失败',
        tone: 'danger',
      });
    } finally {
      setClaiming(false);
    }
  };

  const handleCloseYieldModal = () => {
    setYieldResult(null);
    refresh();
  };

  if (isLoading) {
    return (
      <div className="bg-paper min-h-screen flex items-center justify-center">
        <p className="loading-tip">正在推演天机……</p>
      </div>
    );
  }

  const statusItems = cultivator
    ? [
        { label: '气血：', value: maxHp, icon: '❤️' },
        { label: '灵力：', value: maxSpirit, icon: '⚡️' },
        {
          label: '性别：',
          value: cultivator.gender,
          icon: cultivator.gender === '男' ? '♂' : '♀',
        },
        {
          label: '年龄：',
          value: cultivator.age,
          icon: '⏳',
        },
        { label: '寿元：', value: cultivator.lifespan, icon: '🔮' },
      ]
    : [];

  return (
    <InkPageShell
      hero={
        <Image
          src="/assets/daoyou_logo.png"
          alt="万界道友_logo"
          width={96}
          height={96}
          className="object-contain"
        />
      }
      title="万界道友"
      subtitle="灵根歪了，但不影响我菜得理直气壮"
      note={note}
      currentPath={pathname}
      footer={<DivineFortune />}
    >
      {/* 历练收益卡片 (放在最上方) */}
      {cultivator && (
        <YieldCard
          cultivator={cultivator}
          onClaim={handleClaimYield}
          isClaiming={claiming}
        />
      )}

      <InkSection title="【道身】">
        {cultivator ? (
          <InkList dense>
            <InkListItem
              title={
                <div className="flex items-center">
                  <span>☯️ 姓名：{cultivator.name}</span>
                  <InkBadge tier={cultivator.realm}>
                    {cultivator.realm_stage}
                  </InkBadge>
                </div>
              }
              meta={
                <InkStatusBar
                  className="grid! grid-cols-3! gap-2 mt-3"
                  items={statusItems}
                />
              }
            />
            {spiritualRoots.length > 0 && (
              <InkListItem
                title="👁️ 灵根"
                meta={
                  <LingGen
                    spiritualRoots={spiritualRoots}
                    showSection={false}
                    compact={true}
                  />
                }
              />
            )}
          </InkList>
        ) : (
          <>
            <InkNotice>
              道友尚未觉醒灵根，
              <InkButton href="/create" variant="primary">
                速去觉醒
              </InkButton>
            </InkNotice>
            <InkNotice>
              曾在此修炼？
              <InkButton href="/login" variant="primary">
                召回真身
              </InkButton>
            </InkNotice>
          </>
        )}
        {cultivator && (
          <div className="mt-3">
            <InkButton href="/cultivator" className="text-sm">
              内视查探 →
            </InkButton>
          </div>
        )}
      </InkSection>

      {cultivator && (
        <InkSection title="【快捷入口】">
          <div className="flex flex-wrap gap-3">
            {quickActions
              .filter((action) => !action.anonymousOnly || isAnonymous)
              .map((action) => (
                <InkButton
                  key={action.label}
                  href={action.href}
                  className="text-sm"
                >
                  {action.label}
                </InkButton>
              ))}
          </div>
        </InkSection>
      )}

      {cultivator && (
        <InkSection title="【近期战绩】">
          <RecentBattles />
        </InkSection>
      )}
      {/* 历练结果弹窗 */}
      <InkModal
        isOpen={!!yieldResult}
        onClose={handleCloseYieldModal}
        title="历练归来"
        footer={
          <InkButton
            variant="primary"
            className="w-full"
            onClick={handleCloseYieldModal}
          >
            收入囊中
          </InkButton>
        }
      >
        <div className="prose prose-sm prose-invert max-w-none mb-6 text-foreground/90 leading-relaxed bg-ink/5 p-4 rounded-lg border border-ink/10">
          {yieldResult?.story}
        </div>

        <div className="flex justify-center items-center gap-2 mb-6">
          <span className="text-ink-secondary">获得灵石：</span>
          <span className="text-2xl font-bold text-yellow-500 flex items-center gap-1">
            💎 {yieldResult?.amount}
          </span>
        </div>
      </InkModal>
    </InkPageShell>
  );
}

export default function HomePage() {
  return (
    <WelcomeRedirect>
      <HomePageContent />
    </WelcomeRedirect>
  );
}
