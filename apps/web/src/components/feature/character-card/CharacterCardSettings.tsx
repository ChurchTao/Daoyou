import { useSocialQuery } from '@app/components/feature/friends/socialApi';
import { useInkUI } from '@app/components/providers/InkUIProvider';
import { GameIcon } from '@app/components/ui/GameIcon';
import { InkButton } from '@app/components/ui/InkButton';
import { InkDetailDrawer } from '@app/components/ui/InkDetailDrawer';
import { InkInput } from '@app/components/ui/InkInput';
import { InkNotice } from '@app/components/ui/InkNotice';
import { apiFetch } from '@app/lib/api/fetch';
import {
  fetchJsonCached,
  invalidateCachedRequest,
} from '@app/lib/client/requestCache';
import { useInventoryBag } from '@app/lib/resources/bag';
import { useCraftStorage } from '@app/lib/resources/craftStorage';
import { useResourceMutation } from '@app/lib/resources/mutations';
import { usePlayerSession } from '@app/lib/resources/player';
import type { AchievementView } from '@daoyou/contracts/achievements';
import type { ApiSuccess } from '@daoyou/contracts/http';
import type { InventoryView } from '@daoyou/contracts/inventory';
import {
  CharacterCardSettingsSchema,
  type CharacterCardSettingsView,
} from '@daoyou/contracts/player/card';
import {
  beastTradePreview,
  type SummonedBeast,
} from '@daoyou/game-domain/beasts';
import { useEffect, useState } from 'react';
import { useBeforeUnload, useBlocker } from 'react-router';
import { achievementIcon } from '../achievements/achievementIcons';
import { BeastRosterEntry } from '../beasts/BeastRosterEntry';
import { BeastPickerPager } from '../beasts/beastPicker';
import { useBeastPicker } from '../beasts/useBeastPicker';
import { CraftInventoryPanel } from '../items/CraftInventoryPanel';
import { InventoryItems } from '../items/InventoryItems';
import { ItemSlot } from '../items/ItemSlot';
import { matchesInventoryFilters } from '../items/inventoryFilterModel';
import { AchievementPicker } from './AchievementPicker';
import { CharacterCardBeastSlot, CharacterCardView } from './CharacterCardView';

const equipmentFilter = { kind: 'equipment' } as const;

export function CharacterCardSettings() {
  const id = usePlayerSession().data?.activeCultivator?.id;
  if (!id)
    return (
      <p role="status" className="text-ink-secondary text-sm">
        正在读取当前角色……
      </p>
    );
  return <CharacterCardSettingsEditor key={id} cultivatorId={id} />;
}

function CharacterCardSettingsEditor({
  cultivatorId: id,
}: {
  cultivatorId: string;
}) {
  const { mutate } = useResourceMutation();
  const { pushToast } = useInkUI();
  const [view, setView] = useState<CharacterCardSettingsView | null>(null);
  const [savedView, setSavedView] = useState<CharacterCardSettingsView | null>(
    null,
  );
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);
  const [loading, setLoading] = useState(true);
  const [conflict, setConflict] = useState(false);
  const [attempt, setAttempt] = useState(0);
  const [drawer, setDrawer] = useState<
    'equipment' | 'beasts' | 'achievements' | 'preview' | null
  >(null);
  const achievementsQuery = useSocialQuery<{ achievements: AchievementView[] }>(
    '/api/achievements',
  );
  const [source, setSource] = useState<'bag' | 'storage'>('bag');
  const bag = useInventoryBag(drawer === 'equipment');
  const storage = useCraftStorage(
    equipmentFilter,
    drawer === 'equipment' && source === 'storage',
  );
  const beasts = useBeastPicker({ active: drawer === 'beasts' });
  const inventory = source === 'bag' ? bag.data : storage.view;
  const inventoryError = source === 'bag' ? bag.error : storage.error;
  const inventoryLoading =
    source === 'bag' ? bag.loading || bag.isRefreshing : storage.loading;
  const busy = saving || loading;
  const normalizedTitle = view?.settings.title?.trim() || null;
  const titleError = CharacterCardSettingsSchema.shape.title.safeParse(
    normalizedTitle,
  ).success
    ? undefined
    : '名号需填写2–8字，或留空清除。';
  const dirty = Boolean(
    view &&
    savedView &&
    JSON.stringify({ ...view.settings, title: normalizedTitle }) !==
      JSON.stringify({
        ...savedView.settings,
        title: savedView.settings.title?.trim() || null,
      }),
  );
  const blocker = useBlocker(dirty && !saving);
  useBeforeUnload((event) => {
    if (dirty || saving) {
      event.preventDefault();
      event.returnValue = '';
    }
  });

  useEffect(() => {
    const controller = new AbortController();
    fetchJsonCached<ApiSuccess<CharacterCardSettingsView>>(
      '/api/cultivator/card/settings',
      { key: `card-settings:${id}`, signal: controller.signal },
    )
      .then(({ data }) => {
        if (!controller.signal.aborted) {
          if (data.card.id !== id)
            throw new Error('角色已变化，请重新载入名片。');
          setView(data);
          setSavedView(data);
          setError('');
          setConflict(false);
        }
      })
      .catch((reason: unknown) => {
        if (!controller.signal.aborted)
          setError(reason instanceof Error ? reason.message : '读取名片失败');
      })
      .finally(() => {
        if (!controller.signal.aborted) setLoading(false);
      });
    return () => {
      controller.abort();
    };
  }, [id, attempt]);

  async function save() {
    if (!view || busy || !dirty || titleError || conflict) return;
    const parsed = CharacterCardSettingsSchema.safeParse({
      ...view.settings,
      title: view.settings.title?.trim() || null,
    });
    if (!parsed.success) {
      setError(parsed.error.issues[0]?.message ?? '名片设置无效');
      return;
    }
    setSaving(true);
    setError('');
    try {
      const response = await apiFetch('/api/cultivator/card/settings', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(parsed.data),
      });
      if (response.status === 409) setConflict(true);
      const next = await mutate<CharacterCardSettingsView['settings']>(
        Promise.resolve(response),
      );
      invalidateCachedRequest(`character-card:${id}`);
      invalidateCachedRequest(`card-settings:${id}`);
      const saved = {
        ...view,
        settings: next,
        card: { ...view.card, title: next.title },
      };
      setView(saved);
      setSavedView(saved);
      pushToast({ message: '名片已保存', tone: 'success' });
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : '保存失败');
    } finally {
      setSaving(false);
    }
  }

  function reloadLatest() {
    if (busy) return;
    setLoading(true);
    setError('');
    invalidateCachedRequest(`card-settings:${id}`);
    setAttempt((value) => value + 1);
  }

  function restore() {
    if (busy || !savedView) return;
    setView(savedView);
    setError('');
  }

  function toggleEquipment(item: InventoryView['items'][number]) {
    if (busy) return;
    setView((current) => {
      if (!current) return current;
      const selected = current.settings.equipmentIds;
      if (selected.includes(item.id))
        return {
          ...current,
          settings: {
            ...current.settings,
            equipmentIds: selected.filter((id) => id !== item.id),
          },
          card: {
            ...current.card,
            equipment: current.card.equipment.filter(
              (entry) => entry.id !== item.id,
            ),
          },
        };
      if (selected.length >= 3) return current;
      return {
        ...current,
        settings: { ...current.settings, equipmentIds: [...selected, item.id] },
        card: {
          ...current.card,
          equipment: [
            ...current.card.equipment,
            {
              id: item.id,
              name: item.name,
              definitionId: item.definitionId,
              instanceData: item.instanceData,
              quantity: item.quantity,
            },
          ],
        },
      };
    });
  }
  function toggleBeast(beast: SummonedBeast) {
    if (busy) return;
    setView((current) => {
      if (!current) return current;
      const selected = current.settings.beastIds;
      if (selected.includes(beast.id))
        return {
          ...current,
          settings: {
            ...current.settings,
            beastIds: selected.filter((id) => id !== beast.id),
          },
          card: {
            ...current.card,
            beasts: current.card.beasts.filter(
              (entry) => entry.id !== beast.id,
            ),
          },
        };
      if (selected.length >= 3) return current;
      return {
        ...current,
        settings: { ...current.settings, beastIds: [...selected, beast.id] },
        card: {
          ...current.card,
          beasts: [
            ...current.card.beasts,
            { id: beast.id, ...beastTradePreview(beast) },
          ],
        },
      };
    });
  }
  function toggleAchievement(achievement: AchievementView) {
    setView((current) => {
      if (!current || busy) return current;
      const selected = current.settings.achievementIds ?? [];
      const isSelected = selected.includes(achievement.id);
      if (!isSelected && (!achievement.unlocked || selected.length >= 3))
        return current;
      return {
        ...current,
        settings: {
          ...current.settings,
          achievementIds: isSelected
            ? selected.filter((id) => id !== achievement.id)
            : [...selected, achievement.id],
        },
      };
    });
  }
  function removeAchievement(id: string) {
    if (busy) return;
    setView((current) =>
      current
        ? {
            ...current,
            settings: {
              ...current.settings,
              achievementIds: (current.settings.achievementIds ?? []).filter(
                (entry) => entry !== id,
              ),
            },
          }
        : current,
    );
  }
  function remove(key: 'equipmentIds' | 'beastIds', id: string) {
    if (busy) return;
    setView((current) =>
      current
        ? {
            ...current,
            settings: {
              ...current.settings,
              [key]: current.settings[key].filter((entry) => entry !== id),
            },
            card:
              key === 'equipmentIds'
                ? {
                    ...current.card,
                    equipment: current.card.equipment.filter(
                      (entry) => entry.id !== id,
                    ),
                  }
                : {
                    ...current.card,
                    beasts: current.card.beasts.filter(
                      (entry) => entry.id !== id,
                    ),
                  },
          }
        : current,
    );
  }

  if (!view)
    return (
      <div className="space-y-3 text-sm">
        <p role={error ? 'alert' : 'status'}>{error || '正在读取名片……'}</p>
        {error ? (
          <InkButton onClick={reloadLatest} pending={loading}>
            重新载入
          </InkButton>
        ) : null}
      </div>
    );
  const settings = view.settings;
  const selectedAchievementIds = settings.achievementIds ?? [];
  const achievementCatalog =
    achievementsQuery.data?.achievements ?? view.achievements ?? [];
  const selectedAchievements = selectedAchievementIds.flatMap((id) => {
    const achievement = achievementCatalog.find(
      (entry) => entry.id === id && entry.unlocked,
    );
    return achievement
      ? [
          {
            id: achievement.id,
            name: achievement.name,
            description: achievement.description,
          },
        ]
      : [];
  });
  const preview = {
    ...view.card,
    title: normalizedTitle,
    achievements: selectedAchievements,
  };
  const drawerSelectedCount =
    drawer === 'equipment'
      ? settings.equipmentIds.length
      : drawer === 'beasts'
        ? settings.beastIds.length
        : selectedAchievementIds.length;
  const equipmentSlotProps = (
    item: InventoryView['items'][number] | undefined,
  ) => {
    const selected = !!item && settings.equipmentIds.includes(item.id);
    const disabled =
      busy ||
      inventoryLoading ||
      !!inventoryError ||
      (!selected && settings.equipmentIds.length >= 3);
    return {
      selected,
      disabled,
      quickOnTouch: true,
      badge: selected ? '已选择' : undefined,
      onQuickAction: item ? () => toggleEquipment(item) : undefined,
      children: item
        ? (close: () => void) => (
            <InkButton
              disabled={disabled}
              onClick={() => {
                close();
                toggleEquipment(item);
              }}
            >
              {selected ? '取消展示' : '选择展示'}
            </InkButton>
          )
        : undefined,
    };
  };
  return (
    <div className="grid min-w-0 items-start gap-5 lg:grid-cols-[minmax(0,1fr)_18rem]">
      <div className="space-y-5">
        <div className="flex items-center justify-between gap-3 lg:hidden">
          <p className="text-ink-secondary text-xs">编辑对外展示的内容</p>
          <InkButton className="min-h-11" onClick={() => setDrawer('preview')}>
            预览名片
          </InkButton>
        </div>
        <InkInput
          label="名号"
          value={settings.title ?? ''}
          maxLength={8}
          hint="2–8 字，留空可清除名号。"
          error={titleError}
          disabled={busy}
          onChange={(title) =>
            setView({ ...view, settings: { ...settings, title } })
          }
        />
        <section
          className="border-ink/10 space-y-2 border-t pt-3"
          aria-label="成就展示设置"
        >
          <div className="flex flex-wrap items-center justify-between gap-2">
            <h3 className="text-base font-semibold">
              展示成就{' '}
              <span className="text-ink-secondary font-mono">
                {selectedAchievementIds.length}/3
              </span>
            </h3>
            <InkButton
              className="min-h-11"
              disabled={busy}
              onClick={() => setDrawer('achievements')}
            >
              选择成就
            </InkButton>
          </div>
          {selectedAchievementIds.length ? (
            <div className="space-y-1">
              {selectedAchievementIds.map((id) => {
                const achievement = achievementCatalog.find(
                  (entry) => entry.id === id,
                );
                return (
                  <div
                    key={id}
                    className="flex min-w-0 items-center justify-between gap-2"
                  >
                    <span className="flex min-w-0 items-center gap-2 text-sm">
                      <GameIcon
                        value={
                          achievement ? achievementIcon(achievement) : '🏅'
                        }
                        className="text-xl"
                      />
                      <span className="min-w-0 wrap-anywhere">
                        {achievement?.name ?? '此成就暂不可展示'}
                      </span>
                    </span>
                    <InkButton
                      variant="secondary"
                      className="min-h-11 shrink-0"
                      disabled={busy}
                      onClick={() => removeAchievement(id)}
                    >
                      移除
                      <span className="sr-only">
                        成就{achievement?.name ?? id}
                      </span>
                    </InkButton>
                  </div>
                );
              })}
            </div>
          ) : (
            <p className="text-ink-secondary text-xs">未设置，不展示成就。</p>
          )}
        </section>
        <section
          className="border-ink/10 space-y-2 border-t pt-3"
          aria-label="道装展示设置"
        >
          <div className="flex items-center justify-between gap-2">
            <h3 className="text-base font-semibold">
              展示道装{' '}
              <span className="text-ink-secondary font-mono">
                {settings.equipmentIds.length}/3
              </span>
            </h3>
            <InkButton
              className="min-h-11"
              disabled={busy}
              onClick={() => setDrawer('equipment')}
            >
              选择道装
            </InkButton>
          </div>
          {view.card.equipment.length ? (
            <div className="grid grid-cols-[repeat(3,minmax(0,4rem))] gap-2">
              {view.card.equipment.map((item) => (
                <div key={item.id} className="grid min-w-0 content-start gap-1">
                  <ItemSlot item={item} />
                  <InkButton
                    className="min-h-11 px-0"
                    variant="secondary"
                    disabled={busy}
                    onClick={() => remove('equipmentIds', item.id)}
                  >
                    移除<span className="sr-only">道装{item.name}</span>
                  </InkButton>
                </div>
              ))}
            </div>
          ) : (
            <p className="text-ink-secondary text-xs">未设置，不展示道装。</p>
          )}
        </section>
        <section
          className="border-ink/10 space-y-2 border-t pt-3"
          aria-label="灵兽展示设置"
        >
          <div className="flex items-center justify-between gap-2">
            <h3 className="text-base font-semibold">
              展示灵兽{' '}
              <span className="text-ink-secondary font-mono">
                {settings.beastIds.length}/3
              </span>
            </h3>
            <InkButton
              className="min-h-11"
              disabled={busy}
              onClick={() => setDrawer('beasts')}
            >
              选择灵兽
            </InkButton>
          </div>
          {view.card.beasts.length ? (
            <div className="grid grid-cols-[repeat(3,minmax(0,4rem))] gap-2">
              {view.card.beasts.map((beast) => (
                <div
                  key={beast.id}
                  className="grid min-w-0 content-start gap-1"
                >
                  <CharacterCardBeastSlot beast={beast} />
                  <InkButton
                    className="min-h-11 px-0"
                    variant="secondary"
                    disabled={busy}
                    onClick={() => remove('beastIds', beast.id)}
                  >
                    移除<span className="sr-only">灵兽{beast.name}</span>
                  </InkButton>
                </div>
              ))}
            </div>
          ) : (
            <p className="text-ink-secondary text-xs">未设置，不展示灵兽。</p>
          )}
        </section>
      </div>
      <section
        aria-label="名片预览"
        className="border-ink/15 sticky top-3 hidden min-w-0 space-y-3 border-l pl-5 lg:block"
      >
        <h3 className="text-ink-secondary text-sm">名片预览</h3>
        <CharacterCardView card={preview} />
      </section>
      <footer className="bg-paper border-ink/20 sticky bottom-(--game-bottom-offset) z-20 space-y-2 border-t py-3 lg:col-span-2">
        {error ? (
          <p role="alert" className="text-crimson text-sm leading-6">
            {error}
          </p>
        ) : null}
        {conflict ? (
          <div className="text-ink-secondary space-y-1 text-sm leading-6">
            <p>载入最新设置会放弃本次修改。</p>
            <InkButton
              onClick={reloadLatest}
              pending={loading}
              disabled={saving}
              className="min-h-11"
            >
              载入最新设置
            </InkButton>
          </div>
        ) : null}
        <div className="flex flex-wrap items-center justify-between gap-x-3 gap-y-1">
          <p role="status" className="text-ink-secondary text-xs leading-6">
            {loading
              ? '正在同步名片……'
              : saving
                ? '正在保存……'
                : conflict
                  ? '名片已有更新，请载入最新设置'
                  : dirty
                    ? '有未保存的修改'
                    : '当前设置已保存'}
          </p>
          <div className="ml-auto flex gap-2">
            {dirty ? (
              <InkButton
                variant="secondary"
                disabled={busy}
                className="min-h-11"
                onClick={restore}
              >
                还原修改
              </InkButton>
            ) : null}
            <InkButton
              variant="primary"
              pending={saving}
              pendingLabel="保存中……"
              disabled={!dirty || busy || !!titleError || conflict}
              className="min-h-11"
              onClick={() => void save()}
            >
              保存名片
            </InkButton>
          </div>
        </div>
      </footer>
      <InkDetailDrawer
        isOpen={drawer !== null && blocker.state !== 'blocked'}
        onClose={() => setDrawer(null)}
        title={
          drawer === 'equipment'
            ? '选择展示道装'
            : drawer === 'beasts'
              ? '选择展示灵兽'
              : drawer === 'achievements'
                ? '选择展示成就'
                : '名片预览'
        }
        size="md"
        description={
          drawer !== 'preview' ? (
            <div>
              <p>
                已选择{' '}
                <span className="font-mono">{drawerSelectedCount}/3</span>
                ，每类最多展示3项。
              </p>
              {drawer === 'equipment' && drawerSelectedCount >= 3 ? (
                <p className="mt-1">已选满，请先取消一项再替换。</p>
              ) : null}
            </div>
          ) : (
            <span>这是本次编辑的预览，保存后对外生效。</span>
          )
        }
        footer={
          <div className="flex flex-wrap items-center justify-between gap-2">
            <p className="text-ink-secondary text-xs">
              {drawer !== 'preview'
                ? '选择已加入草稿，保存名片后生效。'
                : dirty
                  ? '有未保存的修改'
                  : '当前设置已保存'}
            </p>
            <InkButton
              variant="primary"
              className="min-h-11"
              onClick={() => setDrawer(null)}
            >
              {drawer === 'preview' ? '返回设置' : '完成选择'}
            </InkButton>
          </div>
        }
      >
        {drawer === 'achievements' ? (
          <>
            {achievementsQuery.error ? (
              <InkNotice tone="warning">
                {achievementsQuery.error}{' '}
                <InkButton onClick={() => void achievementsQuery.reload()}>
                  重试
                </InkButton>
              </InkNotice>
            ) : null}
            <AchievementPicker
              achievements={achievementCatalog}
              selectedIds={selectedAchievementIds}
              disabled={busy}
              onToggle={toggleAchievement}
            />
          </>
        ) : drawer === 'preview' ? (
          <CharacterCardView card={preview} />
        ) : drawer === 'equipment' ? (
          <CraftInventoryPanel
            source={source}
            onSource={setSource}
            view={inventory}
            loading={inventoryLoading}
            error={inventoryError}
            filter={equipmentFilter}
            kindDisabled
            onFilter={() => {}}
            onPage={storage.setPage}
            onReload={() =>
              source === 'bag' ? void bag.reload() : storage.reload()
            }
          >
            <InventoryItems
              items={(inventory?.items ?? []).filter((item) =>
                matchesInventoryFilters(item, equipmentFilter),
              )}
              location={source}
              compact
              quickTouchHint
              slotProps={equipmentSlotProps}
            />
            {source === 'bag' && bag.data?.equippedItems.length ? (
              <section className="space-y-2">
                <h3 className="text-ink-secondary text-sm">已穿戴道装</h3>
                <div className="grid grid-cols-5 gap-1.5">
                  {bag.data.equippedItems.map((item) => (
                    <ItemSlot
                      key={item.id}
                      item={item}
                      {...equipmentSlotProps(item)}
                    />
                  ))}
                </div>
              </section>
            ) : null}
          </CraftInventoryPanel>
        ) : drawer === 'beasts' ? (
          <div className="space-y-3">
            {beasts.error ? (
              <p role="alert" className="text-crimson text-sm">
                {beasts.error}
                <InkButton onClick={beasts.reload}>重试</InkButton>
              </p>
            ) : null}
            {beasts.loading && !beasts.data ? (
              <p role="status" className="text-ink-secondary text-sm">
                正在读取灵兽……
              </p>
            ) : null}
            <div className="grid grid-cols-2 gap-1">
              {beasts.data?.beasts.map((beast) => (
                <BeastRosterEntry
                  key={beast.id}
                  beast={beast}
                  selected={settings.beastIds.includes(beast.id)}
                  isLead={beasts.data?.lineup.leadBeastId === beast.id}
                  disabled={
                    busy ||
                    beasts.loading ||
                    (!settings.beastIds.includes(beast.id) &&
                      settings.beastIds.length >= 3)
                  }
                  onSelect={() => toggleBeast(beast)}
                />
              ))}
            </div>
            {settings.beastIds.length >= 3 ? (
              <p role="status" className="text-ink-secondary text-sm">
                已选满3项，请先取消一项再替换。
              </p>
            ) : null}
            {beasts.data ? (
              <>
                <BeastPickerPager
                  page={beasts.data.page}
                  total={beasts.data.total}
                  loading={beasts.loading}
                  onPage={beasts.setPage}
                />
                {!beasts.data.total ? (
                  <p className="text-ink-secondary text-sm">尚未拥有灵兽。</p>
                ) : null}
              </>
            ) : null}
          </div>
        ) : null}
      </InkDetailDrawer>
      <InkDetailDrawer
        isOpen={blocker.state === 'blocked'}
        title="名片尚未保存"
        size="sm"
        onClose={() => {
          if (blocker.state === 'blocked') blocker.reset();
        }}
        footer={
          <div className="flex flex-wrap justify-end gap-3">
            <InkButton
              variant="secondary"
              className="min-h-11"
              onClick={() => {
                if (blocker.state === 'blocked') blocker.proceed();
              }}
            >
              放弃修改并离开
            </InkButton>
            <InkButton
              variant="primary"
              className="min-h-11"
              onClick={() => {
                if (blocker.state === 'blocked') blocker.reset();
              }}
            >
              继续编辑
            </InkButton>
          </div>
        }
      >
        <p className="text-ink-secondary text-sm leading-7">
          离开会丢失本次选择。可返回保存名片，或放弃修改后离开。
        </p>
      </InkDetailDrawer>
    </div>
  );
}
