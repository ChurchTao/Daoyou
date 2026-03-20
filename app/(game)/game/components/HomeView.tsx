'use client';

import { CultivatorStatusCard } from '@/components/feature/cultivator/CultivatorStatusCard';
import { LifespanStatusCard } from '@/components/feature/cultivator/LifespanStatusCard';
import { YieldCard } from '@/components/feature/cultivator/YieldCard';
import { DivineFortune } from '@/components/feature/home/DivineFortune';
import { RecentBattles } from '@/components/feature/ranking/RecentBattles';
import { WorldChatPreview } from '@/components/feature/world-chat/WorldChatPreview';
import { InkPageShell, InkSection } from '@/components/layout';
import {
  InkBadge,
  InkButton,
  InkDialog,
  InkList,
  InkListItem,
  InkNotice,
  InkStatusBar,
} from '@/components/ui';
import { usePathname } from 'next/navigation';

import { useHomeViewModel } from '../hooks/useHomeViewModel';
import { ActivePersistentBuffs } from './ActivePersistentBuffs';
import { QuickActionsGrid } from './QuickActionsGrid';
import { TitleEditorModal } from './TitleEditorModal';

// 提升静态 JSX 到组件外部，避免每次渲染重新创建
const HERO_IMAGE = (
  <img
    src="/assets/daoyou_logo.png"
    alt="万界道友_logo"
    width={108}
    height={108}
    className="object-contain drop-shadow-lg"
  />
);

/**
 * 首页主视图组件
 */
export function HomeView() {
  const pathname = usePathname();
  const {
    cultivator,
    isLoading,
    note,
    unreadMailCount,
    isAnonymous,
    statusItems,
    dialog,
    closeDialog,
    isTitleModalOpen,
    editingTitle,
    isSavingTitle,
    openTitleEditor,
    closeTitleEditor,
    setEditingTitle,
    handleSaveTitle,
    handleLogout,
    refresh,
  } = useHomeViewModel();

  // 加载状态
  if (isLoading) {
    return (
      <div className="bg-paper flex min-h-screen items-center justify-center">
        <p className="loading-tip">正在推演天机……</p>
      </div>
    );
  }

  return (
    <InkPageShell
      hero={HERO_IMAGE}
      title="万界道友"
      subtitle="灵根歪了，但不影响我菜得理直气壮"
      note={note}
      currentPath={pathname}
      footer={<DivineFortune />}
    >
      {/* 激活的持久Buff状态 */}
      <ActivePersistentBuffs />

      {/* 历练收益卡片 */}
      {cultivator && (
        <YieldCard cultivator={cultivator} onOk={() => refresh()} />
      )}

      {/* 道身区块 */}
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
                    <span className="text-ink font-bold">
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
                  className="mt-3 grid! grid-cols-2! gap-2"
                  items={statusItems}
                />
              }
            />

            {/* 今日寿元消耗状态 */}
            {cultivator.id && (
              <LifespanStatusCard cultivatorId={cultivator.id} />
            )}
          </InkList>
        ) : (
          <>
            <InkNotice>
              道友尚未觉醒灵根，
              <InkButton href="/game/create" variant="primary">
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
            <CultivatorStatusCard cultivator={cultivator} showTitle={false} />
          </div>
        )}
      </InkSection>

      {/* 快捷入口 */}
      {cultivator && (
        <InkSection title="【快捷入口】">
          <QuickActionsGrid
            isAnonymous={isAnonymous}
            unreadMailCount={unreadMailCount}
            onLogout={handleLogout}
          />
        </InkSection>
      )}

      {/* 世界传音 */}
      {cultivator && (
        <InkSection title="【世界传音】">
          <WorldChatPreview />
        </InkSection>
      )}

      {/* 近期战绩 */}
      {cultivator && (
        <InkSection title="【近期战绩】">
          <RecentBattles />
        </InkSection>
      )}

      {/* 对话框 */}
      <InkDialog dialog={dialog} onClose={closeDialog} />

      {/* 称号编辑弹窗 */}
      <TitleEditorModal
        isOpen={isTitleModalOpen}
        onClose={closeTitleEditor}
        editingTitle={editingTitle}
        setEditingTitle={setEditingTitle}
        isSaving={isSavingTitle}
        onSave={handleSaveTitle}
      />
    </InkPageShell>
  );
}
