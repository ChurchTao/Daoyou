'use client';

import { InkPageShell, InkSection } from '@/components/InkLayout';
import { useCultivatorBundle } from '@/lib/hooks/useCultivatorBundle';
import Link from 'next/link';

const attributeLabels: Record<string, string> = {
  vitality: '体魄',
  spirit: '灵力',
  wisdom: '悟性',
  speed: '身法',
  willpower: '神识',
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

  const maxHp = 80 + cultivator.attributes.vitality;
  const equippedItems = inventory.artifacts.filter(
    (item) =>
      item.id &&
      (equipped.weapon === item.id || equipped.armor === item.id || equipped.accessory === item.id),
  );

  // 获取命格属性加成说明
  const getFateModText = (fate: typeof cultivator.pre_heaven_fates[0]) => {
    const mods = Object.entries(fate.attribute_mod)
      .filter(([, v]) => v !== undefined && v !== 0)
      .map(([k, v]) => {
        const label = attributeLabels[k as keyof typeof attributeLabels] || k;
        return `${label} ${v > 0 ? '+' : ''}${v}`;
      });
    return mods.length > 0 ? mods.join('，') : '无属性加成';
  };

  // 获取装备特效描述
  const getEffectText = (effect: NonNullable<typeof inventory.artifacts[0]['special_effects']>[0]) => {
    if (effect.type === 'damage_bonus') {
      return `${effect.element}系伤害 +${Math.round(effect.bonus * 100)}%`;
    } else if (effect.type === 'on_hit_add_effect') {
      return `命中时${effect.chance}%概率附加${effect.effect}`;
    }
    return effect.type;
  };

  return (
    <InkPageShell
      title={`【道我真形 · ${cultivator.name}】`}
      subtitle=""
      backHref="/"
      note={note}
      footer={
        <div className="flex justify-between text-ink">
          <Link href="/" className="hover:text-crimson">
            [← 返回主界]
          </Link>
          <span className="text-ink-secondary">[推演战力]</span>
        </div>
      }
    >
      {/* 道号与境界 */}
      <InkSection title="">
        <div className="space-y-2 text-base">
          <p>☯ 道号：{cultivator.name}</p>
          <p>🌿 境界：{cultivator.realm}{cultivator.realm_stage}（{cultivator.origin || '散修'}）</p>
          <p>❤️ 气血：{maxHp} / {maxHp}　⚡ 灵力：{cultivator.attributes.spirit} / {cultivator.attributes.spirit}</p>
        </div>
      </InkSection>

      <div className="divider">
        <span className="divider-line">──────────────────────────────</span>
      </div>

      {/* 先天命格 */}
      {cultivator.pre_heaven_fates?.length > 0 && (
        <>
          <InkSection title="【先天命格】">
            <div className="space-y-3">
              {cultivator.pre_heaven_fates.map((fate, idx) => (
                <div key={fate.name + idx} className="rounded border border-ink/10 bg-white/60 p-3">
                  <p className="font-semibold">
                    {fate.type === '吉' ? '✨' : '⚠️'} {fate.name}（{fate.type}）
                  </p>
                  <p className="mt-1 text-sm text-ink-secondary">
                    ——{getFateModText(fate)}
                  </p>
                  {fate.description && (
                    <p className="mt-1 text-xs text-ink-secondary italic">{fate.description}</p>
                  )}
                </div>
              ))}
            </div>
          </InkSection>

          <div className="divider">
            <span className="divider-line">──────────────────────────────</span>
          </div>
        </>
      )}

      {/* 根基属性 */}
      <InkSection title="【根基属性】">
        <div className="space-y-2 text-base">
          {Object.entries(cultivator.attributes).map(([key, value]) => {
            const label = attributeLabels[key as keyof typeof attributeLabels] || key;
            // 检查是否有命格加成
            const hasMod = cultivator.pre_heaven_fates?.some(f => 
              f.attribute_mod[key as keyof typeof f.attribute_mod] !== undefined
            );
            return (
              <p key={key}>
                {label}（{key}）：{value}
                {hasMod && <span className="text-xs text-ink-secondary ml-2">← 受命格加成</span>}
              </p>
            );
          })}
        </div>
      </InkSection>

      <div className="divider">
        <span className="divider-line">──────────────────────────────</span>
      </div>

      {/* 当前所御法宝 */}
      <InkSection title="【当前所御法宝】">
        {equippedItems.length > 0 ? (
          <div className="space-y-3">
            {equippedItems.map((item) => {
              const slotIcon = item.slot === 'weapon' ? '🗡️' : item.slot === 'armor' ? '🛡️' : '📿';
              const slotName = item.slot === 'weapon' ? '武器' : item.slot === 'armor' ? '护甲' : '饰品';
              const bonusText = Object.entries(item.bonus)
                .filter(([, v]) => v !== undefined && v !== 0)
                .map(([k, v]) => {
                  const label = attributeLabels[k as keyof typeof attributeLabels] || k;
                  return `+${label} ${v}`;
                })
                .join('｜');
              const effectText = item.special_effects?.map(e => getEffectText(e)).join('｜') || '';
              
              return (
                <div key={item.id} className="rounded border border-ink/10 bg-white/60 p-3">
                  <p className="font-semibold">
                    {slotIcon} {slotName}：{item.name}（{item.element}·{item.slot === 'weapon' ? '道器' : item.slot === 'armor' ? '灵器' : '宝器'}）
                  </p>
                  <p className="mt-1 text-sm text-ink-secondary">
                    {bonusText}
                    {effectText && `｜${effectText}`}
                  </p>
                </div>
              );
            })}
          </div>
        ) : (
          <p className="empty-state">尚未佩戴法宝</p>
        )}
        <div className="mt-4">
          <Link href="/inventory" className="text-crimson hover:underline">
            [前往储物袋更换装备 →]
          </Link>
        </div>
      </InkSection>

      <div className="divider">
        <span className="divider-line">──────────────────────────────</span>
      </div>

      {/* 所修神通 */}
      <InkSection title="【所修神通】">
        {skills.length > 0 ? (
          <div className="space-y-3">
            {skills.map((skill, index) => {
              const typeIcon = skill.type === 'attack' ? '⚡' : 
                             skill.type === 'heal' ? '❤️' : 
                             skill.type === 'control' ? '🌀' : '✨';
              const typeName = skill.type === 'attack' ? '攻击' : 
                              skill.type === 'heal' ? '治疗' : 
                              skill.type === 'control' ? '控制' : '增益';
              
              return (
                <div key={skill.id || skill.name} className="rounded border border-ink/10 bg-white/60 p-3">
                  <p className="font-semibold">
                    {typeIcon} {skill.name}（{typeName}·{skill.element}）
                    {index === skills.length - 1 && <span className="new-mark">← 新悟</span>}
                  </p>
                  <p className="mt-1 text-sm text-ink-secondary">
                    威力：{skill.power}｜冷却：{skill.cooldown}回合
                    {skill.effect && `｜效果：${skill.effect}${skill.duration ? `（${skill.duration}回合）` : ''}`}
                    {skill.cost !== undefined && skill.cost > 0 && `｜消耗：${skill.cost} 灵力`}
                  </p>
                </div>
              );
            })}
          </div>
        ) : (
          <p className="empty-state">暂无神通，待闭关顿悟。</p>
        )}
        <div className="mt-4">
          <Link href="/ritual" className="text-crimson hover:underline">
            [闭关顿悟新神通 →]
          </Link>
        </div>
      </InkSection>
    </InkPageShell>
  );
}

