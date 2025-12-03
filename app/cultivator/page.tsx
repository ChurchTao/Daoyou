'use client';

import { InkButton, InkCard, InkDivider } from '@/components/InkComponents';
import { InkPageShell, InkSection } from '@/components/InkLayout';
import { useCultivatorBundle } from '@/lib/hooks/useCultivatorBundle';
import type { Attributes } from '@/types/cultivator';
import {
  formatAttributeBonusMap,
  getArtifactTypeLabel,
  getAttributeLabel,
  getSkillTypeLabel,
  getStatusLabel,
} from '@/types/dictionaries';
import { calculateFinalAttributes } from '@/utils/cultivatorUtils';

export default function CultivatorPage() {
  const { cultivator, inventory, skills, equipped, isLoading, note } =
    useCultivatorBundle();

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
          <InkButton href="/create" variant="primary">
            觉醒灵根
          </InkButton>
        }
      >
        <div className="text-center">
          尚无角色资料，先去觉醒灵根，再来凝视真形。
        </div>
      </InkPageShell>
    );
  }

  // 计算最终属性
  const finalAttrsResult = calculateFinalAttributes(cultivator);
  const finalAttrs = finalAttrsResult.final;
  const breakdown = finalAttrsResult.breakdown;
  const maxHp = 80 + finalAttrs.vitality;
  const maxMp = finalAttrs.spirit;

  const equippedItems = inventory.artifacts.filter(
    (item) =>
      item.id &&
      (equipped.weapon === item.id ||
        equipped.armor === item.id ||
        equipped.accessory === item.id),
  );

  // 获取命格属性加成说明
  const getFateModText = (fate: (typeof cultivator.pre_heaven_fates)[0]) => {
    const mods = Object.entries(fate.attribute_mod)
      .filter(([, v]) => v !== undefined && v !== 0)
      .map(([k, v]) => {
        const label = getAttributeLabel(k as keyof Attributes);
        return `${label} ${v > 0 ? '+' : ''}${v}`;
      });
    return mods.length > 0 ? mods.join('，') : '无属性加成';
  };

  // 获取装备特效描述
  const getEffectText = (
    effect: NonNullable<(typeof inventory.artifacts)[0]['special_effects']>[0],
  ) => {
    if (effect.type === 'damage_bonus') {
      return `${effect.element}系伤害 +${Math.round(effect.bonus * 100)}%`;
    }
    if (effect.type === 'on_hit_add_effect') {
      return `命中时${effect.chance}%概率附加${getStatusLabel(effect.effect)}`;
    }
    if (effect.type === 'on_use_cost_hp') {
      return `施展时消耗自身气血 ${effect.amount} 点`;
    }
    if (effect.type === 'environment_change') {
      return `改变战场环境为「${effect.env_type}」`;
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
          <InkButton href="/">← 返回主界</InkButton>
          <span className="text-ink-secondary">[推演战力]</span>
        </div>
      }
    >
      {/* 道号与境界 */}
      <InkSection title="">
        <div className="space-y-2 text-base">
          <p>☯ 道号：{cultivator.name}</p>
          <p>
            🌿 境界：{cultivator.realm}
            {cultivator.realm_stage}（{cultivator.origin || '散修'}）
          </p>
          <p>
            ⏳ 年龄：{cultivator.age} 岁 / 寿元：{cultivator.lifespan} 岁
          </p>
          <p>
            ❤️ 气血：{maxHp} / {maxHp}　⚡ 灵力：{maxMp} / {maxMp}
          </p>
        </div>
      </InkSection>

      <InkDivider />

      {/* 先天命格 */}
      {cultivator.pre_heaven_fates?.length > 0 && (
        <>
          <InkSection title="【先天命格】">
            <div className="space-y-2">
              {cultivator.pre_heaven_fates.map((fate, idx) => (
                <InkCard key={fate.name + idx} highlighted={fate.type === '吉'}>
                  <p className="font-semibold text-sm">
                    {fate.type === '吉' ? '✨' : '⚠️'} {fate.name}（{fate.type}
                    ）
                  </p>
                  <p className="mt-0.5 text-xs text-ink-secondary">
                    ——{getFateModText(fate)}
                  </p>
                  {fate.description && (
                    <p className="mt-0.5 text-xs text-ink-secondary italic">
                      {fate.description}
                    </p>
                  )}
                </InkCard>
              ))}
            </div>
          </InkSection>
          <InkDivider />
        </>
      )}

      {/* 根基属性 */}
      <InkSection title="【根基属性】">
        <div className="space-y-2 text-base">
          {Object.entries(cultivator.attributes).map(([key, baseValue]) => {
            const label = getAttributeLabel(key as keyof Attributes);
            const finalValue = finalAttrs[key as keyof Attributes];
            const fateMod = breakdown.fromFates[key as keyof Attributes];
            const cultMod = breakdown.fromCultivations[key as keyof Attributes];
            const equipMod = breakdown.fromEquipment[key as keyof Attributes];
            const hasMod = fateMod !== 0 || cultMod !== 0 || equipMod !== 0;

            return (
              <div key={key} className="space-y-1">
                <p>
                  {label}（{key}）：
                  <span
                    className={baseValue !== finalValue ? 'font-semibold' : ''}
                  >
                    {baseValue}
                  </span>
                  {hasMod && (
                    <>
                      {' → '}
                      <span className="font-semibold text-ink-accent">
                        {finalValue}
                      </span>
                      <span className="text-xs text-ink-secondary ml-2">
                        （
                        {fateMod !== 0
                          ? `命格${fateMod > 0 ? '+' : ''}${fateMod}`
                          : ''}
                        {fateMod !== 0 && cultMod !== 0 ? '，' : ''}
                        {cultMod !== 0
                          ? `功法${cultMod > 0 ? '+' : ''}${cultMod}`
                          : ''}
                        {(fateMod !== 0 || cultMod !== 0) && equipMod !== 0
                          ? '，'
                          : ''}
                        {equipMod !== 0
                          ? `装备${equipMod > 0 ? '+' : ''}${equipMod}`
                          : ''}
                        ）
                      </span>
                    </>
                  )}
                </p>
              </div>
            );
          })}
          <p className="text-xs text-ink-secondary mt-2">
            境界上限：{breakdown.cap}（当前境界：{cultivator.realm}）
          </p>
        </div>
      </InkSection>

      <InkDivider />

      {/* 当前所御法宝 */}
      <InkSection title="【当前所御法宝】">
        {equippedItems.length > 0 ? (
          <div className="space-y-2">
            {equippedItems.map((item) => {
              const slotIcon =
                item.slot === 'weapon'
                  ? '🗡️'
                  : item.slot === 'armor'
                    ? '🛡️'
                    : '📿';
              const slotName = getArtifactTypeLabel(item.slot);
              const bonusText = formatAttributeBonusMap(item.bonus);
              const effectText =
                item.special_effects?.map((e) => getEffectText(e)).join('｜') ||
                '';

              return (
                <InkCard key={item.id}>
                  <p className="font-semibold text-sm">
                    {slotIcon} {slotName}：{item.name}（{item.element}·
                    {item.slot === 'weapon'
                      ? '道器'
                      : item.slot === 'armor'
                        ? '灵器'
                        : '宝器'}
                    ）
                  </p>
                  <p className="mt-0.5 text-xs text-ink-secondary">
                    {bonusText}
                    {effectText && `｜${effectText}`}
                  </p>
                </InkCard>
              );
            })}
          </div>
        ) : (
          <p className="empty-state text-sm">尚未佩戴法宝</p>
        )}
        <div className="mt-3">
          <InkButton href="/inventory" className="text-sm">
            前往储物袋更换装备 →
          </InkButton>
        </div>
      </InkSection>

      <InkDivider />

      {/* 所修功法 */}
      <InkSection title="【所修功法】">
        {cultivator.cultivations && cultivator.cultivations.length > 0 ? (
          <div className="space-y-2">
            {cultivator.cultivations.map((cult, index) => {
              const bonusText = formatAttributeBonusMap(cult.bonus);

              return (
                <InkCard key={cult.name + index}>
                  <p className="font-semibold text-sm">📜 {cult.name}</p>
                  <p className="mt-0.5 text-xs text-ink-secondary">
                    {bonusText || '无属性加成'}
                    {cult.required_realm &&
                      `｜需求境界：${cult.required_realm}`}
                  </p>
                </InkCard>
              );
            })}
          </div>
        ) : (
          <p className="empty-state text-sm">暂无功法，待闭关参悟。</p>
        )}
      </InkSection>

      <InkDivider />

      {/* 所修神通 */}
      <InkSection title="【所修神通】">
        {skills.length > 0 ? (
          <div className="space-y-2">
            {skills.map((skill, index) => {
              const typeIcon =
                skill.type === 'attack'
                  ? '⚡'
                  : skill.type === 'heal'
                    ? '❤️'
                    : skill.type === 'control'
                      ? '🌀'
                      : '✨';
              const typeName = getSkillTypeLabel(skill.type);

              return (
                <InkCard
                  key={skill.id || skill.name}
                  highlighted={index === skills.length - 1}
                >
                  <p className="font-semibold text-sm">
                    {typeIcon} {skill.name}（{typeName}·{skill.element}）
                    {index === skills.length - 1 && (
                      <span className="new-mark">← 新悟</span>
                    )}
                  </p>
                  <p className="mt-0.5 text-xs text-ink-secondary">
                    威力：{skill.power}｜冷却：{skill.cooldown}回合
                    {skill.effect &&
                      `｜效果：${getStatusLabel(skill.effect)}${
                        skill.duration ? `（${skill.duration}回合）` : ''
                      }`}
                    {skill.cost !== undefined &&
                      skill.cost > 0 &&
                      `｜消耗：${skill.cost} 灵力`}
                  </p>
                </InkCard>
              );
            })}
          </div>
        ) : (
          <p className="empty-state text-sm">暂无神通，待闭关顿悟。</p>
        )}
        <div className="mt-3">
          <InkButton href="/ritual" className="text-sm">
            闭关顿悟新神通 →
          </InkButton>
        </div>
      </InkSection>
    </InkPageShell>
  );
}
