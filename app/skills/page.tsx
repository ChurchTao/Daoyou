'use client';

import { InkPageShell } from '@/components/InkLayout';
import { useCultivatorBundle } from '@/lib/hooks/useCultivatorBundle';
import Link from 'next/link';

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
          <Link href="/" className="hover:text-crimson">
            [返回]
          </Link>
          <Link href="/ritual" className="text-crimson hover:underline">
            [闭关顿悟新神通 →]
          </Link>
        </div>
      }
    >
      {!cultivator ? (
        <div className="rounded-lg border border-ink/10 bg-paper-light p-6 text-center">
          还未觉醒道身，何谈神通？先去首页觉醒吧。
        </div>
      ) : skills.length > 0 ? (
        <div className="space-y-4">
          {skills.map((skill, index) => {
            const typeIcon = skill.type === 'attack' ? '⚡' : 
                           skill.type === 'heal' ? '❤️' : 
                           skill.type === 'control' ? '🌀' : '✨';
            const typeName = skill.type === 'attack' ? '攻击' : 
                            skill.type === 'heal' ? '治疗' : 
                            skill.type === 'control' ? '控制' : '增益';
            
            return (
              <div
                key={skill.id || skill.name}
                className="rounded-lg border border-ink/10 bg-paper-light p-4 shadow-sm"
              >
                <div className="mb-3">
                  <p className="font-semibold">
                    {typeIcon} {skill.name}（{typeName}·{skill.element}）
                    {index === skills.length - 1 && <span className="new-mark">← 新悟</span>}
                  </p>
                  <p className="mt-1 text-sm text-ink-secondary">
                    威力：{skill.power}｜效果：{skill.effect ? `${skill.effect}${skill.duration ? `（${skill.duration}回合）` : ''}` : '无特殊效果'}
                  </p>
                  {skill.cost !== undefined && skill.cost > 0 && (
                    <p className="text-xs text-ink-secondary">消耗：{skill.cost} 灵力｜冷却：{skill.cooldown}回合</p>
                  )}
                  {(!skill.cost || skill.cost === 0) && (
                    <p className="text-xs text-ink-secondary">冷却：{skill.cooldown}回合</p>
                  )}
                </div>
                <div className="flex justify-end">
                  <button className="btn-outline btn-sm" disabled>
                    [替换]
                  </button>
                </div>
              </div>
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

