'use client';

import { GongFa } from '@/components/func';
import { InkPageShell } from '@/components/layout';
import {
  InkActionGroup,
  InkButton,
  InkDialog,
  InkNotice,
} from '@/components/ui';
import { usePathname } from 'next/navigation';

import { useTechniquesViewModel } from '../hooks/useTechniquesViewModel';
import { TechniqueDetailModal } from './TechniqueDetailModal';

/**
 * 功法主视图组件
 */
export function TechniquesView() {
  const pathname = usePathname();
  const {
    cultivator,
    techniques,
    isLoading,
    note,
    dialog,
    closeDialog,
    selectedTechnique,
    isModalOpen,
    openTechniqueDetail,
    closeTechniqueDetail,
    openForgetConfirm,
    showEffectHelp,
  } = useTechniquesViewModel();

  // 加载状态
  if (isLoading && !cultivator) {
    return (
      <div className="bg-paper min-h-screen flex items-center justify-center">
        <p className="loading-tip">功法卷轴徐徐展开……</p>
      </div>
    );
  }

  return (
    <InkPageShell
      title="【所修功法】"
      subtitle={`共 ${techniques.length} 部`}
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
        <InkNotice>还未觉醒道身，何谈功法？先去首页觉醒吧。</InkNotice>
      ) : (
        <>
          <GongFa
            cultivations={techniques}
            showSection={false}
            showActions={true}
            renderAction={(technique) => (
              <div className="flex gap-2">
                <InkButton
                  variant="secondary"
                  className="text-sm"
                  onClick={() => openTechniqueDetail(technique)}
                >
                  详情
                </InkButton>
                <InkButton
                  className="text-sm px-2"
                  onClick={() => openForgetConfirm(technique)}
                >
                  遗忘
                </InkButton>
              </div>
            )}
          />

          {/* 确认对话框 */}
          <InkDialog dialog={dialog} onClose={closeDialog} />

          {/* 功法详情弹窗 */}
          <TechniqueDetailModal
            isOpen={isModalOpen}
            onClose={closeTechniqueDetail}
            technique={selectedTechnique}
          />
        </>
      )}
    </InkPageShell>
  );
}
