'use client';

import { InkPageShell } from '@/components/InkLayout';
import { InkButton, InkCard } from '@/components/InkComponents';
import { useCultivatorBundle } from '@/lib/hooks/useCultivatorBundle';

export default function SkillsPage() {
  const { cultivator, skills, isLoading, note, usingMock } = useCultivatorBundle();

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
      footer={
        <div className="flex justify-between text-ink">
          <InkButton href="/">返回</InkButton>
          <InkButton href="/ritual" variant="primary">
            闭关顿悟新神通 →
          </InkButton>
        </div>
      }
    >
      {!cultivator ? (
        <div className="pb-4 border-b border-ink/10 text-center">
          还未觉醒道身，何谈神通？先去首页觉醒吧。
        </div>
      ) : skills.length > 0 ? (
        <div className="space-y-2">
          {skills.map((skill, index) => {
            const typeIcon = skill.type === 'attack' ? '⚡' : 
                           skill.type === 'heal' ? '❤️' : 
                           skill.type === 'control' ? '🌀' : '✨';
            const typeName = skill.type === 'attack' ? '攻击' : 
                            skill.type === 'heal' ? '治疗' : 
                            skill.type === 'control' ? '控制' : '增益';
            
            return (
              <InkCard key={skill.id || skill.name} highlighted={index === skills.length - 1}>
                <div className="flex items-start justify-between gap-2">
                  <div className="flex-1 min-w-0">
                    <p className="font-semibold text-sm">
                      {typeIcon} {skill.name}（{typeName}·{skill.element}）
                      {index === skills.length - 1 && <span className="new-mark">← 新悟</span>}
                    </p>
                    <p className="mt-0.5 text-xs text-ink-secondary">
                      威力：{skill.power}｜效果：{skill.effect ? `${skill.effect}${skill.duration ? `（${skill.duration}回合）` : ''}` : '无特殊效果'}
                    </p>
                    {skill.cost !== undefined && skill.cost > 0 && (
                      <p className="text-xs text-ink-secondary">消耗：{skill.cost} 灵力｜冷却：{skill.cooldown}回合</p>
                    )}
                    {(!skill.cost || skill.cost === 0) && (
                      <p className="text-xs text-ink-secondary">冷却：{skill.cooldown}回合</p>
                    )}
                  </div>
                  <div className="flex-shrink-0">
                    <InkButton disabled className="text-sm">
                      替换
                    </InkButton>
                  </div>
                </div>
              </InkCard>
            );
          })}
        </div>
      ) : (
        <p className="empty-state">暂无神通，请前往闭关顿悟。</p>
      )}

      {usingMock && (
        <p className="mt-6 text-center text-xs text-ink-secondary">
          【占位】技能列表展示硬编码样例，待真实接口替换。
        </p>
      )}
    </InkPageShell>
  );
}

