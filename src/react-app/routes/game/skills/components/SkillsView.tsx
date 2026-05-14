import { InkPageShell } from '@app/components/layout';
import {
  AbilityMetaLine, AffixInlineList, } from '@app/components/feature/products';
import {
  InkActionGroup, InkBadge, InkButton, InkDialog, InkNotice, } from '@app/components/ui';
import { ItemCard } from '@app/components/ui/ItemCard';

import { useSkillsViewModel, type V2Skill } from '../hooks/useSkillsViewModel';
import { SkillDetailModal } from './SkillDetailModal';
import { useLocation } from 'react-router';


function SkillCard({
  skill,
  onDetail,
  onForget,
}: {
  skill: V2Skill;
  onDetail: (skill: V2Skill) => void;
  onForget: (skill: V2Skill) => void;
}) {
  return (
    <ItemCard
      icon="📜"
      name={skill.name}
      quality={skill.quality}
      badgeExtra={
        <div className="flex flex-wrap gap-1">
          {skill.element && <InkBadge tone="default">{skill.element}</InkBadge>}
        </div>
      }
      meta={
        <div className="space-y-1">
          <AffixInlineList affixes={skill.affixes} />
          <AbilityMetaLine projection={skill.projection} />
        </div>
      }
      description={skill.description}
      actions={
        <div className="flex gap-2">
          <InkButton variant="secondary" onClick={() => onDetail(skill)}>
            详情
          </InkButton>
          <InkButton className="px-2" onClick={() => onForget(skill)}>
            遗忘
          </InkButton>
        </div>
      }
      layout="col"
    />
  );
}

/**
 * 神通主视图组件
 */
export function SkillsView() {
  const { pathname } = useLocation();
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
  } = useSkillsViewModel();

  if (isLoading && !cultivator) {
    return (
      <div className="bg-paper flex min-h-screen items-center justify-center">
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
          <InkButton href="/game/enlightenment" variant="primary">
            藏经阁 →
          </InkButton>
        </InkActionGroup>
      }
    >
      {!cultivator ? (
        <InkNotice>还未觉醒道身，何谈神通？先去首页觉醒吧。</InkNotice>
      ) : skills.length === 0 ? (
        <InkNotice>尚未领悟任何神通，前往藏经阁参悟吧。</InkNotice>
      ) : (
        <>
          <div className="space-y-3">
            {skills.map((skill) => (
              <SkillCard
                key={skill.id}
                skill={skill}
                onDetail={openSkillDetail}
                onForget={openForgetConfirm}
              />
            ))}
          </div>

          <InkDialog dialog={dialog} onClose={closeDialog} />

          <SkillDetailModal
            isOpen={isModalOpen}
            onClose={closeSkillDetail}
            skill={selectedSkill}
          />
        </>
      )}
    </InkPageShell>
  );
}
