import { CultivatorStatusCard } from '@app/components/feature/cultivator/CultivatorStatusCard';
import { LifespanStatusCard } from '@app/components/feature/cultivator/LifespanStatusCard';
import { PersistentStatusesCard } from '@app/components/feature/cultivator/PersistentStatusesCard';
import { TitleEditorModal } from '@app/components/feature/cultivator/TitleEditorModal';
import { FateDetailModal } from '@app/components/feature/fates/FateDetailModal';
import { toFateDisplayModel } from '@app/components/feature/fates/FateDisplayAdapter';
import { FateEffectInlineList } from '@app/components/feature/fates/FateEffectInlineList';
import {
  AbilityMetaLine,
  AffixInlineList,
  toProductDisplayModel,
  type ProductRecordLike,
} from '@app/components/feature/products';
import { LingGen } from '@app/components/func';
import { useInkUI } from '@app/components/providers/InkUIProvider';
import {
  InkBadge,
  InkButton,
  InkDialog,
  InkList,
  InkListItem,
  InkNotice,
  InkStatusBar,
  type InkDialogState,
} from '@app/components/ui';
import { ItemCard } from '@app/components/ui/ItemCard';
import { useCultivator } from '@app/lib/contexts/CultivatorContext';
import { getCultivatorDisplayAttributes } from '@shared/engine/battle-v5/adapters/CultivatorDisplayAdapter';
import { AttributeType } from '@shared/engine/battle-v5/core/types';
import { attrLabel } from '@shared/engine/battle-v5/effects/affixText/attributes';
import { cn } from '@shared/lib/cn';
import type { Cultivator } from '@shared/types/cultivator';
import { getEquipmentSlotInfo } from '@shared/types/dictionaries';
import { useState } from 'react';
import { useNavigate } from 'react-router';
import { GameSceneSection } from './GameSceneSection';

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

const MULTIPLIER_ATTRS = new Set<AttributeType>([
  AttributeType.CRIT_DAMAGE_MULT,
]);

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

export function CultivatorOverviewPanel() {
  const { cultivator, inventory, skills, equipped, refreshCultivator } =
    useCultivator();
  const navigate = useNavigate();
  const { pushToast } = useInkUI();
  const [dialog, setDialog] = useState<InkDialogState | null>(null);
  const [detailFate, setDetailFate] = useState<
    Cultivator['pre_heaven_fates'][number] | null
  >(null);
  const [showAllAttributes, setShowAllAttributes] = useState(false);
  const [isTitleModalOpen, setIsTitleModalOpen] = useState(false);
  const [editingTitle, setEditingTitle] = useState('');
  const [isSavingTitle, setIsSavingTitle] = useState(false);

  if (!cultivator) {
    return <InkNotice>尚无角色资料，先去觉醒灵根，再来凝视真形。</InkNotice>;
  }

  const handleReincarnate = async () => {
    try {
      const res = await fetch('/api/cultivator/active-reincarnate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({}),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || '兵解失败');
      navigate('/game/reincarnate');
    } catch (err) {
      pushToast({
        message: err instanceof Error ? err.message : '兵解失败',
        tone: 'danger',
      });
    }
  };

  const handleSaveTitle = async () => {
    if (
      editingTitle.length > 0 &&
      (editingTitle.length < 2 || editingTitle.length > 20)
    ) {
      pushToast({ message: '称号长度需在2-20字之间', tone: 'warning' });
      return;
    }

    try {
      setIsSavingTitle(true);
      const response = await fetch('/api/cultivator/title', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          title: editingTitle,
        }),
      });

      const result = await response.json();
      if (!response.ok || !result.success) {
        throw new Error(result.error || '保存失败');
      }

      pushToast({ message: '名号已定，威震八方！', tone: 'success' });
      setIsTitleModalOpen(false);
      await refreshCultivator();
    } catch (error) {
      pushToast({
        message: error instanceof Error ? error.message : '保存失败',
        tone: 'danger',
      });
    } finally {
      setIsSavingTitle(false);
    }
  };

  const openTitleEditor = () => {
    setEditingTitle(cultivator.title || '');
    setIsTitleModalOpen(true);
  };

  const { unit, maxHp, maxMp } = getCultivatorDisplayAttributes(cultivator);
  const orderedAttributes = [...PRIMARY_ATTR_ORDER, ...SECONDARY_ATTR_ORDER];
  const displayAttributes = orderedAttributes.map((attrType) => {
    const baseValue = unit.attributes.getBaseValue(attrType);
    const finalValue = unit.attributes.getValue(attrType);
    const modifier = finalValue - baseValue;
    return {
      type: attrType,
      label: attrLabel(attrType),
      baseValue,
      modifier,
    };
  });
  const primaryRows = displayAttributes.slice(0, PRIMARY_ATTR_ORDER.length);
  const secondaryAll = displayAttributes.slice(PRIMARY_ATTR_ORDER.length);
  const secondaryVisible = showAllAttributes
    ? secondaryAll
    : secondaryAll.slice(0, 4);
  const secondaryRows = chunkPairs(secondaryVisible);

  const equippedItems = inventory.artifacts.filter(
    (item) =>
      item.id &&
      (equipped.weapon === item.id ||
        equipped.armor === item.id ||
        equipped.accessory === item.id),
  );

  return (
    <div className="space-y-6">
      <InkList dense>
        <InkListItem
          title={
            <div className="flex items-center gap-2">
              <span>☯ 姓名：{cultivator.name}</span>
              <InkBadge tier={cultivator.realm}>
                {cultivator.realm_stage}
              </InkBadge>
            </div>
          }
          meta={
            <div className="space-y-1 py-1 text-sm">
              <div className="flex items-center gap-2">
                <span>
                  称号：
                  {cultivator.title ? (
                    <span className="text-crimson">「{cultivator.title}」</span>
                  ) : (
                    '暂无'
                  )}
                </span>
                <InkButton onClick={openTitleEditor}>修改</InkButton>
              </div>
              <p>身世：{cultivator.origin || '散修'}</p>
              <p>性格：{cultivator.personality}</p>
              <p>背景：{cultivator.background}</p>
              {cultivator.balance_notes ? (
                <p>天道评语：{cultivator.balance_notes}</p>
              ) : null}
            </div>
          }
          description={
            <InkStatusBar
              className="mt-2 grid! grid-cols-2! gap-2 md:grid-cols-3!"
              items={[
                { label: '年龄：', value: cultivator.age, icon: '⏳' },
                { label: '寿元：', value: cultivator.lifespan, icon: '🔮' },
                {
                  label: '性别：',
                  value: cultivator.gender,
                  icon: cultivator.gender === '男' ? '♂' : '♀',
                },
                {
                  label: '灵石：',
                  value: cultivator.spirit_stones,
                  icon: '💎',
                },
              ]}
            />
          }
        />
        {cultivator.id ? (
          <LifespanStatusCard cultivatorId={cultivator.id} />
        ) : null}
      </InkList>

      <PersistentStatusesCard />

      {cultivator.cultivation_progress ? (
        <GameSceneSection title="修为与感悟">
          <CultivatorStatusCard cultivator={cultivator} showDetails={true} />
        </GameSceneSection>
      ) : null}

      <LingGen
        spiritualRoots={cultivator.spiritual_roots || []}
        title="灵根"
        sectionVariant="scene"
      />

      {cultivator.pre_heaven_fates?.length > 0 ? (
        <GameSceneSection title="先天命格">
          <InkList>
            {cultivator.pre_heaven_fates.map((fate, idx) => {
              const fateDisplay = toFateDisplayModel(fate);
              return (
                <ItemCard
                  key={fate.name + idx}
                  name={fate.name}
                  quality={fate.quality}
                  meta={
                    <FateEffectInlineList lines={fateDisplay.previewLines} />
                  }
                  description={fate.description}
                  actions={
                    <InkButton
                      variant="secondary"
                      onClick={() => setDetailFate(fate)}
                    >
                      详情
                    </InkButton>
                  }
                  layout="col"
                />
              );
            })}
          </InkList>
        </GameSceneSection>
      ) : null}

      <GameSceneSection title="根基属性">
        <div className="border-ink/15 overflow-x-auto border border-dashed">
          <table className="border-ink/10 w-full border-collapse text-sm">
            <tbody>
              {primaryRows.map((item) => (
                <tr
                  key={item.type}
                  className="border-ink/10 border-b border-dashed last:border-b-0"
                >
                  <td className="text-crimson w-[40%] py-2 pr-2 pl-3 font-semibold">
                    {item.label}
                  </td>
                  <td className="text-ink-secondary py-2 pr-3 text-right">
                    {formatAttributeValue(item.type, item.baseValue)}
                    {item.modifier !== 0 ? (
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
                    ) : null}
                  </td>
                </tr>
              ))}
              {secondaryRows.map((pair, rowIdx) => (
                <tr
                  key={`sec-${rowIdx}`}
                  className="border-ink/10 border-b border-dashed last:border-b-0"
                >
                  {pair.map((item, colIdx) => (
                    <td
                      key={item.type}
                      colSpan={pair.length === 1 ? 2 : 1}
                      className={cn(
                        'w-1/2 min-w-0 py-2 pr-2 pl-3 align-top',
                        colIdx === 0 &&
                          pair.length === 2 &&
                          'border-ink/10 border-r border-dashed',
                      )}
                    >
                      <div className="flex min-w-0 items-baseline justify-between gap-2">
                        <span className="text-ink shrink-0">{item.label}</span>
                        <span className="text-ink-secondary min-w-0 text-right">
                          {formatAttributeValue(item.type, item.baseValue)}
                          {item.modifier !== 0 ? (
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
                          ) : null}
                        </span>
                      </div>
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        {secondaryAll.length > 4 ? (
          <div className="mt-3">
            <InkButton
              onClick={() => setShowAllAttributes((prev) => !prev)}
              className="text-sm"
            >
              {showAllAttributes ? '收起次级属性' : '展开全部属性'}
            </InkButton>
          </div>
        ) : null}
      </GameSceneSection>

      <GameSceneSection title="当前所御法宝">
        {equippedItems.length > 0 ? (
          <InkList>
            {equippedItems.map((item) => {
              const product = toProductDisplayModel(item as ProductRecordLike);
              const slotInfo = getEquipmentSlotInfo(item.slot);

              return (
                <ItemCard
                  key={item.id}
                  icon={slotInfo.icon}
                  name={item.name}
                  quality={item.quality}
                  badgeExtra={
                    <>
                      <InkBadge tone="default">{item.element}</InkBadge>
                      <InkBadge tone="default">{slotInfo.label}</InkBadge>
                    </>
                  }
                  meta={
                    <div className="space-y-1">
                      <AffixInlineList affixes={product.affixes} />
                      <div className="text-ink-secondary flex flex-wrap gap-2 text-sm">
                        <span className="text-ink font-medium">已装备</span>
                      </div>
                    </div>
                  }
                  description={item.description}
                  layout="col"
                />
              );
            })}
          </InkList>
        ) : (
          <InkNotice>尚未佩戴法宝</InkNotice>
        )}
      </GameSceneSection>

      <GameSceneSection title="功法">
        {(cultivator.cultivations || []).length === 0 ? (
          <InkNotice>尚无功法</InkNotice>
        ) : (
          <InkList>
            {cultivator.cultivations.map((technique) => {
              const product = toProductDisplayModel(
                technique as ProductRecordLike,
              );
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
                  meta={<AffixInlineList affixes={product.affixes} />}
                  description={technique.description}
                  layout="col"
                />
              );
            })}
          </InkList>
        )}
      </GameSceneSection>

      <GameSceneSection title="神通">
        {skills.length === 0 ? (
          <InkNotice>尚无神通</InkNotice>
        ) : (
          <>
            <InkList>
              {skills.map((skill) => {
                const product = toProductDisplayModel(
                  skill as ProductRecordLike,
                );
                return (
                  <ItemCard
                    key={skill.id ?? skill.name}
                    icon="📜"
                    name={skill.name}
                    quality={skill.quality}
                    badgeExtra={
                      <InkBadge tone="default">{skill.element}</InkBadge>
                    }
                    meta={
                      <div className="space-y-1">
                        <AffixInlineList affixes={product.affixes} />
                        <AbilityMetaLine projection={product.projection} />
                      </div>
                    }
                    description={skill.description}
                    layout="col"
                  />
                );
              })}
            </InkList>
            <div className="mt-3 flex flex-wrap gap-2">
              <InkButton href="/game/skills" className="text-sm">
                所有神通一览 →
              </InkButton>
              <InkButton
                variant="secondary"
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
              >
                转世重修
              </InkButton>
            </div>
          </>
        )}
      </GameSceneSection>

      <InkDialog dialog={dialog} onClose={() => setDialog(null)} />
      <FateDetailModal
        isOpen={detailFate !== null}
        onClose={() => setDetailFate(null)}
        fate={detailFate}
      />
      <TitleEditorModal
        isOpen={isTitleModalOpen}
        onClose={() => setIsTitleModalOpen(false)}
        editingTitle={editingTitle}
        setEditingTitle={setEditingTitle}
        isSaving={isSavingTitle}
        onSave={() => void handleSaveTitle()}
      />
    </div>
  );
}
