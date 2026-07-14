import { SectAbilityDetails } from '@app/components/feature/sect/SectAbilityDetails';
import { GameSceneFrame, GameSceneLoading, GameSceneNote } from '@app/components/game-shell';
import { InkModal } from '@app/components/layout';
import { useInkUI } from '@app/components/providers/InkUIProvider';
import { InkButton, InkCard, InkNotice } from '@app/components/ui';
import { useActiveCultivatorProfile } from '@app/lib/player-state/selectors';
import { usePlayerStateActions } from '@app/lib/player-state/store';
import { fetchSectCurrent } from '@app/lib/sect/sectClient';
import type { SectCurrentData } from '@shared/contracts/sect';
import {
  LINGXIAO_ABILITY_BY_ID,
  LINGXIAO_SECT,
  createAbilitySlots,
  projectLingxiaoAbilityDetail,
  type CultivatorSectState,
  type LingxiaoAbilityId,
  type SectAbilitySlots,
  type SectTacticId,
} from '@shared/engine/sect';
import { useEffect, useMemo, useState } from 'react';

const EMPTY_SLOTS: SectAbilitySlots = [null, null, null, null];

const playerFriendlyDescriptions: Record<LingxiaoAbilityId, string> = {
  'plain-sword': '稳定出剑攻击敌人，并为后续招式积累力量。',
  'guiding-sword': '快速出剑且没有冷却，适合频繁使用。',
  'linked-edge': '连续斩击三次，并为后续强攻留下破绽。',
  'turning-body': '出剑后进入防守姿态，闪避敌招时立即反击。',
  'breaking-edge': '消耗当前积累发动强力一击，积累越多伤害越高。',
  'sword-aegis': '凝聚剑罡抵挡伤害，并帮助维持当前积累。',
  'shadow-step': '攻击敌人的同时，提高下一回合的出手速度。',
  'instant-traceless': '消耗全部积累发动六次快斩，完整命中可返还一点积累。',
};

const emptySect: CultivatorSectState = {
  membershipId: 'preview',
  sectId: 'lingxiao',
  status: 'prospect',
  contribution: 0,
  tacticId: 'steady',
  activeMeridianSlot: 1,
  configVersion: 1,
  methods: {},
  meridianLoadouts: [
    { slot: 1, nodeIds: [], version: 1 },
    { slot: 2, nodeIds: [], version: 1 },
    { slot: 3, nodeIds: [], version: 1 },
  ],
  abilityLoadout: EMPTY_SLOTS,
};

function json(method: string, body: unknown): RequestInit {
  return { method, headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) };
}

export default function SectAbilitiesPage() {
  const [data, setData] = useState<SectCurrentData | null>(null);
  const [draftSlots, setDraftSlots] = useState<SectAbilitySlots>(EMPTY_SLOTS);
  const [pickerOpen, setPickerOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string>();
  const cultivator = useActiveCultivatorProfile();
  const { mutate } = usePlayerStateActions();
  const { pushToast } = useInkUI();

  useEffect(() => {
    let cancelled = false;
    void fetchSectCurrent().then((next) => {
      if (!cancelled) {
        setData(next);
        setDraftSlots(createAbilitySlots(next.sect?.abilityLoadout ?? []));
      }
    }).catch((reason) => {
      if (!cancelled) setError(reason instanceof Error ? reason.message : '宗门神通读取失败');
    });
    return () => { cancelled = true; };
  }, []);

  const sect = data?.sect ?? emptySect;
  const realm = cultivator?.realm ?? '炼气';
  const details = useMemo(
    () => LINGXIAO_SECT.abilities.map((ability) => projectLingxiaoAbilityDetail({ abilityId: ability.id, sect, realm })),
    [realm, sect],
  );
  const activeDetails = details.filter((detail) => LINGXIAO_ABILITY_BY_ID.get(detail.id)?.occupiesActiveSlot);
  const serverSlots = data?.sect?.abilityLoadout ?? EMPTY_SLOTS;
  const currentSlots = draftSlots;
  const selectedAbilityIds = currentSlots.filter((abilityId): abilityId is LingxiaoAbilityId => abilityId !== null);
  const hasDraftChanges = currentSlots.some((abilityId, index) => abilityId !== serverSlots[index]);
  const isActiveMember = data?.sect?.status === 'active';

  const saveLoadout = async () => {
    if (!hasDraftChanges) return;
    setBusy(true);
    try {
      const result = await mutate<{ sect: CultivatorSectState }>(
        fetch('/api/sects/ability-loadout', json('PUT', { abilityIds: currentSlots })),
      );
      setData((current) => current ? { ...current, sect: result.sect } : current);
      setDraftSlots(createAbilitySlots(result.sect.abilityLoadout));
      pushToast({ message: '宗门神通配置已保存', tone: 'success' });
    } catch (reason) {
      pushToast({ message: reason instanceof Error ? reason.message : '神通栏保存失败', tone: 'danger' });
    } finally {
      setBusy(false);
    }
  };

  const toggleDraftAbility = (abilityId: LingxiaoAbilityId) => {
    if (!isActiveMember || busy) return;
    if (selectedAbilityIds.includes(abilityId)) {
      setDraftSlots(createAbilitySlots(selectedAbilityIds.filter((id) => id !== abilityId)));
      return;
    }
    if (selectedAbilityIds.length >= 4) {
      pushToast({ message: '最多选择四门宗门神通，请先取消一门', tone: 'danger' });
      return;
    }
    setDraftSlots(createAbilitySlots([...selectedAbilityIds, abilityId]));
  };

  const setTactic = async (tacticId: SectTacticId) => {
    setBusy(true);
    try {
      const result = await mutate<{ sect: CultivatorSectState }>(
        fetch('/api/sects/tactic', json('PUT', { tacticId })),
      );
      setData((current) => current ? { ...current, sect: result.sect } : current);
      pushToast({ message: `自动战术已切换为${LINGXIAO_SECT.tactics.find((item) => item.id === tacticId)?.name}`, tone: 'success' });
    } catch (reason) {
      pushToast({ message: reason instanceof Error ? reason.message : '战术切换失败', tone: 'danger' });
    } finally {
      setBusy(false);
    }
  };

  if (!data && !error) return <GameSceneLoading message="宗门神通卷徐徐展开……" />;

  const defaultDetail = details.find((detail) => detail.id === 'plain-sword');

  return (
    <GameSceneFrame
      title="【宗门神通】"
      description="查阅凌霄剑式，配置四个主动栏与自动战斗策略。"
      headerMeta={error ? <GameSceneNote tone="danger">{error}</GameSceneNote> : undefined}
      aside={
        <div className="space-y-2 text-sm leading-7">
          <p>宗门：凌霄剑宗</p>
          <p>剑道：{sect.pathId === 'swift-sword' ? '快剑道' : '尚未择道'}</p>
          <p>战术：{LINGXIAO_SECT.tactics.find((item) => item.id === sect.tacticId)?.name}</p>
        </div>
      }
    >
      {!isActiveMember ? <InkNotice>尚未拜入凌霄剑宗。你可以预览全部剑式，但不能配置神通栏或战术。</InkNotice> : null}

      {defaultDetail ? (
        <InkCard>
          <div className="flex flex-wrap items-center gap-2 text-sm">
            <strong>{defaultDetail.name}</strong>
            <span className="text-ink-secondary">默认剑式 · 不占主动栏</span>
          </div>
          <p className="mt-1 text-sm">{defaultDetail.summary}</p>
          <SectAbilityDetails detail={defaultDetail} />
        </InkCard>
      ) : null}

      <InkCard>
        <h3 className="text-lg font-semibold">四个主动栏</h3>
        <p className="text-ink-secondary mt-1 text-sm">在神通卷中一次选择至多四门，确认后再统一保存配置。</p>
        <div className="mt-3 grid grid-cols-2 gap-2 md:grid-cols-4">
          {currentSlots.map((abilityId, index) => {
            const detail = abilityId ? details.find((item) => item.id === abilityId) : undefined;
            return (
              <div key={index} className="bg-ink/5 min-h-20 p-3 text-left text-sm">
                <span className="block text-xs tracking-wider">槽位 {index + 1}</span>
                <strong className="mt-1 block">{detail?.name ?? '空槽'}</strong>
                {abilityId && isActiveMember ? (
                  <InkButton
                    variant="secondary"
                    disabled={busy}
                    className="mt-1 px-0 text-sm"
                    onClick={() => toggleDraftAbility(abilityId)}
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
            disabled={!isActiveMember || busy || selectedAbilityIds.length === 0}
            onClick={() => setDraftSlots(EMPTY_SLOTS)}
          >
            清空全部
          </InkButton>
          <InkButton disabled={busy} onClick={() => setPickerOpen(true)}>
            {isActiveMember ? '选择神通' : '查看神通'}
          </InkButton>
          <InkButton
            variant="primary"
            disabled={!isActiveMember || busy || !hasDraftChanges}
            onClick={() => void saveLoadout()}
          >
            {busy ? '保存中' : '保存配置'}
          </InkButton>
          {hasDraftChanges ? <span className="text-crimson text-sm">配置尚未保存</span> : null}
        </div>
      </InkCard>

      <InkCard>
        <h3 className="text-lg font-semibold">自动战术</h3>
        <div className="mt-2 grid gap-2 md:grid-cols-3">
          {LINGXIAO_SECT.tactics.map((tactic) => (
            <button
              type="button"
              key={tactic.id}
              disabled={!isActiveMember || busy}
              onClick={() => void setTactic(tactic.id)}
              className={`p-3 text-left text-sm leading-6 transition-colors ${sect.tacticId === tactic.id ? 'bg-crimson/10 text-crimson' : 'bg-ink/5'} ${isActiveMember ? '' : 'cursor-not-allowed opacity-55'}`}
            >
              <strong>{tactic.name}</strong><br />{tactic.description}
            </button>
          ))}
        </div>
      </InkCard>

      <InkModal
        isOpen={pickerOpen}
        onClose={() => setPickerOpen(false)}
        title={isActiveMember ? '选择宗门神通' : '宗门神通一览'}
        className="max-w-3xl"
        footer={
          <div className="flex items-center justify-between gap-3">
            <span className="text-ink-secondary text-sm">已选 {selectedAbilityIds.length} / 4</span>
            <InkButton variant="primary" onClick={() => setPickerOpen(false)}>完成选择</InkButton>
          </div>
        }
      >
        <div className="space-y-2">
          {activeDetails.map((detail) => {
            const selected = selectedAbilityIds.includes(detail.id);
            const limitReached = selectedAbilityIds.length >= 4 && !selected;
            return (
              <button
                type="button"
                key={detail.id}
                disabled={!isActiveMember || !detail.unlocked || limitReached}
                onClick={() => toggleDraftAbility(detail.id)}
                className={`border-ink/10 w-full border-l-2 p-3 text-left transition-colors ${
                  selected
                    ? 'border-l-crimson bg-crimson/10'
                    : 'bg-ink/4 border-l-transparent'
                } ${!detail.unlocked ? 'cursor-not-allowed opacity-55' : limitReached ? 'cursor-not-allowed opacity-65' : 'hover:bg-ink/7'}`}
              >
                <div className="flex items-start justify-between gap-3">
                  <strong>《{detail.name}》</strong>
                  <span className={selected ? 'text-crimson text-sm' : 'text-ink-secondary text-sm'}>
                    {selected ? '✓ 已选' : detail.unlocked ? '未选' : '未解锁'}
                  </span>
                </div>
                <p className="mt-1 text-sm leading-6">{playerFriendlyDescriptions[detail.id]}</p>
                <p className="text-ink-secondary mt-1 text-xs leading-5">解锁条件：{detail.unlockRequirements.join('、')}</p>
              </button>
            );
          })}
        </div>
      </InkModal>
    </GameSceneFrame>
  );
}
