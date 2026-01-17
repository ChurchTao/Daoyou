'use client';

import { ShenTong } from '@/components/func';
import { InkPageShell } from '@/components/layout';
import {
  InkActionGroup,
  InkButton,
  InkDialog,
  InkNotice,
} from '@/components/ui';
import { usePathname } from 'next/navigation';

import { useSkillsViewModel } from '../hooks/useSkillsViewModel';
import { SkillDetailModal } from './SkillDetailModal';

/**
 * 神通主视图组件
 */
export function SkillsView() {
  const pathname = usePathname();
  const {
    cultivator,
    skills,
    isLoading,
    note,
    maxSkills,
    dialog,
    closeDialog,
    selectedSkill,
    isModalOpen,
    openSkillDetail,
    closeSkillDetail,
    openForgetConfirm,
    showEffectHelp,
  } = useSkillsViewModel();

  // 加载状态
  if (isLoading && !cultivator) {
    return (
      <div className="bg-paper min-h-screen flex items-center justify-center">
        <p className="loading-tip">神通卷轴徐徐展开……</p>
      </div>
    );
  }

  return (
    <InkPageShell
      title="【所修神通】"
      subtitle={`共 ${skills.length}/${maxSkills}`}
      backHref="/game"
      note={note}
      currentPath={pathname}
      footer={
        <InkActionGroup align="between">
          <InkButton href="/game">返回</InkButton>
          <InkButton href="/game/genlightenment" variant="primary">
            藏经阁 →
          </InkButton>
        </InkActionGroup>
      }
    >
      {!cultivator ? (
        <InkNotice>还未觉醒道身，何谈神通？先去首页觉醒吧。</InkNotice>
      ) : (
        <>
          <ShenTong
            skills={skills}
            showSection={false}
            highlightLast={true}
            markLastAsNew={true}
            showActions={true}
            renderAction={(skill) => (
              <div className="flex gap-2">
                <InkButton
                  variant="secondary"
                  className="text-xs"
                  onClick={() => openSkillDetail(skill)}
                >
                  详情
                </InkButton>
                <InkButton
                  className="text-xs px-2"
                  onClick={() => openForgetConfirm(skill)}
                >
                  遗忘
                </InkButton>
              </div>
            )}
          />

          {/* 确认对话框 */}
          <InkDialog dialog={dialog} onClose={closeDialog} />

          {/* 神通详情弹窗 */}
          <SkillDetailModal
            isOpen={isModalOpen}
            onClose={closeSkillDetail}
            skill={selectedSkill}
            onShowEffectHelp={showEffectHelp}
          />
        </>
      )}
    </InkPageShell>
  );
}
