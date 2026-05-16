import { GameSceneAsideSection, GameSceneFrame } from '@app/components/game-shell';
import {
  AbilityMetaLine, AffixInlineList, } from '@app/components/feature/products';
import {
  InkActionGroup, InkBadge, InkButton, InkDialog, InkNotice, } from '@app/components/ui';
import { ItemCard } from '@app/components/ui/ItemCard';

import { useSkillsViewModel, type V2Skill } from '../hooks/useSkillsViewModel';
import { SkillDetailModal } from './SkillDetailModal';

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
          <div className="battle-note">
            <p className="text-sm leading-7">{note}</p>
          </div>
        ) : undefined
      }
      aside={
        <>
          <GameSceneAsideSection title="术册摘要">
            <div className="space-y-2 text-sm leading-7">
              <p>已习神通：{skills.length} 门</p>
              <p>可承道基：{maxSkills} 门</p>
              <p>剩余空位：{Math.max(maxSkills - skills.length, 0)} 门</p>
            </div>
          </GameSceneAsideSection>
          <GameSceneAsideSection title="下一步" className="text-sm leading-7">
            <p>想补底稿可去问法寻卷，想创造新术可直入藏经阁。</p>
          </GameSceneAsideSection>
        </>
      }
      actionBar={
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
    </GameSceneFrame>
  );
}
