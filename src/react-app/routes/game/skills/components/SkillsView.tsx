import {
  GameSceneAsideSection,
  GameSceneFrame,
  GameSceneNote,
} from '@app/components/game-shell';
import {
  AbilityDetailModal,
  AbilityListCard,
} from '@app/components/feature/products';
import {
  InkButton,
  InkDialog,
  InkNotice,
} from '@app/components/ui';

import { useSkillsViewModel } from '../hooks/useSkillsViewModel';

/**
 * 神通主视图组件
 */
export function SkillsView() {
  const {
    cultivator,
    skills,
    isLoading,
    note,
    maxSkills,
    maxOwnedSkills,
    enabledSkillCount,
    dialog,
    closeDialog,
    selectedSkill,
    isModalOpen,
    pendingToggleId,
    openSkillDetail,
    closeSkillDetail,
    toggleSkillEnabled,
    openForgetConfirm,
  } = useSkillsViewModel();

  if (isLoading && !cultivator) {
    return (
      <div className="flex h-full items-center justify-center">
        <p className="loading-tip">神通卷轴徐徐展开……</p>
      </div>
    );
  }

  return (
    <GameSceneFrame
      variant="lite"
      title="【所修神通】"
      description="攻伐、辅助与身法诸术都在这里归卷。主区只保留术册本体，旁栏集中显示容量与下一步修行去向。"
      headerMeta={
        note ? (
          <GameSceneNote>
            <p className="text-sm leading-7">{note}</p>
          </GameSceneNote>
        ) : undefined
      }
      aside={
        <>
          <GameSceneAsideSection title="术册摘要">
            <div className="space-y-2 text-sm leading-7">
              <p>已藏神通：{skills.length} / {maxOwnedSkills} 门</p>
              <p>已启用：{enabledSkillCount} / {maxSkills} 门</p>
              <p>可启用空位：{Math.max(maxSkills - enabledSkillCount, 0)} 门</p>
            </div>
          </GameSceneAsideSection>
          <GameSceneAsideSection title="下一步" className="text-sm leading-7">
            <p>想补底稿可去问法寻卷，想创造新术可直入悟道室。</p>
          </GameSceneAsideSection>
        </>
      }
    >
      {!cultivator ? (
        <InkNotice>还未觉醒道身，何谈神通？先去首页觉醒吧。</InkNotice>
      ) : skills.length === 0 ? (
        <InkNotice>尚未领悟任何神通，前往悟道室参悟吧。</InkNotice>
      ) : (
        <>
          <div className="space-y-3">
            {skills.map((skill) => (
              <AbilityListCard
                key={skill.id}
                product={skill}
                actions={
                  <div className="flex flex-wrap gap-2">
                    <InkButton variant="secondary" onClick={() => openSkillDetail(skill)}>
                      详情
                    </InkButton>
                    <InkButton
                      disabled={pendingToggleId === skill.id}
                      onClick={() => toggleSkillEnabled(skill)}
                    >
                      {pendingToggleId === skill.id
                        ? '处理中…'
                        : skill.isEquipped
                          ? '停用'
                          : '启用'}
                    </InkButton>
                    <InkButton className="px-2 text-crimson" onClick={() => openForgetConfirm(skill)}>
                      遗忘
                    </InkButton>
                  </div>
                }
              />
            ))}
          </div>

          <InkDialog dialog={dialog} onClose={closeDialog} />

          <AbilityDetailModal
            isOpen={isModalOpen}
            onClose={closeSkillDetail}
            product={selectedSkill}
          />
        </>
      )}
    </GameSceneFrame>
  );
}
