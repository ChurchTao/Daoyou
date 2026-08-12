import {
  NpcConversation,
  useConversationSession,
} from '@app/components/feature/room';
import {
  SectNpcConversationRegistry,
  SectRoutedRoom,
  SectTaskLocationConversation,
  type SectNpcConversationRendererProps,
} from '@app/components/feature/sect/room';
import { SectAbilityDetails } from '@app/components/feature/sect/SectAbilityDetails';
import {
  buildSectProgressionState,
  getSectDefinition,
  getSectPresentationForContext,
  useSectContextQuery,
  useSectProgressionQuery,
} from '@app/components/feature/sect/sectResources';
import { createSectRoomNpcHref } from '@app/components/feature/sect/sectRoomNavigation';
import { useInkUI } from '@app/components/providers/InkUIProvider';
import { InkButton, InkCard, InkNotice } from '@app/components/ui';
import { InkDetailDrawer } from '@app/components/ui/InkDetailDrawer';
import { useResourceMutation } from '@app/lib/resources/mutations';
import { useCultivatorIdentity } from '@app/lib/resources/player';
import {
  createAbilitySlots,
  isListedSectAbility,
  STANDARD_SECT_PRESENTATION,
  StandardSectRules,
  type CultivatorSectState,
  type SectAbilitySlots,
} from '@shared/engine/sect';
import { resolveSectAbilities } from '@shared/engine/sect/content';
import { useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router';
import {
  SectPageLoading,
  SectPermissionBoundary,
  SectScene,
} from '../components/SectScene';

const EMPTY_SLOTS: SectAbilitySlots = createAbilitySlots([]);
type AbilityLoadoutDraft = {
  slots: SectAbilitySlots;
  baseKey: string;
};

const abilitySlotsKey = (slots: readonly (string | null)[]) =>
  JSON.stringify(slots);

const json = (method: string, body: unknown): RequestInit => ({
  method,
  headers: {
    'Content-Type': 'application/json',
    'Idempotency-Key': crypto.randomUUID(),
  },
  body: JSON.stringify(body),
});

export default function SectAbilitiesPage() {
  return (
    <SectPermissionBoundary permission="sect.arena.use" sceneKey="arena">
      <SectArenaBody />
    </SectPermissionBoundary>
  );
}

const arenaRegistry = new SectNpcConversationRegistry([
  { key: 'sect.arena.loadout', renderer: ArenaInstructorConversation },
  { key: 'sect.arena.marshal', renderer: ArenaMarshalConversation },
  { key: 'sect.arena.tournament', renderer: SectTaskLocationConversation },
]).assertRoom(STANDARD_SECT_PRESENTATION.rooms.arena);

function SectArenaBody() {
  const [searchParams] = useSearchParams();
  if (searchParams.get('workspace') === 'loadout') return <SectAbilitiesBody />;
  return (
    <SectScene sceneKey="arena" mood="arena">
      <SectRoutedRoom
        roomKey="arena"
        registry={arenaRegistry}
        eyebrow="演武阵台 · 神通校验"
      />
    </SectScene>
  );
}

function ArenaInstructorConversation({
  actor,
  onExit,
}: SectNpcConversationRendererProps) {
  const context = useSectContextQuery();
  const progression = useSectProgressionQuery();
  const navigate = useNavigate();
  const session = useConversationSession({
    sessionKey: actor.id,
    snapshot: { context: context.data, progression: progression.data },
    perform: async () => undefined,
  });
  const sect =
    context.data && progression.data
      ? buildSectProgressionState(context.data, progression.data)
      : undefined;
  const selectedAbilityCount =
    sect?.abilityLoadout.filter((id): id is string => Boolean(id)).length ?? 0;
  return (
    <NpcConversation
      actor={actor}
      messages={[
        { id: 'greeting', speaker: actor.name, body: actor.greeting },
        ...(sect
          ? [
              {
                id: 'loadout',
                speaker: actor.name,
                body: selectedAbilityCount
                  ? `你当前主动栏中已有${selectedAbilityCount}门神通，自动战术也可一并校正。`
                  : '你的主动神通栏尚空，可以入阵重新配置。',
              } as const,
            ]
          : []),
      ]}
      options={[
        { id: 'workspace', label: '请教习为我开启演武阵' },
        { id: 'leave', label: '弟子告退', tone: 'muted' },
      ]}
      busy={session.phase === 'loading'}
      error={session.error ?? context.error ?? progression.error}
      onSelectOption={(optionId) => {
        if (optionId === 'leave') onExit();
        else if (optionId === 'workspace')
          navigate(
            createSectRoomNpcHref(
              '/game/sect/arena?workspace=loadout',
              actor.roleKey,
            ),
          );
      }}
    />
  );
}

function ArenaMarshalConversation({
  actor,
  onExit,
}: SectNpcConversationRendererProps) {
  return (
    <NpcConversation
      actor={actor}
      messages={[
        { id: 'greeting', speaker: actor.name, body: actor.greeting },
        {
          id: 'ring',
          speaker: actor.name,
          body: '若已接下宗门小比，去场中的宗门擂台核对对手名录即可。',
        },
      ]}
      options={[{ id: 'leave', label: '弟子告退', tone: 'muted' }]}
      onSelectOption={onExit}
    />
  );
}

function SectAbilitiesBody() {
  const context = useSectContextQuery();
  const progression = useSectProgressionQuery();
  const profile = useCultivatorIdentity();
  const error = context.error ?? progression.error ?? profile.error;
  const sect =
    context.data && progression.data
      ? buildSectProgressionState(context.data, progression.data)
      : undefined;
  const definition = context.data ? getSectDefinition(context.data) : undefined;
  const presentation = getSectPresentationForContext(context.data);
  const serverSlots = createAbilitySlots(sect?.abilityLoadout ?? EMPTY_SLOTS);
  const serverSlotsKey = abilitySlotsKey(serverSlots);
  const [loadoutDraft, setLoadoutDraft] = useState<AbilityLoadoutDraft | null>(
    null,
  );
  const draftSlots = loadoutDraft?.slots ?? serverSlots;
  const [pickerOpen, setPickerOpen] = useState(false);
  const [expandedAbilityId, setExpandedAbilityId] = useState<string | null>(
    null,
  );
  const [busy, setBusy] = useState(false);
  const cultivator = profile.data?.cultivator;
  const { mutate } = useResourceMutation();
  const { pushToast } = useInkUI();

  const details =
    sect && definition && cultivator
      ? resolveSectAbilities({ sect, realm: cultivator.realm })
      : [];
  const activeDetails = details.filter((detail) =>
    definition?.abilities.some(
      (ability) =>
        ability.id === detail.id &&
        ability.kind === 'active' &&
        isListedSectAbility(ability),
    ),
  );
  const defaultDetail = details.find(
    (detail) =>
      definition?.abilities.find((ability) => ability.id === detail.id)
        ?.kind === 'default',
  );
  const foundationDetail = details.find(
    (detail) => detail.id === definition?.foundationPassiveId,
  );
  const selected = draftSlots.filter((id): id is string => id !== null);
  const changed = loadoutDraft !== null;
  const loadoutConflict =
    loadoutDraft !== null && loadoutDraft.baseKey !== serverSlotsKey;
  const path = definition?.paths.find(
    (entry) => entry.id === sect?.activePathId,
  );
  const pathState = sect?.paths.find(
    (entry) => entry.pathId === sect.activePathId,
  );

  const updateDraftSlots = (slots: readonly (string | null)[]) => {
    const nextSlots = createAbilitySlots(slots);
    if (abilitySlotsKey(nextSlots) === serverSlotsKey) {
      setLoadoutDraft(null);
      return;
    }
    setLoadoutDraft((current) => ({
      slots: nextSlots,
      baseKey: current?.baseKey ?? serverSlotsKey,
    }));
  };

  const save = async () => {
    if (!sect || !changed) return;
    if (loadoutConflict) {
      pushToast({
        message: '宗门神通配置已在其他操作中更新，请先载入最新配置',
        tone: 'warning',
      });
      return;
    }
    setBusy(true);
    try {
      await mutate<{ sect: CultivatorSectState }>(
        fetch(
          '/api/sects/current/ability-loadout',
          json('PUT', { abilityIds: draftSlots }),
        ),
      );
      setLoadoutDraft(null);
      pushToast({ message: '宗门神通配置已保存', tone: 'success' });
    } catch (reason) {
      pushToast({
        message: reason instanceof Error ? reason.message : '神通栏保存失败',
        tone: 'danger',
      });
    } finally {
      setBusy(false);
    }
  };

  const toggle = (abilityId: string) => {
    if (!sect || busy) return;
    if (selected.includes(abilityId)) {
      updateDraftSlots(
        createAbilitySlots(selected.filter((id) => id !== abilityId)),
      );
      return;
    }
    if (selected.length >= StandardSectRules.activeAbilitySlotCount) {
      pushToast({
        message: `最多选择${StandardSectRules.activeAbilitySlotCount}门宗门神通`,
        tone: 'danger',
      });
      return;
    }
    updateDraftSlots(createAbilitySlots([...selected, abilityId]));
  };

  const setTactic = async (tacticId: string) => {
    if (!sect?.activePathId) return;
    setBusy(true);
    try {
      await mutate<{ sect: CultivatorSectState }>(
        fetch(
          `/api/sects/current/paths/${sect.activePathId}/tactic`,
          json('PUT', { tacticId }),
        ),
      );
      pushToast({ message: '自动战术已切换', tone: 'success' });
    } catch (reason) {
      pushToast({
        message: reason instanceof Error ? reason.message : '战术切换失败',
        tone: 'danger',
      });
    } finally {
      setBusy(false);
    }
  };

  if ((!context.data || !progression.data || !profile.data) && !error)
    return <SectPageLoading sceneKey="arena" />;
  return (
    <SectScene
      sceneKey="arena"
      error={error}
      mood="plain"
      aside={
        definition ? (
          <div className="space-y-2 text-sm leading-7">
            <p>宗门：{definition.name}</p>
            <p>流派：{path?.name ?? '尚未激活'}</p>
            <p>
              战术：
              {path?.tactics.find((entry) => entry.id === pathState?.tacticId)
                ?.name ?? '默认'}
            </p>
          </div>
        ) : undefined
      }
    >
      <div>
        {!sect || !definition ? (
          <InkNotice>尚未拜入宗门。</InkNotice>
        ) : (
          <>
            {foundationDetail ? (
              <InkCard>
                <strong>《{foundationDetail.name}》</strong>
                <span className="text-ink-secondary ml-2 text-sm">
                  宗门根基 · 入宗即得 · 不占主动栏
                </span>
                <p className="mt-2 text-sm leading-6">
                  {foundationDetail.summary}
                </p>
              </InkCard>
            ) : null}
            {defaultDetail ? (
              <InkCard className={foundationDetail ? 'mt-3' : undefined}>
                <strong>《{defaultDetail.name}》</strong>
                <span className="text-ink-secondary ml-2 text-sm">
                  默认神通 · 不占主动栏
                </span>
                <p className="mt-2 text-sm leading-6">
                  {defaultDetail.summary}
                </p>
                <SectAbilityDetails detail={defaultDetail} />
              </InkCard>
            ) : null}
            <InkCard className="mt-3">
              <h3 className="text-lg font-semibold">
                {StandardSectRules.activeAbilitySlotCount}个主动栏
              </h3>
              <p className="text-ink-secondary mt-1 text-sm">
                从神通卷中快捷选择至多
                {StandardSectRules.activeAbilitySlotCount}
                门，确认后统一保存配置。
              </p>
              <div className="mt-3 grid grid-cols-2 gap-2 md:grid-cols-4">
                {draftSlots.map((abilityId, index) => {
                  const detail = abilityId
                    ? details.find((item) => item.id === abilityId)
                    : undefined;
                  return (
                    <div
                      key={index}
                      className="bg-ink/5 min-h-20 p-3 text-left text-sm"
                    >
                      <span className="block text-xs tracking-wider">
                        槽位 {index + 1}
                      </span>
                      <strong className="mt-1 block">
                        {detail?.name ?? '空槽'}
                      </strong>
                      {abilityId ? (
                        <InkButton
                          variant="secondary"
                          disabled={busy}
                          className="mt-1 px-0 text-sm"
                          onClick={() => toggle(abilityId)}
                        >
                          移除
                        </InkButton>
                      ) : null}
                    </div>
                  );
                })}
              </div>
              <div className="mt-3 flex flex-wrap items-center gap-2">
                <InkButton
                  disabled={busy || selected.length === 0}
                  onClick={() => updateDraftSlots(EMPTY_SLOTS)}
                >
                  清空全部
                </InkButton>
                <InkButton disabled={busy} onClick={() => setPickerOpen(true)}>
                  选择神通
                </InkButton>
                <InkButton
                  variant="primary"
                  disabled={!changed}
                  pending={busy}
                  pendingLabel="保存中……"
                  onClick={() => void save()}
                >
                  保存配置
                </InkButton>
                {loadoutConflict ? (
                  <>
                    <span className="text-crimson text-sm">
                      配置已在其他操作中更新
                    </span>
                    <InkButton
                      variant="secondary"
                      disabled={busy}
                      onClick={() => setLoadoutDraft(null)}
                    >
                      载入最新配置
                    </InkButton>
                  </>
                ) : changed ? (
                  <span className="text-crimson text-sm">配置尚未保存</span>
                ) : null}
              </div>
            </InkCard>
            {path && pathState ? (
              <InkCard className="mt-4">
                <h3 className="font-semibold">自动战术</h3>
                <div className="mt-2 grid gap-2 md:grid-cols-3">
                  {path.tactics.map((tactic) => (
                    <button
                      type="button"
                      key={tactic.id}
                      disabled={busy}
                      onClick={() => void setTactic(tactic.id)}
                      className={`p-3 text-left text-sm leading-6 ${pathState.tacticId === tactic.id ? 'bg-crimson/10 text-crimson' : 'bg-ink/5'}`}
                    >
                      <strong>{tactic.name}</strong>
                      <br />
                      {tactic.description}
                    </button>
                  ))}
                </div>
              </InkCard>
            ) : null}

            <InkDetailDrawer
              isOpen={pickerOpen}
              onClose={() => setPickerOpen(false)}
              title="选择宗门神通"
              description="配置出战神通并查看当前流派与经脉下的实际效果。"
              size="xl"
              footer={
                <div className="flex items-center justify-between gap-3">
                  <span className="text-ink-secondary text-sm">
                    已选 {selected.length} /{' '}
                    {StandardSectRules.activeAbilitySlotCount}
                  </span>
                  <InkButton
                    variant="primary"
                    onClick={() => setPickerOpen(false)}
                  >
                    完成选择
                  </InkButton>
                </div>
              }
            >
              <div className="space-y-2">
                {activeDetails.map((detail) => {
                  const isSelected = selected.includes(detail.id);
                  const limitReached =
                    selected.length >=
                      StandardSectRules.activeAbilitySlotCount && !isSelected;
                  const expanded = expandedAbilityId === detail.id;
                  return (
                    <div
                      key={detail.id}
                      className={`border-ink/10 w-full border-l-2 p-3 text-left transition-colors ${
                        isSelected
                          ? 'border-l-crimson bg-crimson/10'
                          : 'bg-ink/4 border-l-transparent'
                      } ${!detail.unlocked ? 'opacity-70' : ''}`}
                    >
                      <div className="flex items-start justify-between gap-3">
                        <div>
                          <strong>《{detail.name}》</strong>
                          <p className="mt-1 text-sm leading-6">
                            {detail.summary}
                          </p>
                        </div>
                        <span
                          className={
                            isSelected
                              ? 'text-crimson text-sm'
                              : 'text-ink-secondary text-sm'
                          }
                        >
                          {isSelected
                            ? '✓ 已选'
                            : detail.unlocked
                              ? '未选'
                              : '未解锁'}
                        </span>
                      </div>
                      <p className="text-ink-secondary mt-1 text-xs leading-5">
                        解锁条件：{detail.unlockRequirements.join('、')}
                      </p>
                      <div className="mt-2 flex flex-wrap gap-2">
                        <InkButton
                          variant={isSelected ? 'secondary' : 'primary'}
                          disabled={busy || !detail.unlocked || limitReached}
                          onClick={() => toggle(detail.id)}
                        >
                          {isSelected ? '取消选择' : '选择神通'}
                        </InkButton>
                        <InkButton
                          variant="secondary"
                          onClick={() =>
                            setExpandedAbilityId(expanded ? null : detail.id)
                          }
                        >
                          {expanded ? '收起效果' : '查看当前效果'}
                        </InkButton>
                      </div>
                      {expanded ? (
                        <div className="mt-3">
                          <p className="text-crimson text-xs">
                            当前效果：{path?.name ?? '基础传承'}
                            {pathState
                              ? ` · ${presentation.terms.meridianLoadout}${pathState.activeMeridianSlot}`
                              : ''}
                          </p>
                          <SectAbilityDetails
                            detail={detail}
                            collapsible={false}
                          />
                        </div>
                      ) : null}
                    </div>
                  );
                })}
              </div>
            </InkDetailDrawer>
          </>
        )}
      </div>
    </SectScene>
  );
}
