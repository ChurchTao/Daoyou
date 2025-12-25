'use client';

import { CultivatorStatusCard } from '@/components/CultivatorStatusCard';
import {
  InkBadge,
  InkButton,
  InkDialog,
  type InkDialogState,
  InkInput,
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
  { label: '🧘 洞府', href: '/retreat' },
  { label: '🎒 储物袋', href: '/inventory' },
  { label: '📖 所修神通', href: '/skills' },
  { label: '📚 藏经阁', href: '/enlightenment' },
  { label: '🛖 修仙坊市', href: '/market' },
  { label: '⚗️ 造物仙炉', href: '/craft' },
  { label: '🏔️ 云游探秘', href: '/game/dungeon' },

  { label: '📜 版本日志', href: '/changelog' },
  { label: '🔐 神识认主', href: '/shenshi-renzhu', anonymousOnly: true },
];

function HomePageContent() {
  const pathname = usePathname();
  const { isAnonymous, signOut } = useAuth();
  const {
    cultivator,
    isLoading,
    note,
    refresh,
    finalAttributes,
    unreadMailCount,
  } = useCultivatorBundle();
  const [dialog, setDialog] = useState<InkDialogState | null>(null);
  const [isTitleModalOpen, setIsTitleModalOpen] = useState(false);
  const [editingTitle, setEditingTitle] = useState('');
  const [isSavingTitle, setIsSavingTitle] = useState(false);
  const { pushToast } = useInkUI();

  const maxHp = finalAttributes?.maxHp ?? 100;
  const maxSpirit = finalAttributes?.maxMp ?? 100;

  const handleLogout = () => {
    if (isAnonymous) {
      setDialog({
        id: 'logout-confirm',
        title: '神魂出窍',
        content: (
          <div className="space-y-2">
            <p>道友现为无名散修（游客身份）。</p>
            <p className="text-crimson">
              若是此时离去，恐将迷失在虚空之中，再也无法找回这具肉身。
            </p>
            <p>确定要神魂出窍吗？</p>
          </div>
        ),
        confirmLabel: '去意已决',
        cancelLabel: '且慢',
        onConfirm: async () => {
          await signOut();
          refresh();
        },
      });
    } else {
      signOut().then(() => refresh());
    }
  };

  const openTitleEditor = () => {
    setEditingTitle(cultivator?.title || '');
    setIsTitleModalOpen(true);
  };

  const handleSaveTitle = async () => {
    if (!cultivator) return;
    if (
      editingTitle.length > 0 &&
      (editingTitle.length < 2 || editingTitle.length > 20)
    ) {
      pushToast({ message: '称号长度需在2-20字之间', tone: 'warning' });
      return;
    }

    try {
      setIsSavingTitle(true);
      const response = await fetch('/api/cultivators/title', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          cultivatorId: cultivator.id,
          title: editingTitle,
        }),
      });

      const result = await response.json();
      if (!response.ok || !result.success) {
        throw new Error(result.error || '保存失败');
      }

      pushToast({ message: '名号已定，威震八方！', tone: 'success' });
      setIsTitleModalOpen(false);
      refresh();
    } catch (error) {
      pushToast({
        message: error instanceof Error ? error.message : '保存失败',
        tone: 'danger',
      });
    } finally {
      setIsSavingTitle(false);
    }
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
      {/* 历练收益卡片 */}
      {cultivator && (
        <YieldCard cultivator={cultivator} onOk={() => refresh()} />
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
                <div className="flex items-center">
                  🏅 称号：
                  {cultivator.title ? (
                    <span className="font-bold text-ink">
                      「{cultivator.title}」
                    </span>
                  ) : (
                    '暂无'
                  )}
                  <InkButton onClick={openTitleEditor}>修改</InkButton>
                </div>
              }
              description={
                <InkStatusBar
                  className="grid! grid-cols-3! gap-2 mt-3"
                  items={statusItems}
                />
              }
            />
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
        {/* 修为状态卡片 */}
        {cultivator && cultivator.cultivation_progress && (
          <div className="mt-3">
            <CultivatorStatusCard cultivator={cultivator} />
          </div>
        )}
      </InkSection>

      {cultivator && (
        <InkSection title="【快捷入口】">
          <div className="flex flex-wrap gap-3">
            <InkButton href="/mail" className="text-sm relative">
              🔔 传音玉简
              {unreadMailCount > 0 && (
                <span className="absolute -top-0.5 -right-1 flex h-3 w-3">
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-crimson opacity-75"></span>
                  <span className="relative inline-flex rounded-full h-3 w-3 bg-crimson"></span>
                </span>
              )}
            </InkButton>

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
            <InkButton className="text-sm" onClick={handleLogout}>
              👻 神魂出窍
            </InkButton>
          </div>
        </InkSection>
      )}

      {cultivator && (
        <InkSection title="【近期战绩】">
          <RecentBattles />
        </InkSection>
      )}

      <InkDialog dialog={dialog} onClose={() => setDialog(null)} />

      <InkModal
        isOpen={isTitleModalOpen}
        onClose={() => setIsTitleModalOpen(false)}
        title="定制名号"
      >
        <div className="space-y-4 mt-4">
          <div className="text-sm opacity-80">
            行走江湖，岂能无号？
            <br />
            请为自己起一个响亮的名号（如：乱星海虫魔）。
          </div>
          <InkInput
            value={editingTitle}
            onChange={setEditingTitle}
            placeholder="在此输入名号..."
            hint="限2-8字"
          />
          <div className="flex justify-end gap-2 mt-4">
            <InkButton onClick={() => setIsTitleModalOpen(false)}>
              取消
            </InkButton>
            <InkButton
              variant="primary"
              onClick={handleSaveTitle}
              disabled={isSavingTitle}
            >
              {isSavingTitle ? '镌刻中...' : '确认修改'}
            </InkButton>
          </div>
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
