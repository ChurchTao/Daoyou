import { SectAbilityDetails } from '@app/components/feature/sect/SectAbilityDetails';
import {
  GameSceneFrame,
  GameSceneLoading,
  GameSceneNote,
} from '@app/components/game-shell';
import { InkModal } from '@app/components/layout';
import { useInkUI } from '@app/components/providers/InkUIProvider';
import { InkButton, InkCard, InkNotice } from '@app/components/ui';
import { useActiveCultivatorProfile } from '@app/lib/player-state/selectors';
import { usePlayerStateActions } from '@app/lib/player-state/store';
import { fetchSectCurrent } from '@app/lib/sect/sectClient';
import type { SectCurrentData } from '@shared/contracts/sect';
import {
  createAbilitySlots,
  resolveSectAbility,
  type CultivatorSectState,
  type SectAbilitySlots,
} from '@shared/engine/sect';
import { useEffect, useMemo, useState } from 'react';

const EMPTY_SLOTS: SectAbilitySlots = [null, null, null, null];
const json = (method: string, body: unknown): RequestInit => ({
  method,
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify(body),
});

export default function SectAbilitiesPage() {
  const [data, setData] = useState<SectCurrentData>();
  const [draftSlots, setDraftSlots] = useState<SectAbilitySlots>(EMPTY_SLOTS);
  const [pickerOpen, setPickerOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string>();
  const cultivator = useActiveCultivatorProfile();
  const { mutate } = usePlayerStateActions();
  const { pushToast } = useInkUI();

  useEffect(() => {
    let cancelled = false;
    void fetchSectCurrent()
      .then((next) => {
        if (!cancelled) {
          setData(next);
          setDraftSlots(createAbilitySlots(next.sect?.abilityLoadout ?? []));
        }
      })
      .catch((reason) => {
        if (!cancelled)
          setError(
            reason instanceof Error ? reason.message : '宗门神通读取失败',
          );
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const realm = cultivator?.realm ?? '炼气';
  const sect = data?.sect;
  const definition = data?.definition;
  const details = useMemo(
    () =>
      sect && definition
        ? definition.abilities.map((ability) =>
            resolveSectAbility({ abilityId: ability.id, sect, realm }),
          )
        : [],
    [definition, realm, sect],
  );
  const activeDetails = details.filter(
    (detail) =>
      definition?.abilities.find((ability) => ability.id === detail.id)
        ?.occupiesActiveSlot,
  );
  const defaultDetail = details.find(
    (detail) =>
      !definition?.abilities.find((ability) => ability.id === detail.id)
        ?.occupiesActiveSlot,
  );
  const selected = draftSlots.filter((id): id is string => id !== null);
  const serverSlots = sect?.abilityLoadout ?? EMPTY_SLOTS;
  const changed = draftSlots.some((id, index) => id !== serverSlots[index]);
  const path = definition?.paths.find(
    (entry) => entry.id === sect?.activePathId,
  );
  const pathState = sect?.paths.find(
    (entry) => entry.pathId === sect.activePathId,
  );

  const save = async () => {
    if (!sect || !changed) return;
    setBusy(true);
    try {
      const result = await mutate<{ sect: CultivatorSectState }>(
        fetch(
          '/api/sects/current/ability-loadout',
          json('PUT', { abilityIds: draftSlots }),
        ),
      );
      setData((current) =>
        current ? { ...current, sect: result.sect } : current,
      );
      setDraftSlots(createAbilitySlots(result.sect.abilityLoadout));
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
      setDraftSlots(
        createAbilitySlots(selected.filter((id) => id !== abilityId)),
      );
      return;
    }
    if (selected.length >= 4) {
      pushToast({ message: '最多选择四门宗门神通', tone: 'danger' });
      return;
    }
    setDraftSlots(createAbilitySlots([...selected, abilityId]));
  };

  const setTactic = async (tacticId: string) => {
    if (!sect?.activePathId) return;
    setBusy(true);
    try {
      const result = await mutate<{ sect: CultivatorSectState }>(
        fetch(
          `/api/sects/current/paths/${sect.activePathId}/tactic`,
          json('PUT', { tacticId }),
        ),
      );
      setData((current) =>
        current ? { ...current, sect: result.sect } : current,
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

  if (!data && !error)
    return <GameSceneLoading message="宗门神通卷徐徐展开……" />;
  return (
    <GameSceneFrame
      title="【宗门神通】"
      description={
        definition
          ? `查阅并配置${definition.name}的基础神通与当前流派变体。`
          : '拜入宗门后，可在此配置宗门神通。'
      }
      headerMeta={
        error ? <GameSceneNote tone="danger">{error}</GameSceneNote> : undefined
      }
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
      {!sect || !definition ? (
        <InkNotice>尚未拜入宗门。</InkNotice>
      ) : (
        <>
          {defaultDetail ? (
            <InkCard>
              <strong>{defaultDetail.name}</strong>
              <span className="text-ink-secondary ml-2 text-sm">
                默认神通 · 不占主动栏
              </span>
              <SectAbilityDetails detail={defaultDetail} />
            </InkCard>
          ) : null}
          <InkCard className="mt-3">
            <h3 className="text-lg font-semibold">四个主动栏</h3>
            <p className="text-ink-secondary mt-1 text-sm">
              从神通卷中快捷选择至多四门，确认后统一保存配置。
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
                onClick={() => setDraftSlots(EMPTY_SLOTS)}
              >
                清空全部
              </InkButton>
              <InkButton disabled={busy} onClick={() => setPickerOpen(true)}>
                选择神通
              </InkButton>
              <InkButton
                variant="primary"
                disabled={busy || !changed}
                onClick={() => void save()}
              >
                {busy ? '保存中' : '保存配置'}
              </InkButton>
              {changed ? (
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

          <InkModal
            isOpen={pickerOpen}
            onClose={() => setPickerOpen(false)}
            title="选择宗门神通"
            className="max-w-3xl"
            footer={
              <div className="flex items-center justify-between gap-3">
                <span className="text-ink-secondary text-sm">
                  已选 {selected.length} / 4
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
                const limitReached = selected.length >= 4 && !isSelected;
                return (
                  <button
                    type="button"
                    key={detail.id}
                    disabled={busy || !detail.unlocked || limitReached}
                    onClick={() => toggle(detail.id)}
                    className={`border-ink/10 w-full border-l-2 p-3 text-left transition-colors ${
                      isSelected
                        ? 'border-l-crimson bg-crimson/10'
                        : 'bg-ink/4 border-l-transparent'
                    } ${!detail.unlocked ? 'cursor-not-allowed opacity-55' : limitReached ? 'cursor-not-allowed opacity-65' : 'hover:bg-ink/7'}`}
                  >
                    <div className="flex items-start justify-between gap-3">
                      <strong>《{detail.name}》</strong>
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
                    <p className="mt-1 text-sm leading-6">{detail.summary}</p>
                    <p className="text-ink-secondary mt-1 text-xs leading-5">
                      解锁条件：{detail.unlockRequirements.join('、')}
                    </p>
                  </button>
                );
              })}
            </div>
          </InkModal>
        </>
      )}
    </GameSceneFrame>
  );
}
