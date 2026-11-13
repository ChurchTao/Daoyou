import { useSocialQuery } from '@app/components/feature/friends/socialApi';
import { useInkUI } from '@app/components/providers/InkUIProvider';
import { InkBadge } from '@app/components/ui/InkBadge';
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
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);
  const [attempt, setAttempt] = useState(0);
  const [drawer, setDrawer] = useState<
    'equipment' | 'beasts' | 'achievements' | null
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
          setError('');
        }
      })
      .catch((reason: unknown) => {
        if (!controller.signal.aborted)
          setError(reason instanceof Error ? reason.message : '读取名片失败');
      });
    return () => {
      controller.abort();
    };
  }, [id, attempt]);

  async function save() {
    if (!view) return;
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
      const next = await mutate<CharacterCardSettingsView['settings']>(
        apiFetch('/api/cultivator/card/settings', {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(parsed.data),
        }),
      );
      invalidateCachedRequest(`character-card:${id}`);
      setView({ ...view, settings: next });
      pushToast({ message: '名片已保存', tone: 'success' });
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : '保存失败');
    } finally {
      setSaving(false);
    }
  }

  function toggleEquipment(item: InventoryView['items'][number]) {
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
      if (!current || saving) return current;
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
          <InkButton onClick={() => setAttempt((value) => value + 1)}>
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
    title: settings.title,
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
      saving ||
      inventoryLoading ||
      !!inventoryError ||
      (!selected && settings.equipmentIds.length >= 3);
    return {
      selected,
      disabled,
      quickOnTouch: true,
      badge: selected ? '已展示' : undefined,
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
    <div className="grid items-start gap-6 xl:grid-cols-[minmax(0,1fr)_20rem]">
      <div className="space-y-5">
        <InkInput
          label="名号"
          value={settings.title ?? ''}
          maxLength={8}
          hint="2–8 字，留空可清除名号。"
          disabled={saving}
          onChange={(title) =>
            setView({ ...view, settings: { ...settings, title } })
          }
        />
        <section className="space-y-2" aria-label="成就展示设置">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <h3 className="text-sm">
              展示成就{' '}
              <span className="text-ink-secondary font-mono">
                {selectedAchievementIds.length}/3
              </span>
            </h3>
            <InkButton
              disabled={saving}
              onClick={() => setDrawer('achievements')}
            >
              选择成就
            </InkButton>
          </div>
          {selectedAchievementIds.length ? (
            <div className="space-y-1">
              {selectedAchievementIds.map((id) => {
                const achievement = selectedAchievements.find(
                  (entry) => entry.id === id,
                );
                return (
                  <div
                    key={id}
                    className="flex min-w-0 items-start justify-between gap-2"
                  >
                    <InkBadge className="text-teal min-w-0 wrap-anywhere">
                      {achievement?.name ?? '此成就暂不可展示'}
                    </InkBadge>
                    <InkButton
                      variant="secondary"
                      disabled={saving}
                      onClick={() => removeAchievement(id)}
                    >
                      取消展示
                    </InkButton>
                  </div>
                );
              })}
            </div>
          ) : (
            <p className="text-ink-secondary text-xs">未设置，不展示成就。</p>
          )}
        </section>
        <section className="space-y-2" aria-label="道装展示设置">
          <div className="flex items-center justify-between gap-2">
            <h3 className="text-sm">
              展示道装{' '}
              <span className="text-ink-secondary font-mono">
                {settings.equipmentIds.length}/3
              </span>
            </h3>
            <InkButton disabled={saving} onClick={() => setDrawer('equipment')}>
              选择道装
            </InkButton>
          </div>
          {view.card.equipment.length ? (
            <div className="grid grid-cols-[repeat(3,minmax(0,4rem))] gap-2">
              {view.card.equipment.map((item) => (
                <div key={item.id} className="grid min-w-0 content-start gap-1">
                  <ItemSlot item={item} />
                  <InkButton
                    className="px-0 text-xs"
                    aria-label={`移除展示道装${item.name}`}
                    disabled={saving}
                    onClick={() => remove('equipmentIds', item.id)}
                  >
                    移除
                  </InkButton>
                </div>
              ))}
            </div>
          ) : (
            <p className="text-ink-secondary text-xs">未设置，不展示道装。</p>
          )}
        </section>
        <section className="space-y-2" aria-label="灵兽展示设置">
          <div className="flex items-center justify-between gap-2">
            <h3 className="text-sm">
              展示灵兽{' '}
              <span className="text-ink-secondary font-mono">
                {settings.beastIds.length}/3
              </span>
            </h3>
            <InkButton disabled={saving} onClick={() => setDrawer('beasts')}>
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
                    className="px-0 text-xs"
                    aria-label={`移除展示灵兽${beast.name}`}
                    disabled={saving}
                    onClick={() => remove('beastIds', beast.id)}
                  >
                    移除
                  </InkButton>
                </div>
              ))}
            </div>
          ) : (
            <p className="text-ink-secondary text-xs">未设置，不展示灵兽。</p>
          )}
        </section>
        {error ? (
          <p role="alert" className="text-crimson text-sm">
            {error}
          </p>
        ) : null}
        <div className="flex gap-3">
          <InkButton
            variant="primary"
            pending={saving}
            pendingLabel="保存中……"
            onClick={() => void save()}
          >
            保存名片
          </InkButton>
          <InkButton
            disabled={saving}
            onClick={() => setAttempt((value) => value + 1)}
          >
            重新载入
          </InkButton>
        </div>
      </div>
      <section
        aria-label="名片预览"
        className="border-ink/15 min-w-0 space-y-3 border-t pt-4 xl:border-t-0 xl:border-l xl:pt-0 xl:pl-5"
      >
        <h3 className="text-ink-secondary text-sm">名片预览</h3>
        <CharacterCardView card={preview} />
      </section>
      <InkDetailDrawer
        isOpen={drawer !== null}
        onClose={() => setDrawer(null)}
        title={
          drawer === 'equipment'
            ? '选择展示道装'
            : drawer === 'beasts'
              ? '选择展示灵兽'
              : '选择展示成就'
        }
        size="md"
        description={
          <span>
            已选择 <span className="font-mono">{drawerSelectedCount}/3</span>
            ，可随时取消展示；完成选择后保存名片生效。
          </span>
        }
        footer={
          <InkButton variant="primary" onClick={() => setDrawer(null)}>
            完成选择
          </InkButton>
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
              disabled={saving}
              onToggle={toggleAchievement}
            />
          </>
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
                    beasts.loading ||
                    (!settings.beastIds.includes(beast.id) &&
                      settings.beastIds.length >= 3)
                  }
                  onSelect={() => toggleBeast(beast)}
                />
              ))}
            </div>
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
    </div>
  );
}
