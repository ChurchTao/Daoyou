import { getAttributeDetailActionLabel } from '@app/components/feature/cultivator/attributeActionLabels';
import {
  BodyCultivationEntrySection,
  MarrowWashEntrySection,
} from '@app/components/feature/cultivator/BodyCultivationPanels';
import { CultivatorAttributeOverview } from '@app/components/feature/cultivator/CultivatorAttributeOverview';
import { CultivatorCurrentStatusSection } from '@app/components/feature/cultivator/PersistentStatusesCard';
import { TitleEditorModal } from '@app/components/feature/cultivator/TitleEditorModal';
import { useCultivatorDisplayProjection } from '@app/components/feature/cultivator/useCultivatorDisplayProjection';
import { FateDetailModal } from '@app/components/feature/fates/FateDetailModal';
import { toFateDisplayModel } from '@app/components/feature/fates/FateDisplayAdapter';
import { FateEffectInlineList } from '@app/components/feature/fates/FateEffectInlineList';
import {
  AbilityMetaLine,
  AffixInlineList,
  toProductDisplayModel,
  type ProductRecordLike,
} from '@app/components/feature/products';
import { SectIdentityDetails } from '@app/components/feature/sect/SectIdentity';
import { useActiveSectContextQuery } from '@app/components/feature/sect/sectResources';
import { useSectIdentityDialog } from '@app/components/feature/sect/useSectIdentityDialog';
import { LingGen } from '@app/components/func/LingGen';
import { useInkUI } from '@app/components/providers/InkUIProvider';
import {
  InkBadge,
  InkButton,
  InkDialog,
  InkList,
  InkNotice,
  type InkDialogState,
} from '@app/components/ui';
import { ItemCard } from '@app/components/ui/ItemCard';
import { useResourceMutation } from '@app/lib/resources/mutations';
import { CHARACTER_ATTRIBUTE_LABELS } from '@shared/lib/cultivatorDisplay';
import { cn } from '@shared/lib/cn';
import { getEquipmentSlotInfo } from '@shared/lib/gameConceptDisplay';
import type { Cultivator } from '@shared/types/cultivator';
import { useState, type ReactNode } from 'react';
import { useNavigate } from 'react-router';
import { GameLoadingState } from './GameLoadingState';
import { GameSceneSection } from './GameSceneSection';

const PRIMARY_ATTRIBUTE_HELP = [
  {
    label: CHARACTER_ATTRIBUTE_LABELS.vitality,
    description: '稳固生命根基，决定最大气血并提供少量法术防御。',
  },
  {
    label: CHARACTER_ATTRIBUTE_LABELS.strength,
    description: '凝聚筋力与兵刃威势，决定物理攻击。',
  },
  {
    label: CHARACTER_ATTRIBUTE_LABELS.spirit,
    description: '滋养术法根基，决定法术攻击并提供少量法力。',
  },
  {
    label: CHARACTER_ATTRIBUTE_LABELS.endurance,
    description: '锤炼筋骨韧性，决定物理防御并提供少量最大气血。',
  },
  {
    label: CHARACTER_ATTRIBUTE_LABELS.speed,
    description: '提升身形腾挪，主要增加闪避与行动速度，并少量增加命中。',
  },
  {
    label: CHARACTER_ATTRIBUTE_LABELS.willpower,
    description: '凝练神魂，影响法术防御、法力以及控制命中与抗性。',
  },
];

const PRIMARY_ATTRIBUTE_HELP_DIALOG = {
  title: '根基属性说明',
  content: (
    <div className="space-y-3 text-sm leading-7">
      <p className="text-ink-secondary">
        六维各有明确的主要职责，体魄与根骨额外提供少量交叉生存收益；法宝、功法与状态仍会在此基础上继续增减。
      </p>
      <div className="border-ink/15 overflow-hidden border border-dashed">
        {PRIMARY_ATTRIBUTE_HELP.map((item) => (
          <div
            key={item.label}
            className="border-ink/10 grid gap-1 border-b border-dashed px-3 py-2 last:border-b-0 sm:grid-cols-[4rem_1fr]"
          >
            <span className="text-crimson font-semibold">{item.label}</span>
            <span className="text-ink-secondary">{item.description}</span>
          </div>
        ))}
      </div>
    </div>
  ),
};

function OverviewDetailItem({
  icon,
  label,
  value,
  action,
  className,
}: {
  icon: string;
  label: string;
  value: ReactNode;
  action?: ReactNode;
  className?: string;
}) {
  return (
    <div
      className={cn(
        'flex items-start justify-between gap-3 text-sm leading-7',
        className,
      )}
    >
      <div className="flex min-w-0 flex-1 items-start gap-3">
        <span className="shrink-0 text-base leading-7" aria-hidden="true">
          {icon}
        </span>
        <div className="flex min-w-0 flex-1 flex-wrap gap-x-2 gap-y-0.5">
          <span className="text-battle-muted shrink-0">{label}</span>
          <span className="text-ink min-w-0 flex-1">{value}</span>
        </div>
      </div>
      {action ? <div className="shrink-0">{action}</div> : null}
    </div>
  );
}

export function CultivatorOverviewPanel() {
  const projection = useCultivatorDisplayProjection();
  const sectContext = useActiveSectContextQuery();
  const openSectIdentityDialog = useSectIdentityDialog();
  const cultivator = projection.data?.cultivator ?? null;
  const navigate = useNavigate();
  const { pushToast } = useInkUI();
  const { mutate } = useResourceMutation();
  const [dialog, setDialog] = useState<InkDialogState | null>(null);
  const [detailFate, setDetailFate] = useState<
    Cultivator['pre_heaven_fates'][number] | null
  >(null);
  const [isTitleModalOpen, setIsTitleModalOpen] = useState(false);
  const [editingTitle, setEditingTitle] = useState('');
  const [isSavingTitle, setIsSavingTitle] = useState(false);

  if (projection.error) return <InkNotice>{projection.error}</InkNotice>;
  if (projection.loading && !cultivator) return <InkNotice>正在读取角色属性……</InkNotice>;

  if (!cultivator) {
    return <InkNotice>尚无角色资料，先去觉醒灵根，再来凝视真形。</InkNotice>;
  }
  const inventory = cultivator.inventory;
  const skills = cultivator.skills;
  const equipped = cultivator.equipped;

  const handleReincarnate = async () => {
    try {
      await mutate(
        fetch('/api/cultivator/active-reincarnate', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({}),
        }),
      );
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
      await mutate(
        fetch('/api/cultivator/title', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            title: editingTitle,
          }),
        }),
      );

      pushToast({ message: '名号已定，威震八方！', tone: 'success' });
      setIsTitleModalOpen(false);
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

  const unallocatedAttributePoints =
    cultivator.unallocated_attribute_points ?? 0;
  const hasUnallocatedAttributePoints = unallocatedAttributePoints > 0;

  const openReincarnateDialog = () => {
    setDialog({
      id: 'reincarnate-confirm',
      title: '轮回重修',
      content: (
        <div className="space-y-2">
          <p className="text-crimson text-lg font-bold">道友当真要轮回重修？</p>
          <p>
            轮回后，当前修为将尽数散去，
            <span className="text-crimson">角色状态变为「已陨落」</span>。
          </p>
          <p>但可保留部分前世记忆（名字、故事）进入轮回，开启新的一世。</p>
          <p className="text-sm opacity-60">此操作不可撤销。</p>
        </div>
      ),
      confirmLabel: '轮回',
      cancelLabel: '不可',
      onConfirm: handleReincarnate,
    });
  };

  const equippedItems = inventory.artifacts.filter(
    (item) =>
      item.id &&
      (equipped.weapon === item.id ||
        equipped.armor === item.id ||
        equipped.accessory === item.id),
  );

  return (
    <div className="space-y-5">
      <GameSceneSection title="道身概览" contentClassName="space-y-2.5">
        <div className="space-y-1">
          <OverviewDetailItem
            icon="👤"
            label="身份"
            value={`${cultivator.name} · ${cultivator.gender} · ${cultivator.origin || '散修'}`}
          />
          <OverviewDetailItem
            icon="🏮"
            label="名号"
            value={
              cultivator.title ? (
                <span className="text-crimson">「{cultivator.title}」</span>
              ) : (
                '暂无'
              )
            }
            action={
              <InkButton onClick={openTitleEditor} className="text-sm">
                修改
              </InkButton>
            }
          />
          <OverviewDetailItem
            icon="☯️"
            label="境界"
            value={
              <InkBadge className="px-0" tier={cultivator.realm}>
                {cultivator.realm_stage}
              </InkBadge>
            }
          />
          <OverviewDetailItem
            icon="⏳"
            label="寿元"
            value={`${cultivator.age} / ${cultivator.lifespan} 年`}
          />
          <OverviewDetailItem
            icon="🫧"
            label="性情"
            value={cultivator.personality || '未明'}
          />
          <OverviewDetailItem
            icon="📜"
            label="背景"
            value={cultivator.background || '未录'}
          />
          {cultivator.balance_notes ? (
            <OverviewDetailItem
              icon="🪶"
              label="天道评语"
              value={cultivator.balance_notes}
            />
          ) : null}
        </div>
      </GameSceneSection>

      <GameSceneSection
        title="宗门玉牒"
        actions={
          sectContext.data ? (
            <InkButton onClick={openSectIdentityDialog} className="text-sm">
              查看晋升
            </InkButton>
          ) : undefined
        }
      >
        {sectContext.sessionLoading ? (
          <GameLoadingState message="宗门名册正在核验……" variant="inline" />
        ) : !sectContext.hasSect ? (
          <InkNotice>尚未拜入宗门，当前仍以散修身份行走。</InkNotice>
        ) : sectContext.error ? (
          <InkNotice>
            <p>{sectContext.error}</p>
            <InkButton onClick={() => void sectContext.retry()}>
              重新核验
            </InkButton>
          </InkNotice>
        ) : sectContext.data ? (
          <SectIdentityDetails context={sectContext.data} showJoinedAt />
        ) : (
          <GameLoadingState message="身份玉牒正在显化……" variant="inline" />
        )}
      </GameSceneSection>

      <CultivatorCurrentStatusSection />

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

      <GameSceneSection title="根基属性" help={PRIMARY_ATTRIBUTE_HELP_DIALOG}>
        <CultivatorAttributeOverview
          cultivator={cultivator}
          footerActions={
            <div>
              <InkButton
                href="/game/cultivator/attributes"
                className={cn(
                  'text-sm',
                  hasUnallocatedAttributePoints && 'relative pr-3',
                )}
              >
                {getAttributeDetailActionLabel(hasUnallocatedAttributePoints)}
                {hasUnallocatedAttributePoints ? (
                  <span
                    className="absolute top-0.5 right-1 flex h-2.5 w-2.5"
                    aria-hidden="true"
                  >
                    <span className="bg-crimson absolute inline-flex h-full w-full animate-ping rounded-full opacity-75" />
                    <span className="bg-crimson relative inline-flex h-2.5 w-2.5 rounded-full" />
                  </span>
                ) : null}
              </InkButton>
            </div>
          }
        />
      </GameSceneSection>

      <MarrowWashEntrySection />

      <BodyCultivationEntrySection />

      <GameSceneSection title="所御法宝">
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

      <GameSceneSection title="所修功法">
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

      <GameSceneSection title="所修神通">
        {skills.length === 0 ? (
          <InkNotice>尚无神通</InkNotice>
        ) : (
          <InkList>
            {skills.map((skill) => {
              const product = toProductDisplayModel(skill as ProductRecordLike);
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
        )}
      </GameSceneSection>

      <div className="bg-ink/5 rounded-sm p-2 text-right">
        <p className="text-ink-secondary text-sm leading-7">
          若此身道途已尽，可舍去此生，重入轮回。
        </p>
        <InkButton className="text-sm" onClick={openReincarnateDialog}>
          转世重修
        </InkButton>
      </div>
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
