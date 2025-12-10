'use client';

import Image from 'next/image';
import { usePathname } from 'next/navigation';

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
import { RecentBattles } from '@/components/RecentBattles';
import { DivineFortune } from '@/components/welcome/DivineFortune';
import { WelcomeRedirect } from '@/components/welcome/WelcomeRedirect';
import { useAuth } from '@/lib/auth/AuthContext';
import { useCultivatorBundle } from '@/lib/hooks/useCultivatorBundle';

const quickActions = [
  { label: '⚔️ 天骄榜', href: '/rankings' },
  { label: '👤 道身', href: '/cultivator' },
  { label: '🧘 闭关', href: '/retreat' },
  { label: '🎒 储物袋', href: '/inventory' },
  { label: '📖 神通', href: '/skills' },
  { label: '🔥 炼器', href: '/ritual' },
  { label: '🌀 奇遇', href: '/ritual' },
  { label: '📜 顿悟', href: '/ritual' },
  { label: '🔐 神识认主', href: '/shenshi-renzhu', anonymousOnly: true },
];

function HomePageContent() {
  const pathname = usePathname();
  const { isAnonymous } = useAuth();
  const { cultivator, isLoading, note } = useCultivatorBundle();
  const spiritualRoots = cultivator?.spiritual_roots ?? [];

  const maxHp = cultivator ? 100 + cultivator.attributes.vitality * 5 : 100;
  const spirit = cultivator?.attributes.spirit ?? 0;
  const maxSpirit = spirit;

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
