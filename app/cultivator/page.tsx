'use client';

import { InkPageShell, InkSection } from '@/components/InkLayout';
import { useCultivatorBundle } from '@/lib/hooks/useCultivatorBundle';
import Link from 'next/link';

const attributeLabels: Record<string, string> = {
  vitality: '体魄（vitality）',
  spirit: '灵力（spirit）',
  wisdom: '悟性（wisdom）',
  speed: '速度（speed）',
  willpower: '神识（willpower）',
};

export default function CultivatorPage() {
  const { cultivator, inventory, skills, equipped, isLoading, note } = useCultivatorBundle();

  if (isLoading && !cultivator) {
    return (
      <div className="bg-paper min-h-screen flex items-center justify-center">
        <p className="loading-tip">道友真形尚在凝聚……</p>
      </div>
    );
  }

  if (!cultivator) {
    return (
      <InkPageShell
        title="【道我真形】"
        subtitle="需先觉醒方可照鉴真形"
        backHref="/"
        actions={
          <Link href="/create" className="btn-primary">
            觉醒灵根
          </Link>
        }
      >
        <div className="rounded-lg border border-ink/10 bg-paper-light p-6 text-center">
          尚无角色资料，先去觉醒灵根，再来凝视真形。
        </div>
      </InkPageShell>
    );
  }

  const equippedItems = inventory.artifacts.filter(
    (item) =>
      item.id &&
      (equipped.weapon === item.id || equipped.armor === item.id || equipped.accessory === item.id),
  );

  return (
    <InkPageShell
      title={`【道我真形 · ${cultivator.name}】`}
      subtitle={`${cultivator.realm}${cultivator.realm_stage} ｜ ${cultivator.spiritual_roots[0]?.element || '无'}灵根`}
      backHref="/"
      note={note}
      actions={
        <>
          <Link href="/inventory" className="btn-outline btn-sm">
            前往储物袋
          </Link>
          <Link href="/skills" className="btn-outline btn-sm">
            查看神通
          </Link>
        </>
      }
      footer={
        <div className="flex justify-between text-ink">
          <Link href="/" className="hover:text-crimson">
            [← 返回主界]
          </Link>
          <span className="text-ink-secondary">[推演战力 · 开发中]</span>
        </div>
      }
    >
      <InkSection title="道号与根骨">
        <div className="space-y-2 text-base">
          <p>☯ 道号：{cultivator.name}</p>
          <p>🌿 境界：{cultivator.realm}{cultivator.realm_stage}（{cultivator.spiritual_roots[0]?.element || '无'}灵根）</p>
          <p>
            ❤️ 气血：{80 + cultivator.attributes.vitality}（基于体魄）
          </p>
          <p>⚡ 灵力：{cultivator.attributes.spirit}</p>
          <p>🧠 神识：{cultivator.attributes.willpower}</p>
        </div>
      </InkSection>

      {cultivator.pre_heaven_fates?.length ? (
        <InkSection title="【先天命格】">
          <div className="space-y-3">
            {cultivator.pre_heaven_fates.map((fate) => (
              <div key={fate.name} className="rounded border border-ink/10 bg-white/60 p-3">
                <p className="font-semibold">
                  ✨ {fate.name}（{fate.type}）
                </p>
                <p className="mt-1 text-sm text-ink-secondary">
                  {Object.entries(fate.attribute_mod)
                    .filter(([_, v]) => v !== undefined && v !== 0)
                    .map(([k, v]) => `${k} ${v > 0 ? '+' : ''}${v}`)
                    .join(', ') || '无属性加成'}
                </p>
                {fate.description && (
                  <p className="mt-1 text-xs text-ink-secondary italic">{fate.description}</p>
                )}
              </div>
            ))}
          </div>
        </InkSection>
      ) : null}

      <InkSection title="【根基属性】" hint="包含功法、装备、命格等所有加成后的最终属性。">
        <div className="grid grid-cols-2 gap-3">
          {Object.entries(cultivator.attributes).map(([key, value]) => (
            <div key={key} className="rounded border border-ink/10 bg-white/60 p-3">
              <p className="font-semibold">{attributeLabels[key as keyof typeof attributeLabels] ?? key}</p>
              <p className="mt-1 text-ink-secondary">{value}</p>
            </div>
          ))}
        </div>
      </InkSection>

      <InkSection title="【当前所御法宝】" hint="更多法宝请前往储物袋更换。">
        {equippedItems.length ? (
          <div className="space-y-3">
            {equippedItems.map((item) => (
              <div key={item.id} className="rounded border border-ink/10 bg-white/60 p-3">
                <p className="font-semibold">
                  {item.slot === 'weapon' ? '🗡️ 武器' : item.slot === 'armor' ? '🛡️ 护甲' : '📿 饰品'}：{item.name}
                </p>
                <p className="mt-1 text-sm text-ink-secondary">
                  {item.element}元素
                  {Object.entries(item.bonus)
                    .filter(([_, v]) => v !== undefined && v !== 0)
                    .map(([k, v]) => `${k} +${v}`)
                    .join(', ')}
                </p>
                {item.special_effects && item.special_effects.length > 0 && (
                  <p className="mt-1 text-xs text-ink-secondary">
                    特效：{item.special_effects.map(e => e.type).join(', ')}
                  </p>
                )}
              </div>
            ))}
          </div>
        ) : (
          <p className="empty-state">尚未佩戴法宝，道友速去储物袋整理。</p>
        )}
      </InkSection>

      <InkSection title="【所修神通】" hint="点击下方按钮，可赴闭关顿悟新术。">
        {skills.length ? (
          <div className="space-y-3">
            {skills.map((skill, index) => (
              <div key={skill.name} className="rounded border border-ink/10 bg-white/60 p-3">
                <p className="font-semibold">
                  {skill.type === 'attack'
                    ? '⚡ 攻击'
                    : skill.type === 'heal'
                      ? '❤️ 治疗'
                      : skill.type === 'control'
                        ? '🌀 控制'
                        : '✨ 增益'}
                  ：{skill.name}
                  {index === skills.length - 1 && <span className="new-mark">← 新悟</span>}
                </p>
                <p className="mt-1 text-sm text-ink-secondary">
                  威力：{skill.power}｜元素：{skill.element}｜冷却：{skill.cooldown}回合
                </p>
                {skill.effect && (
                  <p className="text-xs text-ink-secondary">效果：{skill.effect}{skill.duration ? `（${skill.duration}回合）` : ''}</p>
                )}
                {skill.cost !== undefined && skill.cost > 0 && (
                  <p className="text-xs text-ink-secondary">消耗：{skill.cost} 灵力</p>
                )}
              </div>
            ))}
          </div>
        ) : (
          <p className="empty-state">暂无神通，待闭关顿悟。</p>
        )}
        <div className="mt-4 text-right">
          <Link href="/ritual" className="text-crimson hover:underline">
            [闭关顿悟新神通 →]
          </Link>
        </div>
      </InkSection>
    </InkPageShell>
  );
}

