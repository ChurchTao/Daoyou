'use client';

import { LingGen } from '@/components/func';
import {
  toProductDisplayModel,
  type ProductRecordLike,
} from '@/components/feature/products';
import { InkPageShell, InkSection } from '@/components/layout';
import { useInkUI } from '@/components/providers/InkUIProvider';
import {
  InkActionGroup,
  InkBadge,
  InkButton,
  InkDialog,
  type InkDialogState,
  InkList,
  InkListItem,
  InkNotice,
  InkStatusBar,
} from '@/components/ui';
import { ItemCard } from '@/components/ui/ItemCard';
import { getCultivatorDisplayAttributes } from '@/engine/battle-v5/adapters/CultivatorDisplayAdapter';
import { attrLabel } from '@/engine/battle-v5/effects/affixText/attributes';
import { AttributeType } from '@/engine/battle-v5/core/types';
import { useCultivator } from '@/lib/contexts/CultivatorContext';
import { cn } from '@/lib/cn';
import { getEquipmentSlotInfo } from '@/types/dictionaries';
import { usePathname, useRouter } from 'next/navigation';
import { useState } from 'react';

const PRIMARY_ATTR_ORDER: AttributeType[] = [
  AttributeType.SPIRIT,
  AttributeType.VITALITY,
  AttributeType.SPEED,
  AttributeType.WILLPOWER,
  AttributeType.WISDOM,
];

const SECONDARY_ATTR_ORDER: AttributeType[] = [
  AttributeType.ATK,
  AttributeType.DEF,
  AttributeType.MAGIC_ATK,
  AttributeType.MAGIC_DEF,
  AttributeType.CRIT_RATE,
  AttributeType.CRIT_DAMAGE_MULT,
  AttributeType.EVASION_RATE,
  AttributeType.CONTROL_HIT,
  AttributeType.CONTROL_RESISTANCE,
  AttributeType.ARMOR_PENETRATION,
  AttributeType.MAGIC_PENETRATION,
  AttributeType.CRIT_RESIST,
  AttributeType.CRIT_DAMAGE_REDUCTION,
  AttributeType.ACCURACY,
  AttributeType.HEAL_AMPLIFY,
];

const PERCENT_ATTRS = new Set<AttributeType>([
  AttributeType.CRIT_RATE,
  AttributeType.EVASION_RATE,
  AttributeType.CONTROL_HIT,
  AttributeType.CONTROL_RESISTANCE,
  AttributeType.ARMOR_PENETRATION,
  AttributeType.MAGIC_PENETRATION,
  AttributeType.CRIT_RESIST,
  AttributeType.CRIT_DAMAGE_REDUCTION,
  AttributeType.ACCURACY,
  AttributeType.HEAL_AMPLIFY,
]);

const MULTIPLIER_ATTRS = new Set<AttributeType>([AttributeType.CRIT_DAMAGE_MULT]);

function formatAttributeValue(attrType: AttributeType, value: number): string {
  if (PERCENT_ATTRS.has(attrType)) {
    return `${(value * 100).toFixed(1)}%`;
  }
  if (MULTIPLIER_ATTRS.has(attrType)) {
    return `${value.toFixed(2)}x`;
  }
  return Number.isInteger(value) ? `${value}` : value.toFixed(2);
}

function formatModifier(attrType: AttributeType, value: number): string {
  const abs = Math.abs(value);
  const sign = value >= 0 ? '+' : '-';
  if (PERCENT_ATTRS.has(attrType)) {
    return `${sign}${(abs * 100).toFixed(1)}%`;
  }
  if (MULTIPLIER_ATTRS.has(attrType)) {
    return `${sign}${abs.toFixed(2)}x`;
  }
  const rendered = Number.isInteger(abs) ? `${abs}` : abs.toFixed(2);
  return `${sign}${rendered}`;
}

function chunkPairs<T>(items: T[]): T[][] {
  const rows: T[][] = [];
  for (let i = 0; i < items.length; i += 2) {
    rows.push(items.slice(i, i + 2));
  }
  return rows;
}

function affixToneStyle(rarityTone: string) {
  if (rarityTone === 'legendary') return { color: 'var(--color-tier-shen)' };
  if (rarityTone === 'rare') return { color: 'var(--color-tier-xian)' };
  if (rarityTone === 'info') return { color: 'var(--color-tier-zhen)' };
  return { color: 'var(--color-tier-ling)' };
}

export default function CultivatorPage() {
  const { cultivator, inventory, skills, equipped, isLoading } =
    useCultivator();
  const pathname = usePathname();
  const router = useRouter();
  const { pushToast } = useInkUI();
  const [dialog, setDialog] = useState<InkDialogState | null>(null);
  const [showAllAttributes, setShowAllAttributes] = useState(false);

  const handleReincarnate = async () => {
    if (!cultivator) return;
    try {
      const res = await fetch('/api/cultivator/active-reincarnate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({}),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || '兵解失败');

      // 成功后跳转到转世页
      router.push('/reincarnate');
    } catch (err) {
      pushToast({
        message: err instanceof Error ? err.message : '兵解失败',
        tone: 'danger',
      });
    }
  };

  if (isLoading && !cultivator) {
    return (
      <div className="bg-paper flex min-h-screen items-center justify-center">
        <p className="loading-tip">道友真形尚在凝聚……</p>
      </div>
    );
  }

  if (!cultivator) {
    return (
      <InkPageShell
        title="【道我真形】"
        subtitle="需先觉醒方可照鉴真形"
        backHref="/game"
        actions={
          <InkButton href="/game/create" variant="primary">
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
  const { unit, maxHp, maxMp } = getCultivatorDisplayAttributes(cultivator);
  const orderedAttributes = [...PRIMARY_ATTR_ORDER, ...SECONDARY_ATTR_ORDER];
  const displayAttributes = orderedAttributes.map((attrType) => {
    const baseValue = unit.attributes.getBaseValue(attrType);
    const finalValue = unit.attributes.getValue(attrType);
    const modifier = finalValue - baseValue;
    return {
      type: attrType,
      label: attrLabel(attrType),
      isPrimary: PRIMARY_ATTR_ORDER.includes(attrType),
      baseValue,
      finalValue,
      modifier,
    };
  });
  const primaryRows = displayAttributes.slice(0, PRIMARY_ATTR_ORDER.length);
  const secondaryAll = displayAttributes.slice(PRIMARY_ATTR_ORDER.length);
  const secondaryVisible = showAllAttributes
    ? secondaryAll
    : secondaryAll.slice(0, 4); // 默认展示到法防（物攻、物防、法攻、法防）
  const secondaryRows = chunkPairs(secondaryVisible);

  const equippedItems = inventory.artifacts.filter(
    (item) =>
      item.id &&
      (equipped.weapon === item.id ||
        equipped.armor === item.id ||
        equipped.accessory === item.id),
  );

  return (
    <InkPageShell
      title={`道我真形`}
      subtitle="大道五十，我遁其一"
      backHref="/game"
      currentPath={pathname}
      footer={
        <InkActionGroup align="between">
          <InkButton href="/game">返回</InkButton>
          <InkButton
            onClick={() =>
              setDialog({
                id: 'reincarnate-confirm',
                title: '轮回重修',
                content: (
                  <div className="space-y-2">
                    <p className="text-crimson text-lg font-bold">
                      道友当真要轮回重修？
                    </p>
                    <p>
                      轮回后，当前修为将尽数散去，
                      <span className="text-crimson">
                        角色状态变为「已陨落」
                      </span>
                      。
                    </p>
                    <p>
                      但可保留部分前世记忆（名字、故事）进入轮回，开启新的一世。
                    </p>
                    <p className="text-sm opacity-60">此操作不可撤销。</p>
                  </div>
                ),
                confirmLabel: '轮回',
                cancelLabel: '不可',
                onConfirm: handleReincarnate,
              })
            }
            variant="secondary"
          >
            转世重修
          </InkButton>
        </InkActionGroup>
      }
    >
      <InkSection title="【道身】">
        <InkList dense>
          <InkListItem
            title={
              <span>
                ☯ 姓名：{cultivator.name}
                <InkBadge tier={cultivator.realm} className="ml-2">
                  {cultivator.realm_stage}
                </InkBadge>
              </span>
            }
            meta={
              <div className="py-1">
                <p>身世：{cultivator.origin || '散修'}</p>
                <p>性格：{cultivator.personality}</p>
                <p>背景：{cultivator.background}</p>
                {cultivator?.balance_notes && (
                  <p>天道评语：{cultivator.balance_notes}</p>
                )}
              </div>
            }
            description={
              <InkStatusBar
                className="mt-2 grid! grid-cols-3! gap-2"
                items={[
                  { label: '年龄：', value: cultivator.age, icon: '⏳' },
                  { label: '寿元：', value: cultivator.lifespan, icon: '🔮' },
                  {
                    label: '性别：',
                    value: cultivator.gender,
                    icon: cultivator.gender === '男' ? '♂' : '♀',
                  },
                  { label: '气血：', value: maxHp, icon: '❤️' },
                  { label: '灵力：', value: maxMp, icon: '⚡️' },
                ]}
              />
            }
          />
        </InkList>
      </InkSection>

      <LingGen spiritualRoots={cultivator.spiritual_roots || []} />

      {cultivator.pre_heaven_fates?.length > 0 && (
        <InkSection title="【先天命格】">
          <InkList>
            {cultivator.pre_heaven_fates.map((fate, idx) => (
              <ItemCard
                key={fate.name + idx}
                name={fate.name}
                quality={fate.quality}
                description={fate.description}
              />
            ))}
          </InkList>
        </InkSection>
      )}

      <InkSection title="【根基属性】">
        <div className="border-ink/15 overflow-x-auto rounded border">
          <table className="border-ink/10 w-full border-collapse text-sm">
            <tbody>
              {primaryRows.map((item) => (
                <tr
                  key={item.type}
                  className="border-ink/10 border-b last:border-b-0"
                >
                  <td className="text-crimson w-[40%] py-2 pl-3 pr-2 font-semibold">
                    {item.label}
                  </td>
                  <td className="text-ink-secondary py-2 pr-3 text-right">
                    <span>{formatAttributeValue(item.type, item.baseValue)}</span>
                    {item.modifier !== 0 && (
                      <>
                        {' '}
                        <span
                          className={cn(
                            'font-semibold',
                            item.modifier > 0
                              ? 'text-emerald-700'
                              : 'text-violet-700',
                          )}
                        >
                          {formatModifier(item.type, item.modifier)}
                        </span>
                      </>
                    )}
                  </td>
                </tr>
              ))}
              {secondaryRows.map((pair, rowIdx) => (
                <tr
                  key={`sec-${rowIdx}`}
                  className="border-ink/10 border-b last:border-b-0"
                >
                  {pair.map((item, colIdx) => (
                    <td
                      key={item.type}
                      colSpan={pair.length === 1 ? 2 : 1}
                      className={cn(
                        'min-w-0 w-1/2 py-2 pl-3 pr-2 align-top',
                        colIdx === 0 &&
                          pair.length === 2 &&
                          'border-ink/10 border-r',
                      )}
                    >
                      <div className="flex min-w-0 items-baseline justify-between gap-2">
                        <span className="text-ink shrink-0">{item.label}</span>
                        <span className="text-ink-secondary min-w-0 text-right">
                          <span>
                            {formatAttributeValue(item.type, item.baseValue)}
                          </span>
                          {item.modifier !== 0 && (
                            <>
                              {' '}
                              <span
                                className={cn(
                                  'font-semibold',
                                  item.modifier > 0
                                    ? 'text-emerald-700'
                                    : 'text-violet-700',
                                )}
                              >
                                {formatModifier(item.type, item.modifier)}
                              </span>
                            </>
                          )}
                        </span>
                      </div>
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        {secondaryAll.length > 4 && (
          <div className="mt-3">
            <InkButton
              onClick={() => setShowAllAttributes((prev) => !prev)}
              className="text-sm"
            >
              {showAllAttributes ? '收起次级属性' : '展开全部属性'}
            </InkButton>
          </div>
        )}
        <p className="text-ink-secondary mt-2 text-xs">
          当前境界：{cultivator.realm}
        </p>
      </InkSection>

      <InkSection title="【当前所御法宝】">
        {equippedItems.length > 0 ? (
          <InkList>
            {equippedItems.map((item) => {
              const slotInfo = getEquipmentSlotInfo(item.slot);

              return (
                <ItemCard
                  key={item.id}
                  icon={slotInfo.icon}
                  name={item.name}
                  quality={item.quality}
                  badgeExtra={
                    <InkBadge tone="default">{`${item.element} · ${slotInfo.label}`}</InkBadge>
                  }
                  description={item.description}
                />
              );
            })}
          </InkList>
        ) : (
          <InkNotice>尚未佩戴法宝</InkNotice>
        )}
        <div className="mt-3">
          <InkButton href="/game/inventory" className="text-sm">
            前往储物袋更换装备 →
          </InkButton>
        </div>
      </InkSection>

      <InkSection title="【功法】">
        {(cultivator.cultivations || []).length === 0 ? (
          <InkNotice>尚无功法</InkNotice>
        ) : (
          <InkList>
            {cultivator.cultivations.map((technique) => {
              const product = toProductDisplayModel(technique as ProductRecordLike);
              return (
                <ItemCard
                  key={technique.id ?? technique.name}
                  icon="📘"
                  name={technique.name}
                  quality={technique.quality}
                  badgeExtra={
                    technique.element ? (
                      <InkBadge tone="default">{technique.element}</InkBadge>
                    ) : undefined
                  }
                  meta={
                    product.affixes.length > 0 ? (
                      <div className="flex flex-wrap items-center gap-1 text-xs">
                        <span className="text-ink-secondary">词缀：</span>
                        {product.affixes.map((affix) => (
                          <span
                            key={affix.id}
                            style={affixToneStyle(affix.rarityTone)}
                          >
                            {affix.isPerfect ? `极${affix.name}` : affix.name}
                          </span>
                        ))}
                      </div>
                    ) : undefined
                  }
                  description={technique.description}
                  layout="col"
                />
              );
            })}
          </InkList>
        )}
        <div className="mt-3">
          <InkButton href="/game/techniques" className="text-sm">
            所修功法一览 →
          </InkButton>
        </div>
      </InkSection>

      <InkSection title="【神通】">
        {skills.length === 0 ? (
          <InkNotice>尚无神通</InkNotice>
        ) : (
          <>
            <InkList>
              {skills.map((skill) => {
                const product = toProductDisplayModel(skill as ProductRecordLike);
                return (
                  <ItemCard
                    key={skill.id ?? skill.name}
                    icon="📜"
                    name={skill.name}
                    quality={skill.quality}
                    badgeExtra={<InkBadge tone="default">{skill.element}</InkBadge>}
                    meta={
                      <div className="space-y-1">
                        {product.affixes.length > 0 && (
                          <div className="flex flex-wrap items-center gap-1 text-xs">
                            <span className="text-ink-secondary">词缀：</span>
                            {product.affixes.map((affix) => (
                              <span
                                key={affix.id}
                                style={affixToneStyle(affix.rarityTone)}
                              >
                                {affix.isPerfect ? `极${affix.name}` : affix.name}
                              </span>
                            ))}
                          </div>
                        )}
                        <div className="text-ink-secondary flex flex-wrap gap-2 text-xs">
                          <span>法力消耗：{skill.cost ?? 0}</span>
                          <span>冷却回合：{skill.cooldown}</span>
                        </div>
                      </div>
                    }
                    description={skill.description}
                    layout="col"
                  />
                );
              })}
            </InkList>
            <div className="mt-3">
              <InkButton href="/game/skills" className="text-sm">
                所有神通一览 →
              </InkButton>
            </div>
          </>
        )}
      </InkSection>

      <InkDialog dialog={dialog} onClose={() => setDialog(null)} />
    </InkPageShell>
  );
}
