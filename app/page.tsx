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
];

const dailyQuotes = [
  { quote: '天地不仁，以万物为刍狗。', question: '道友，今日可要逆天改命？' },
  { quote: '道可道，非常道。', question: '名可名，非常名。' },
  {
    quote: '上善若水，水善利万物而不争。',
    question: '处众人之所恶，故几于道。',
  },
  { quote: '大道无形，生育天地。', question: '大道无情，运行日月。' },
];

const getDailyQuote = () => {
  const day = new Date().getDate();
  return dailyQuotes[day % dailyQuotes.length];
};

export default function HomePage() {
  const pathname = usePathname();
  const { cultivator, isLoading, note } = useCultivatorBundle();
  const dailyQuote = getDailyQuote();
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
      footer={
        <div className="text-center">
          <p className="my-2 text-lg italic">{dailyQuote.quote}</p>
          <p className="text-lg">{dailyQuote.question}</p>
        </div>
      }
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
          <InkNotice>
            道友尚未觉醒灵根，
            <InkButton href="/create" variant="primary">
              速去觉醒
            </InkButton>
          </InkNotice>
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
            {quickActions.map((action) => (
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
