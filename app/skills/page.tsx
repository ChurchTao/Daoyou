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

  const maxSkills = cultivator?.maxSkills ?? 3;

  return (
    <InkPageShell
      title="【所修神通】"
      subtitle={`已习 ${skills.length}/${maxSkills}`}
      backHref="/"
      note={note}
      actions={
        <Link href="/ritual" className="btn-primary btn-sm">
          闭关顿悟新神通
        </Link>
      }
      footer={
        <div className="flex justify-between text-ink">
          <Link href="/" className="hover:text-crimson">
            [返回主界]
          </Link>
          <Link href="/battle" className="hover:text-crimson">
            [阅览战报]
          </Link>
        </div>
      }
    >
      {!cultivator ? (
        <div className="rounded-lg border border-ink/10 bg-paper-light p-6 text-center">
          还未觉醒道身，何谈神通？先去首页觉醒吧。
        </div>
      ) : skills.length ? (
        <div className="space-y-4">
          {skills.map((skill, index) => (
            <div
              key={skill.name}
              className="rounded-lg border border-ink/10 bg-paper-light p-4 shadow-sm"
            >
              <div className="flex items-start justify-between gap-4">
                <div>
                  <p className="font-semibold">
                    {skill.type === 'attack'
                      ? '⚡ 攻击'
                      : skill.type === 'heal'
                        ? '❤️ 治疗'
                        : skill.type === 'control'
                          ? '🌀 控制'
                          : '✨ 增益'}{' '}
                    · {skill.name}
                    {index === skills.length - 1 && <span className="new-mark">← 新悟</span>}
                  </p>
                  <p className="text-sm text-ink-secondary">
                    威力：{skill.power}｜元素：{skill.element}
                  </p>
                  {skill.effects && (
                    <p className="text-xs text-ink-secondary">{skill.effects.join(' / ')}</p>
                  )}
                </div>
                <button className="btn-outline btn-sm" disabled>
                  [替换 · TODO]
                </button>
              </div>
            </div>
          ))}
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

