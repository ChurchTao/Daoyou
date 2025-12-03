'use client';

import {
  InkActionGroup,
  InkBadge,
  InkButton,
  InkList,
  InkListItem,
  InkNotice,
  InkTag,
} from '@/components/InkComponents';
import { InkPageShell } from '@/components/InkLayout';
import { useCultivatorBundle } from '@/lib/hooks/useCultivatorBundle';
import { getSkillTypeLabel, getStatusLabel } from '@/types/dictionaries';
import { usePathname } from 'next/navigation';

export default function SkillsPage() {
  const { cultivator, skills, isLoading, note, usingMock } =
    useCultivatorBundle();
  const pathname = usePathname();

  if (isLoading && !cultivator) {
    return (
      <div className="bg-paper min-h-screen flex items-center justify-center">
        <p className="loading-tip">神通卷轴徐徐展开……</p>
      </div>
    );
  }

  const maxSkills = cultivator?.max_skills ?? 3;

  return (
    <InkPageShell
      title="【所修神通】"
      subtitle={`共 ${skills.length}/${maxSkills}`}
      backHref="/"
      note={note}
      currentPath={pathname}
      footer={
        <InkActionGroup align="between">
          <InkButton href="/">返回</InkButton>
          <InkButton href="/ritual" variant="primary">
            闭关顿悟新神通 →
          </InkButton>
        </InkActionGroup>
      }
    >
      {!cultivator ? (
        <InkNotice>还未觉醒道身，何谈神通？先去首页觉醒吧。</InkNotice>
      ) : skills.length > 0 ? (
        <InkList>
          {skills.map((skill, index) => {
            const typeIcon =
              skill.type === 'attack'
                ? '⚡️'
                : skill.type === 'heal'
                  ? '❤️'
                  : skill.type === 'control'
                    ? '🌀'
                    : '✨';
            const typeName = getSkillTypeLabel(skill.type);

            return (
              <InkListItem
                key={skill.id || skill.name}
                title={
                  <>
                    {typeIcon} {skill.name}{' '}
                    <InkTag tone="info">{`${typeName}·${skill.element}`}</InkTag>
                    {skill.grade && (
                      <InkBadge tone="accent">{skill.grade}</InkBadge>
                    )}
                  </>
                }
                description={`威力：${skill.power}｜冷却：${skill.cooldown}回合${
                  skill.cost ? `｜消耗：${skill.cost} 灵力` : ''
                }｜效果：${
                  skill.effect
                    ? `${getStatusLabel(skill.effect)}${
                        skill.duration ? `（${skill.duration}回合）` : ''
                      }`
                    : '无'
                }`}
                highlight={index === skills.length - 1}
                newMark={index === skills.length - 1}
                actions={
                  <InkButton disabled className="text-sm">
                    替换
                  </InkButton>
                }
              />
            );
          })}
        </InkList>
      ) : (
        <InkNotice>暂无神通，请前往闭关顿悟。</InkNotice>
      )}

      {usingMock && (
        <p className="mt-6 text-center text-xs text-ink-secondary">
          【占位】技能列表展示硬编码样例，待真实接口替换。
        </p>
      )}
    </InkPageShell>
  );
}
