import { useInkUI } from '@app/components/providers/InkUIProvider';
import { InkButton } from '@app/components/ui/InkButton';
import { InkInput } from '@app/components/ui/InkInput';
import { InkNotice } from '@app/components/ui/InkNotice';
import { InkSelect } from '@app/components/ui/InkSelect';
import { DEFAULT_AFFIX_REGISTRY } from '@shared/engine/creation-v2/affixes';
import {
  DEFAULT_ITEM_LIBRARY_DAILY_MATERIAL_GENERATION_SETTINGS,
  type ItemLibraryDailyMaterialGenerationSettings,
} from '@shared/lib/constants/appSettings';
import { getAllConditionStatusTemplates } from '@shared/lib/conditionStatusRegistry';
import { CULTIVATION_BOOST_STATUS_KEY } from '@shared/lib/cultivationBoost';
import {
  getEquipmentSlotLabel,
  getMaterialTypeLabel,
} from '@shared/lib/gameConceptDisplay';
import type {
  CreateItemLibraryEntry,
  ItemLibraryEntry,
  UpdateItemLibraryEntry,
} from '@shared/lib/itemLibrary';
import { getPillAppearanceLabel } from '@shared/lib/pillAppearance';
import {
  BREAKTHROUGH_FOCUS_STATUS_KEY,
  CLEAR_MIND_STATUS_KEY,
  PROTECT_MERIDIANS_STATUS_KEY,
} from '@shared/lib/pillEffectScaling';
import {
  ELEMENT_VALUES,
  EQUIPMENT_SLOT_VALUES,
  MATERIAL_TYPE_VALUES,
  QUALITY_VALUES,
  REALM_STAGE_VALUES,
  REALM_VALUES,
} from '@shared/types/constants';
import {
  PILL_APPEARANCE_GRADE_VALUES,
  PILL_FAMILY_VALUES,
  PILL_QUOTA_CATEGORY_VALUES,
  TALISMAN_SESSION_MODE_VALUES,
} from '@shared/types/consumable';
import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  ITEM_LIBRARY_STATUS_LABELS,
  ITEM_LIBRARY_TYPE_LABELS,
  PILL_FAMILY_LABELS,
  PILL_OPERATION_LABELS,
  PILL_QUOTA_LABELS,
  TALISMAN_SESSION_MODE_LABELS,
  TRACK_OPTIONS,
  buildItemLibrarySubmitBody,
  createDefaultPillOperation,
  createEmptyDraft,
  entryToDraft,
  resetDraftForType,
  resetPillOperationsForFamily,
  type ItemLibraryDraft,
  type VisualPillOperation,
} from './itemLibraryEditor.helpers';

interface ItemLibraryResponse {
  items?: ItemLibraryEntry[];
  item?: ItemLibraryEntry;
  payload?: Extract<ItemLibraryEntry, { type: 'artifact' }>['payload'];
  page?: number;
  pageSize?: number;
  total?: number;
  totalPages?: number;
  generated?: number;
  error?: string;
}

interface DailyMaterialGenerationSettingsResponse {
  success?: boolean;
  settings?: ItemLibraryDailyMaterialGenerationSettings;
  error?: string;
}

const artifactAffixOptions = DEFAULT_AFFIX_REGISTRY.getAll()
  .filter((affix) => affix.applicableTo.includes('artifact'))
  .map((affix) => ({
    id: affix.id,
    name: affix.displayName,
    description: affix.displayDescription,
    slot: affix.slot,
    rarity: affix.rarity,
  }));

const conditionStatusOptions = getAllConditionStatusTemplates().map(
  (status) => ({
    key: status.key,
    name: status.name,
  }),
);

function isDedicatedPillStatus(status: string) {
  return (
    status === CULTIVATION_BOOST_STATUS_KEY ||
    status === BREAKTHROUGH_FOCUS_STATUS_KEY ||
    status === PROTECT_MERIDIANS_STATUS_KEY ||
    status === CLEAR_MIND_STATUS_KEY
  );
}

function getEntryMeta(entry: ItemLibraryEntry) {
  const parts = [ITEM_LIBRARY_TYPE_LABELS[entry.type]];
  if (entry.quality) parts.push(entry.quality);
  if (entry.element) parts.push(entry.element);
  if (entry.category) parts.push(entry.category);
  return parts.join(' / ');
}

export default function ItemLibraryAdminPage() {
  const { pushToast } = useInkUI();
  const [items, setItems] = useState<ItemLibraryEntry[]>([]);
  const [draft, setDraft] = useState<ItemLibraryDraft>(() =>
    createEmptyDraft(),
  );
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [statusFilter, setStatusFilter] = useState('published');
  const [typeFilter, setTypeFilter] = useState('');
  const [query, setQuery] = useState('');
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [generateCount, setGenerateCount] = useState('20');
  const [generateType, setGenerateType] = useState(MATERIAL_TYPE_VALUES[0]);
  const [generateQuality, setGenerateQuality] = useState(QUALITY_VALUES[0]);
  const [generateSeed, setGenerateSeed] = useState('');
  const [dailySettings, setDailySettings] =
    useState<ItemLibraryDailyMaterialGenerationSettings>(
      DEFAULT_ITEM_LIBRARY_DAILY_MATERIAL_GENERATION_SETTINGS,
    );
  const [dailySettingsLoading, setDailySettingsLoading] = useState(true);
  const [dailySettingsSaving, setDailySettingsSaving] = useState(false);
  const [affixQuery, setAffixQuery] = useState('');
  const [affixSlotFilter, setAffixSlotFilter] = useState('');
  const [affixRarityFilter, setAffixRarityFilter] = useState('');

  const selectedAffixSet = useMemo(
    () => new Set(draft.artifactAffixIds),
    [draft.artifactAffixIds],
  );
  const selectedAffixes = useMemo(
    () =>
      artifactAffixOptions.filter((affix) => selectedAffixSet.has(affix.id)),
    [selectedAffixSet],
  );
  const affixSlots = useMemo(
    () =>
      Array.from(new Set(artifactAffixOptions.map((affix) => affix.slot))),
    [],
  );
  const affixRarities = useMemo(
    () =>
      Array.from(new Set(artifactAffixOptions.map((affix) => affix.rarity))),
    [],
  );
  const filteredAffixOptions = useMemo(() => {
    const keyword = affixQuery.trim().toLowerCase();
    return artifactAffixOptions.filter((affix) => {
      if (affixSlotFilter && affix.slot !== affixSlotFilter) {
        return false;
      }
      if (affixRarityFilter && affix.rarity !== affixRarityFilter) {
        return false;
      }
      if (!keyword) return true;
      return [
        affix.name,
        affix.description,
        affix.slot,
        affix.rarity,
        affix.id,
      ]
        .join(' ')
        .toLowerCase()
        .includes(keyword);
    });
  }, [affixQuery, affixRarityFilter, affixSlotFilter]);

  const loadItems = useCallback(async () => {
    const params = new URLSearchParams();
    if (statusFilter) params.set('status', statusFilter);
    if (typeFilter) params.set('type', typeFilter);
    if (query.trim()) params.set('q', query.trim());
    params.set('page', String(page));
    params.set('pageSize', '20');

    const response = await fetch(
      `/api/admin/item-library?${params.toString()}`,
    );
    const data = (await response.json()) as ItemLibraryResponse;
    if (!response.ok) {
      throw new Error(data.error ?? '加载道具库失败');
    }
    setItems(data.items ?? []);
    setTotalPages(data.totalPages ?? 1);
  }, [page, query, statusFilter, typeFilter]);

  useEffect(() => {
    let cancelled = false;

    (async () => {
      setLoading(true);
      try {
        await loadItems();
      } catch (error) {
        if (!cancelled) {
          pushToast({
            message: error instanceof Error ? error.message : '加载道具库失败',
            tone: 'danger',
          });
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [loadItems, pushToast]);

  useEffect(() => {
    let cancelled = false;

    (async () => {
      setDailySettingsLoading(true);
      try {
        const response = await fetch(
          '/api/admin/item-library/materials/daily-generation-settings',
        );
        const data =
          (await response.json()) as DailyMaterialGenerationSettingsResponse;
        if (!response.ok || !data.settings) {
          throw new Error(data.error ?? '加载每日生成配置失败');
        }
        if (!cancelled) setDailySettings(data.settings);
      } catch (error) {
        if (!cancelled) {
          pushToast({
            message:
              error instanceof Error ? error.message : '加载每日生成配置失败',
            tone: 'danger',
          });
        }
      } finally {
        if (!cancelled) setDailySettingsLoading(false);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [pushToast]);

  const setDraftField = <K extends keyof ItemLibraryDraft>(
    key: K,
    value: ItemLibraryDraft[K],
  ) => {
    setDraft((current) => ({ ...current, [key]: value }));
  };

  const previewArtifact = async () => {
    if (draft.type !== 'artifact') return null;
    if (draft.artifactAffixIds.length === 0) {
      throw new Error('请至少选择一个法宝词缀');
    }

    const response = await fetch('/api/admin/item-library/artifact/preview', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        name: draft.name.trim(),
        description: draft.description.trim() || undefined,
        slot: draft.artifactSlot,
        element: draft.artifactElement,
        quality: draft.artifactQuality,
        realm: draft.artifactRealm || undefined,
        realmStage: draft.artifactRealmStage || undefined,
        affixIds: draft.artifactAffixIds,
      }),
    });
    const data = (await response.json()) as ItemLibraryResponse;
    if (!response.ok || !data.payload) {
      throw new Error(data.error ?? '生成法宝预览失败');
    }
    setDraftField('artifactPayload', data.payload);
    return data.payload;
  };

  const buildSubmitBody = async (): Promise<
    CreateItemLibraryEntry | UpdateItemLibraryEntry
  > => {
    if (draft.type === 'artifact' && !draft.artifactPayload) {
      const payload = await previewArtifact();
      return buildItemLibrarySubmitBody({
        ...draft,
        artifactPayload: payload,
      });
    }

    return buildItemLibrarySubmitBody(draft);
  };

  const save = async () => {
    if (!draft.rowId && !draft.itemId.trim()) {
      pushToast({ message: '请填写道具 ID', tone: 'warning' });
      return;
    }

    setSaving(true);
    try {
      const body = await buildSubmitBody();
      const isUpdate = Boolean(draft.rowId);
      const bodyToSend = isUpdate
        ? (() => {
            const copy = { ...body };
            delete (copy as Partial<CreateItemLibraryEntry>).itemId;
            return copy;
          })()
        : body;
      const response = await fetch(
        isUpdate
          ? `/api/admin/item-library/${draft.rowId}`
          : '/api/admin/item-library',
        {
          method: isUpdate ? 'PUT' : 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(bodyToSend),
        },
      );
      const data = (await response.json()) as ItemLibraryResponse;
      if (!response.ok || !data.item) {
        throw new Error(data.error ?? '保存道具失败');
      }

      setDraft(entryToDraft(data.item));
      await loadItems();
      pushToast({ message: '道具已保存', tone: 'success' });
    } catch (error) {
      pushToast({
        message: error instanceof Error ? error.message : '保存道具失败',
        tone: 'danger',
      });
    } finally {
      setSaving(false);
    }
  };

  const archive = async () => {
    if (!draft.rowId) return;
    setSaving(true);
    try {
      const response = await fetch(
        `/api/admin/item-library/${draft.rowId}/archive`,
        { method: 'POST' },
      );
      const data = (await response.json()) as ItemLibraryResponse;
      if (!response.ok || !data.item) {
        throw new Error(data.error ?? '归档道具失败');
      }
      setDraft(entryToDraft(data.item));
      await loadItems();
      pushToast({ message: '道具已归档', tone: 'success' });
    } catch (error) {
      pushToast({
        message: error instanceof Error ? error.message : '归档道具失败',
        tone: 'danger',
      });
    } finally {
      setSaving(false);
    }
  };

  const generateMaterials = async () => {
    const count = Number(generateCount);
    if (!Number.isInteger(count) || count < 1) {
      pushToast({ message: '生成数量必须为正整数', tone: 'warning' });
      return;
    }
    setSaving(true);
    try {
      const response = await fetch(
        '/api/admin/item-library/materials/generate',
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            count,
            materialType: generateType,
            quality: generateQuality,
            status: 'published',
            seed: generateSeed.trim() || undefined,
          }),
        },
      );
      const data = (await response.json()) as ItemLibraryResponse;
      if (!response.ok) {
        throw new Error(data.error ?? '批量生成材料失败');
      }
      pushToast({
        message: `已生成 ${data.generated ?? data.items?.length ?? 0} 个材料`,
        tone: 'success',
      });
      setTypeFilter('material');
      await loadItems();
    } catch (error) {
      pushToast({
        message: error instanceof Error ? error.message : '批量生成材料失败',
        tone: 'danger',
      });
    } finally {
      setSaving(false);
    }
  };

  const saveDailySettings = async () => {
    if (!Number.isInteger(dailySettings.count) || dailySettings.count < 1) {
      pushToast({ message: '每日生成数量必须为正整数', tone: 'warning' });
      return;
    }

    setDailySettingsSaving(true);
    try {
      const response = await fetch(
        '/api/admin/item-library/materials/daily-generation-settings',
        {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(dailySettings),
        },
      );
      const data =
        (await response.json()) as DailyMaterialGenerationSettingsResponse;
      if (!response.ok || !data.settings) {
        throw new Error(data.error ?? '保存每日生成配置失败');
      }
      setDailySettings(data.settings);
      pushToast({ message: '每日生成配置已保存', tone: 'success' });
    } catch (error) {
      pushToast({
        message:
          error instanceof Error ? error.message : '保存每日生成配置失败',
        tone: 'danger',
      });
    } finally {
      setDailySettingsSaving(false);
    }
  };

  const toggleAffix = (affixId: string) => {
    setDraft((current) => {
      const exists = current.artifactAffixIds.includes(affixId);
      return {
        ...current,
        artifactPayload: null,
        artifactAffixIds: exists
          ? current.artifactAffixIds.filter((id) => id !== affixId)
          : [...current.artifactAffixIds, affixId],
      };
    });
  };

  const updatePillOperation = (
    index: number,
    nextOperation: VisualPillOperation,
  ) => {
    setDraft((current) => ({
      ...current,
      pillOperations: current.pillOperations.map((operation, operationIndex) =>
        operationIndex === index ? nextOperation : operation,
      ),
    }));
  };

  const removePillOperation = (index: number) => {
    setDraft((current) => ({
      ...current,
      pillOperations: current.pillOperations.filter(
        (_, operationIndex) => operationIndex !== index,
      ),
    }));
  };

  const addPillOperation = () => {
    setDraft((current) => ({
      ...current,
      pillOperations: [
        ...current.pillOperations,
        createDefaultPillOperation('restore_resource'),
      ],
    }));
  };

  return (
    <div className="space-y-6">
      <header className="border-ink/15 bg-bgpaper/90 border border-dashed p-6">
        <p className="text-ink-secondary text-xs tracking-[0.22em]">
          ITEM LIBRARY
        </p>
        <h2 className="font-heading text-ink mt-2 text-3xl">道具库</h2>
        <p className="text-ink-secondary mt-3 max-w-2xl text-sm leading-7">
          维护可被兑换码、游戏邮件和后续商城引用的道具。邮件发送会写入附件快照；
          使用 itemId 的系统会读取当前 published 版本。
        </p>
      </header>

      <section className="grid gap-5 xl:grid-cols-[360px_1fr]">
        <aside className="border-ink/15 bg-bgpaper/90 space-y-4 border border-dashed p-5">
          <div className="grid gap-3">
            <InkInput
              label="搜索"
              value={query}
              onChange={(value) => {
                setQuery(value);
                setPage(1);
              }}
              placeholder="名称或 itemId"
            />
            <div className="grid grid-cols-2 gap-3">
              <InkSelect
                label="状态"
                value={statusFilter}
                onChange={(value) => {
                  setStatusFilter(value);
                  setPage(1);
                }}
              >
                <option value="">全部</option>
                <option value="published">
                  {ITEM_LIBRARY_STATUS_LABELS.published}
                </option>
                <option value="archived">
                  {ITEM_LIBRARY_STATUS_LABELS.archived}
                </option>
              </InkSelect>
              <InkSelect
                label="类型"
                value={typeFilter}
                onChange={(value) => {
                  setTypeFilter(value);
                  setPage(1);
                }}
              >
                <option value="">全部</option>
                <option value="material">
                  {ITEM_LIBRARY_TYPE_LABELS.material}
                </option>
                <option value="consumable">
                  {ITEM_LIBRARY_TYPE_LABELS.consumable}
                </option>
                <option value="artifact">
                  {ITEM_LIBRARY_TYPE_LABELS.artifact}
                </option>
              </InkSelect>
            </div>
            <InkButton
              type="button"
              variant="secondary"
              onClick={() => setDraft(createEmptyDraft())}
            >
              新建道具
            </InkButton>
          </div>

          <div className="border-ink/15 bg-paper/70 space-y-3 border border-dashed p-3">
            <p className="text-ink font-semibold">批量生成材料</p>
            <InkInput
              label="数量"
              value={generateCount}
              onChange={setGenerateCount}
              placeholder="20"
            />
            <InkInput
              label="Seed"
              value={generateSeed}
              onChange={setGenerateSeed}
              placeholder="留空则按时间生成"
            />
            <div className="grid grid-cols-2 gap-3">
              <InkSelect
                label="材料类型"
                value={generateType}
                onChange={(value) =>
                  setGenerateType(value as typeof generateType)
                }
              >
                {MATERIAL_TYPE_VALUES.map((value) => (
                  <option key={value} value={value}>
                    {getMaterialTypeLabel(value)}
                  </option>
                ))}
              </InkSelect>
              <InkSelect
                label="品质"
                value={generateQuality}
                onChange={(value) =>
                  setGenerateQuality(value as typeof generateQuality)
                }
              >
                {QUALITY_VALUES.map((value) => (
                  <option key={value} value={value}>
                    {value}
                  </option>
                ))}
              </InkSelect>
            </div>
            <InkButton
              type="button"
              variant="secondary"
              onClick={generateMaterials}
              disabled={saving}
            >
              生成入库
            </InkButton>
          </div>

          <div className="border-ink/15 bg-paper/70 space-y-3 border border-dashed p-3">
            <p className="text-ink font-semibold">每日随机材料生成</p>
            <label className="text-ink flex items-center gap-2 text-sm">
              <input
                type="checkbox"
                checked={dailySettings.enabled}
                onChange={(event) =>
                  setDailySettings((current) => ({
                    ...current,
                    enabled: event.target.checked,
                  }))
                }
                className="accent-crimson"
              />
              开启每日 01:00 自动入库
            </label>
            <InkInput
              label="每日数量"
              value={String(dailySettings.count)}
              onChange={(value) =>
                setDailySettings((current) => ({
                  ...current,
                  count: Number(value),
                }))
              }
              type="number"
              placeholder="20"
            />
            <InkButton
              type="button"
              variant="secondary"
              onClick={saveDailySettings}
              disabled={dailySettingsSaving || dailySettingsLoading}
            >
              保存配置
            </InkButton>
          </div>

          {loading ? <InkNotice tone="muted">道具库加载中...</InkNotice> : null}
          {!loading && items.length === 0 ? (
            <InkNotice tone="warning">当前筛选下没有道具。</InkNotice>
          ) : null}

          <div className="space-y-2">
            {items.map((item) => (
              <button
                key={item.id}
                type="button"
                onClick={() => setDraft(entryToDraft(item))}
                className="border-ink/15 bg-paper/80 hover:border-crimson/50 block w-full border border-dashed p-3 text-left transition"
              >
                <span className="text-ink block font-semibold">
                  {item.name}
                </span>
                <span className="text-ink-secondary mt-1 block text-xs">
                  {item.itemId} · {ITEM_LIBRARY_STATUS_LABELS[item.status]} ·{' '}
                  {getEntryMeta(item)}
                </span>
              </button>
            ))}
          </div>
          <div className="flex items-center justify-between gap-3">
            <InkButton
              type="button"
              variant="secondary"
              onClick={() => setPage((current) => Math.max(1, current - 1))}
              disabled={page <= 1}
            >
              上一页
            </InkButton>
            <span className="text-ink-secondary text-xs">
              {page} / {totalPages}
            </span>
            <InkButton
              type="button"
              variant="secondary"
              onClick={() => setPage((current) => current + 1)}
              disabled={page >= totalPages}
            >
              下一页
            </InkButton>
          </div>
        </aside>

        <section className="border-ink/15 bg-bgpaper/90 space-y-5 border border-dashed p-5">
          <div className="grid gap-3 md:grid-cols-3">
            <InkInput
              label="道具 ID"
              value={draft.itemId}
              onChange={(value) => setDraftField('itemId', value)}
              placeholder="例如：refined_iron"
              disabled={Boolean(draft.rowId)}
            />
            <InkSelect
              label="类型"
              value={draft.type}
              onChange={(value) =>
                setDraft((current) =>
                  resetDraftForType(current, value as ItemLibraryEntry['type']),
                )
              }
              disabled={Boolean(draft.rowId)}
            >
              <option value="material">
                {ITEM_LIBRARY_TYPE_LABELS.material}
              </option>
              <option value="consumable">
                {ITEM_LIBRARY_TYPE_LABELS.consumable}
              </option>
              <option value="artifact">
                {ITEM_LIBRARY_TYPE_LABELS.artifact}
              </option>
            </InkSelect>
            <InkSelect
              label="状态"
              value={draft.status}
              onChange={(value) =>
                setDraftField('status', value as ItemLibraryEntry['status'])
              }
            >
              <option value="published">
                {ITEM_LIBRARY_STATUS_LABELS.published}
              </option>
              <option value="archived">
                {ITEM_LIBRARY_STATUS_LABELS.archived}
              </option>
            </InkSelect>
          </div>

          <div className="grid gap-3 md:grid-cols-2">
            <InkInput
              label="名称"
              value={draft.name}
              onChange={(value) => {
                setDraftField('name', value);
                setDraftField('artifactPayload', null);
              }}
              placeholder="道具显示名称"
            />
            <InkInput
              label="描述"
              value={draft.description}
              onChange={(value) => {
                setDraftField('description', value);
                setDraftField('artifactPayload', null);
              }}
              placeholder="可选"
            />
          </div>

          {draft.type === 'material' ? (
            <div className="grid gap-3 md:grid-cols-3">
              <InkSelect
                label="材料类型"
                value={draft.materialType}
                onChange={(value) =>
                  setDraftField(
                    'materialType',
                    value as ItemLibraryDraft['materialType'],
                  )
                }
              >
                {MATERIAL_TYPE_VALUES.map((value) => (
                  <option key={value} value={value}>
                    {getMaterialTypeLabel(value)}
                  </option>
                ))}
              </InkSelect>
              <InkSelect
                label="品阶"
                value={draft.materialRank}
                onChange={(value) =>
                  setDraftField(
                    'materialRank',
                    value as ItemLibraryDraft['materialRank'],
                  )
                }
              >
                {QUALITY_VALUES.map((value) => (
                  <option key={value} value={value}>
                    {value}
                  </option>
                ))}
              </InkSelect>
              <InkSelect
                label="元素"
                value={draft.materialElement}
                onChange={(value) =>
                  setDraftField(
                    'materialElement',
                    value as ItemLibraryDraft['materialElement'],
                  )
                }
              >
                <option value="">无</option>
                {ELEMENT_VALUES.map((value) => (
                  <option key={value} value={value}>
                    {value}
                  </option>
                ))}
              </InkSelect>
            </div>
          ) : null}

          {draft.type === 'consumable' ? (
            <div className="space-y-5">
              <div className="grid gap-3 md:grid-cols-4">
                <InkSelect
                  label="消耗品类别"
                  value={draft.consumableKind}
                  onChange={(value) =>
                    setDraftField(
                      'consumableKind',
                      value as ItemLibraryDraft['consumableKind'],
                    )
                  }
                >
                  <option value="pill">丹药</option>
                  <option value="talisman">符箓</option>
                </InkSelect>
                <InkSelect
                  label="品质"
                  value={draft.consumableQuality}
                  onChange={(value) =>
                    setDraftField(
                      'consumableQuality',
                      value as ItemLibraryDraft['consumableQuality'],
                    )
                  }
                >
                  {QUALITY_VALUES.map((value) => (
                    <option key={value} value={value}>
                      {value}
                    </option>
                  ))}
                </InkSelect>
                <InkSelect
                  label="元素"
                  value={draft.consumableElement}
                  onChange={(value) =>
                    setDraftField(
                      'consumableElement',
                      value as ItemLibraryDraft['consumableElement'],
                    )
                  }
                >
                  <option value="">无</option>
                  {ELEMENT_VALUES.map((value) => (
                    <option key={value} value={value}>
                      {value}
                    </option>
                  ))}
                </InkSelect>
                <InkInput
                  label="评分"
                  value={draft.consumableScore}
                  onChange={(value) => setDraftField('consumableScore', value)}
                  type="number"
                  placeholder="例如：80"
                />
              </div>

              {draft.consumableKind === 'pill' ? (
                <div className="space-y-4">
                  <div className="grid gap-3 md:grid-cols-5">
                    <InkSelect
                      label="丹药用途"
                      value={draft.pillFamily}
                      onChange={(value) =>
                        setDraft((current) =>
                          resetPillOperationsForFamily(
                            current,
                            value as ItemLibraryDraft['pillFamily'],
                          ),
                        )
                      }
                    >
                      {PILL_FAMILY_VALUES.map((value) => (
                        <option key={value} value={value}>
                          {PILL_FAMILY_LABELS[value]}
                        </option>
                      ))}
                    </InkSelect>
                    <InkSelect
                      label="服用额度"
                      value={draft.pillQuotaCategory}
                      onChange={(value) =>
                        setDraftField(
                          'pillQuotaCategory',
                          value as ItemLibraryDraft['pillQuotaCategory'],
                        )
                      }
                    >
                      {PILL_QUOTA_CATEGORY_VALUES.map((value) => (
                        <option key={value} value={value}>
                          {PILL_QUOTA_LABELS[value]}
                        </option>
                      ))}
                    </InkSelect>
                    <InkSelect
                      label="品相"
                      value={draft.pillAppearance}
                      onChange={(value) =>
                        setDraftField(
                          'pillAppearance',
                          value as ItemLibraryDraft['pillAppearance'],
                        )
                      }
                    >
                      <option value="">旧制/未设置</option>
                      {PILL_APPEARANCE_GRADE_VALUES.map((value) => (
                        <option key={value} value={value}>
                          {getPillAppearanceLabel(value)}
                        </option>
                      ))}
                    </InkSelect>
                    <InkInput
                      label="药性稳定度"
                      value={draft.pillStability}
                      onChange={(value) =>
                        setDraftField('pillStability', value)
                      }
                      type="number"
                      placeholder="例如：80"
                    />
                    <InkInput
                      label="丹毒"
                      value={draft.pillToxicity}
                      onChange={(value) => setDraftField('pillToxicity', value)}
                      type="number"
                      placeholder="例如：5"
                    />
                  </div>
                  <InkInput
                    label="来源材料"
                    value={draft.pillSourceMaterials}
                    onChange={(value) =>
                      setDraftField('pillSourceMaterials', value)
                    }
                    placeholder="可用逗号或顿号分隔，例如：青木芝、寒魄晶"
                  />

                  <div className="border-ink/12 bg-paper/70 space-y-3 border border-dashed p-4">
                    <div className="flex flex-wrap items-center justify-between gap-3">
                      <h3 className="text-ink font-heading text-lg">
                        丹药效果
                      </h3>
                      <InkButton
                        type="button"
                        variant="secondary"
                        onClick={addPillOperation}
                      >
                        添加效果
                      </InkButton>
                    </div>

                    {draft.pillOperations.length === 0 ? (
                      <InkNotice tone="warning">
                        请至少添加一个丹药效果。
                      </InkNotice>
                    ) : null}

                    {draft.pillOperations.map((operation, index) => (
                      <div
                        key={`${operation.type}-${index}`}
                        className="border-ink/12 bg-bgpaper/70 space-y-3 border border-dashed p-3"
                      >
                        <div className="grid gap-3 md:grid-cols-[1fr_auto]">
                          <InkSelect
                            label={`效果 #${index + 1}`}
                            value={operation.type}
                            onChange={(value) =>
                              updatePillOperation(
                                index,
                                createDefaultPillOperation(
                                  value as VisualPillOperation['type'],
                                ),
                              )
                            }
                          >
                            {Object.entries(PILL_OPERATION_LABELS).map(
                              ([value, label]) => (
                                <option key={value} value={value}>
                                  {label}
                                </option>
                              ),
                            )}
                          </InkSelect>
                          <div className="flex items-end">
                            <InkButton
                              type="button"
                              variant="secondary"
                              onClick={() => removePillOperation(index)}
                            >
                              删除
                            </InkButton>
                          </div>
                        </div>

                        {operation.type === 'restore_resource' ? (
                          <div className="grid gap-3 md:grid-cols-3">
                            <InkSelect
                              label="恢复对象"
                              value={operation.resource}
                              onChange={(value) =>
                                updatePillOperation(index, {
                                  ...operation,
                                  resource: value as typeof operation.resource,
                                })
                              }
                            >
                              <option value="hp">气血</option>
                              <option value="mp">法力</option>
                            </InkSelect>
                            <InkSelect
                              label="恢复方式"
                              value={operation.mode}
                              onChange={(value) =>
                                updatePillOperation(index, {
                                  ...operation,
                                  mode: value as typeof operation.mode,
                                })
                              }
                            >
                              <option value="flat">固定数值</option>
                              <option value="percent">最大值百分比</option>
                            </InkSelect>
                            <InkInput
                              label={
                                operation.mode === 'percent'
                                  ? '恢复百分比'
                                  : '恢复数值'
                              }
                              value={operation.value}
                              onChange={(value) =>
                                updatePillOperation(index, {
                                  ...operation,
                                  value,
                                })
                              }
                              type="number"
                              hint={
                                operation.mode === 'percent'
                                  ? '填写 20 表示恢复最大值的 20%。'
                                  : undefined
                              }
                            />
                          </div>
                        ) : null}

                        {operation.type === 'gain_progress' ? (
                          <div className="grid gap-3 md:grid-cols-2">
                            <InkSelect
                              label="增加对象"
                              value={operation.target}
                              onChange={(value) =>
                                updatePillOperation(index, {
                                  ...operation,
                                  target: value as typeof operation.target,
                                })
                              }
                            >
                              <option value="cultivation_exp">
                                修为（历史丹药）
                              </option>
                              <option value="comprehension_insight">
                                悟性
                              </option>
                            </InkSelect>
                            <InkInput
                              label="增加数值"
                              value={operation.value}
                              onChange={(value) =>
                                updatePillOperation(index, {
                                  ...operation,
                                  value,
                                })
                              }
                              type="number"
                              hint={
                                operation.target === 'cultivation_exp'
                                  ? '仅用于历史丹药，不建议新建修为丹使用。'
                                  : undefined
                              }
                            />
                          </div>
                        ) : null}

                        {operation.type === 'increase_lifespan' ? (
                          <InkInput
                            label="增加寿元年数"
                            value={operation.value}
                            onChange={(value) =>
                              updatePillOperation(index, {
                                ...operation,
                                value,
                              })
                            }
                            type="number"
                          />
                        ) : null}

                        {operation.type === 'change_gauge' ? (
                          <InkInput
                            label="丹毒变化"
                            value={operation.delta}
                            onChange={(value) =>
                              updatePillOperation(index, {
                                ...operation,
                                delta: value,
                              })
                            }
                            type="number"
                            hint="正数增加丹毒，负数降低丹毒。"
                          />
                        ) : null}

                        {operation.type === 'add_status' ? (
                          <div className="grid gap-3 md:grid-cols-4">
                            <InkSelect
                              label="添加状态"
                              value={operation.status}
                              onChange={(value) =>
                                updatePillOperation(index, {
                                  ...operation,
                                  status: value,
                                })
                              }
                            >
                              {conditionStatusOptions.map((status) => (
                                <option key={status.key} value={status.key}>
                                  {status.name}
                                </option>
                              ))}
                            </InkSelect>

                            {operation.status ===
                            CULTIVATION_BOOST_STATUS_KEY ? (
                              <InkInput
                                label="下次闭关修为提升百分比"
                                value={operation.boostPercent}
                                onChange={(value) =>
                                  updatePillOperation(index, {
                                    ...operation,
                                    boostPercent: value,
                                  })
                                }
                                type="number"
                                hint="填写 20 表示下次闭关修为提升 20%。"
                              />
                            ) : null}

                            {operation.status ===
                            BREAKTHROUGH_FOCUS_STATUS_KEY ? (
                              <InkInput
                                label="破境成功率提升百分比"
                                value={operation.breakthroughChanceBonus}
                                onChange={(value) =>
                                  updatePillOperation(index, {
                                    ...operation,
                                    breakthroughChanceBonus: value,
                                  })
                                }
                                type="number"
                                hint="填写 6 表示破境成功率 +6%。"
                              />
                            ) : null}

                            {operation.status ===
                            PROTECT_MERIDIANS_STATUS_KEY ? (
                              <InkInput
                                label="失败修为损失降低百分比"
                                value={operation.failureExpLossReductionPercent}
                                onChange={(value) =>
                                  updatePillOperation(index, {
                                    ...operation,
                                    failureExpLossReductionPercent: value,
                                  })
                                }
                                type="number"
                                hint="填写 40 表示失败修为损失降低 40%。"
                              />
                            ) : null}

                            <InkInput
                              label={
                                operation.status === CLEAR_MIND_STATUS_KEY
                                  ? '可用突破次数'
                                  : '可用次数'
                              }
                              value={operation.usesRemaining}
                              onChange={(value) =>
                                updatePillOperation(index, {
                                  ...operation,
                                  usesRemaining: value,
                                })
                              }
                              type="number"
                              placeholder="可选"
                            />

                            {!isDedicatedPillStatus(operation.status) ? (
                              <>
                                <InkInput
                                  label="状态层数"
                                  value={operation.stacks}
                                  onChange={(value) =>
                                    updatePillOperation(index, {
                                      ...operation,
                                      stacks: value,
                                    })
                                  }
                                  type="number"
                                  placeholder="可选"
                                />
                                <InkSelect
                                  label="持续方式"
                                  value={operation.durationKind}
                                  onChange={(value) =>
                                    updatePillOperation(index, {
                                      ...operation,
                                      durationKind:
                                        value as typeof operation.durationKind,
                                    })
                                  }
                                >
                                  <option value="">默认</option>
                                  <option value="until_removed">
                                    直到被移除
                                  </option>
                                  <option value="time">指定结束时间</option>
                                </InkSelect>
                                {operation.durationKind === 'time' ? (
                                  <InkInput
                                    label="结束时间"
                                    value={operation.expiresAt}
                                    onChange={(value) =>
                                      updatePillOperation(index, {
                                        ...operation,
                                        expiresAt: value,
                                      })
                                    }
                                    placeholder="ISO 时间"
                                  />
                                ) : null}
                              </>
                            ) : null}
                          </div>
                        ) : null}

                        {operation.type === 'remove_status' ? (
                          <div className="grid gap-3 md:grid-cols-[1fr_auto]">
                            <InkSelect
                              label="移除状态"
                              value={operation.status}
                              onChange={(value) =>
                                updatePillOperation(index, {
                                  ...operation,
                                  status: value,
                                })
                              }
                            >
                              {conditionStatusOptions.map((status) => (
                                <option key={status.key} value={status.key}>
                                  {status.name}
                                </option>
                              ))}
                            </InkSelect>
                            <label className="text-ink flex items-end gap-2 pb-2 text-sm">
                              <input
                                type="checkbox"
                                checked={operation.removeAll}
                                onChange={(event) =>
                                  updatePillOperation(index, {
                                    ...operation,
                                    removeAll: event.target.checked,
                                  })
                                }
                              />
                              全部移除
                            </label>
                          </div>
                        ) : null}

                        {operation.type === 'advance_track' ? (
                          <div className="grid gap-3 md:grid-cols-2">
                            <InkSelect
                              label="推进项目"
                              value={operation.track}
                              onChange={(value) =>
                                updatePillOperation(index, {
                                  ...operation,
                                  track: value as typeof operation.track,
                                })
                              }
                            >
                              {TRACK_OPTIONS.map((option) => (
                                <option key={option.value} value={option.value}>
                                  {option.label}
                                </option>
                              ))}
                            </InkSelect>
                            <InkInput
                              label="推进数值"
                              value={operation.value}
                              onChange={(value) =>
                                updatePillOperation(index, {
                                  ...operation,
                                  value,
                                })
                              }
                              type="number"
                            />
                          </div>
                        ) : null}
                      </div>
                    ))}
                  </div>
                </div>
              ) : (
                <div className="grid gap-3 md:grid-cols-2">
                  <InkInput
                    label="使用场景"
                    value={draft.talismanScenario}
                    onChange={(value) =>
                      setDraftField('talismanScenario', value)
                    }
                    placeholder="例如：fate_reshape"
                  />
                  <InkSelect
                    label="消耗模式"
                    value={draft.talismanSessionMode}
                    onChange={(value) =>
                      setDraftField(
                        'talismanSessionMode',
                        value as ItemLibraryDraft['talismanSessionMode'],
                      )
                    }
                  >
                    {TALISMAN_SESSION_MODE_VALUES.map((value) => (
                      <option key={value} value={value}>
                        {TALISMAN_SESSION_MODE_LABELS[value]}
                      </option>
                    ))}
                  </InkSelect>
                  <div className="md:col-span-2">
                    <InkInput
                      label="备注"
                      value={draft.talismanNotes}
                      onChange={(value) =>
                        setDraftField('talismanNotes', value)
                      }
                      placeholder="可选，给运营自己看的说明"
                      multiline
                      rows={3}
                    />
                  </div>
                </div>
              )}
            </div>
          ) : null}

          {draft.type === 'artifact' ? (
            <div className="space-y-4">
              <div className="grid gap-3 md:grid-cols-5">
                <InkSelect
                  label="槽位"
                  value={draft.artifactSlot}
                  onChange={(value) => {
                    setDraftField(
                      'artifactSlot',
                      value as ItemLibraryDraft['artifactSlot'],
                    );
                    setDraftField('artifactPayload', null);
                  }}
                >
                  {EQUIPMENT_SLOT_VALUES.map((value) => (
                    <option key={value} value={value}>
                      {getEquipmentSlotLabel(value)}
                    </option>
                  ))}
                </InkSelect>
                <InkSelect
                  label="元素"
                  value={draft.artifactElement}
                  onChange={(value) => {
                    setDraftField(
                      'artifactElement',
                      value as ItemLibraryDraft['artifactElement'],
                    );
                    setDraftField('artifactPayload', null);
                  }}
                >
                  {ELEMENT_VALUES.map((value) => (
                    <option key={value} value={value}>
                      {value}
                    </option>
                  ))}
                </InkSelect>
                <InkSelect
                  label="品质"
                  value={draft.artifactQuality}
                  onChange={(value) => {
                    setDraftField(
                      'artifactQuality',
                      value as ItemLibraryDraft['artifactQuality'],
                    );
                    setDraftField('artifactPayload', null);
                  }}
                >
                  {QUALITY_VALUES.map((value) => (
                    <option key={value} value={value}>
                      {value}
                    </option>
                  ))}
                </InkSelect>
                <InkSelect
                  label="境界锚点"
                  value={draft.artifactRealm}
                  onChange={(value) => {
                    setDraftField(
                      'artifactRealm',
                      value as ItemLibraryDraft['artifactRealm'],
                    );
                    setDraftField('artifactPayload', null);
                  }}
                >
                  <option value="">无</option>
                  {REALM_VALUES.map((value) => (
                    <option key={value} value={value}>
                      {value}
                    </option>
                  ))}
                </InkSelect>
                <InkSelect
                  label="阶段锚点"
                  value={draft.artifactRealmStage}
                  onChange={(value) => {
                    setDraftField(
                      'artifactRealmStage',
                      value as ItemLibraryDraft['artifactRealmStage'],
                    );
                    setDraftField('artifactPayload', null);
                  }}
                >
                  <option value="">无</option>
                  {REALM_STAGE_VALUES.map((value) => (
                    <option key={value} value={value}>
                      {value}
                    </option>
                  ))}
                </InkSelect>
              </div>

              <div className="border-ink/12 bg-paper/70 space-y-3 border border-dashed p-4">
                <div className="grid gap-3 md:grid-cols-3">
                  <InkInput
                    label="搜索词缀"
                    value={affixQuery}
                    onChange={setAffixQuery}
                    placeholder="输入名称、槽位或描述"
                  />
                  <InkSelect
                    label="词缀槽位"
                    value={affixSlotFilter}
                    onChange={setAffixSlotFilter}
                  >
                    <option value="">全部</option>
                    {affixSlots.map((slot) => (
                      <option key={slot} value={slot}>
                        {slot}
                      </option>
                    ))}
                  </InkSelect>
                  <InkSelect
                    label="稀有度"
                    value={affixRarityFilter}
                    onChange={setAffixRarityFilter}
                  >
                    <option value="">全部</option>
                    {affixRarities.map((rarity) => (
                      <option key={rarity} value={rarity}>
                        {rarity}
                      </option>
                    ))}
                  </InkSelect>
                </div>

                <div className="border-ink/12 bg-bgpaper/70 border border-dashed px-3 py-2">
                  <p className="text-ink-secondary text-xs tracking-[0.18em]">
                    已选词缀
                  </p>
                  <p className="text-ink mt-1 text-sm leading-7">
                    {selectedAffixes.length > 0
                      ? selectedAffixes.map((affix) => affix.name).join('、')
                      : '暂未选择'}
                  </p>
                </div>

                <div className="max-h-[420px] space-y-2 overflow-auto">
                  {filteredAffixOptions.length === 0 ? (
                    <InkNotice tone="warning">
                      没有符合筛选条件的法宝词缀。
                    </InkNotice>
                  ) : null}
                  {filteredAffixOptions.map((affix) => (
                    <label
                      key={affix.id}
                      className="border-ink/12 bg-bgpaper/50 flex gap-3 border border-dashed p-3 text-sm"
                    >
                      <input
                        type="checkbox"
                        checked={selectedAffixSet.has(affix.id)}
                        onChange={() => toggleAffix(affix.id)}
                      />
                      <span>
                        <span className="text-ink font-semibold">
                          {affix.name}
                        </span>
                        <span className="text-ink-secondary ml-2">
                          {affix.slot} / {affix.rarity}
                        </span>
                        <span className="text-ink-secondary mt-1 block">
                          {affix.description}
                        </span>
                      </span>
                    </label>
                  ))}
                </div>
              </div>

              <div className="flex flex-wrap items-center gap-3">
                <InkButton
                  type="button"
                  variant="secondary"
                  onClick={() =>
                    void previewArtifact()
                      .then(() =>
                        pushToast({
                          message: '法宝预览已生成',
                          tone: 'success',
                        }),
                      )
                      .catch((error) =>
                        pushToast({
                          message:
                            error instanceof Error
                              ? error.message
                              : '生成法宝预览失败',
                          tone: 'danger',
                        }),
                      )
                  }
                >
                  生成法宝预览
                </InkButton>
                {draft.artifactPayload ? (
                  <span className="text-ink-secondary text-sm">
                    {draft.artifactPayload.quality ?? '凡品'} / 评分{' '}
                    {draft.artifactPayload.score ?? 0} / 已选{' '}
                    {draft.artifactAffixIds.length} 个词缀
                  </span>
                ) : (
                  <span className="text-ink-secondary text-sm">
                    保存前会自动生成服务端预览。
                  </span>
                )}
              </div>
            </div>
          ) : null}

          <div className="flex flex-wrap gap-3">
            <InkButton
              type="button"
              variant="primary"
              disabled={saving}
              onClick={() => void save()}
            >
              {saving ? '保存中...' : draft.rowId ? '保存修改' : '创建道具'}
            </InkButton>
            {draft.rowId && draft.status !== 'archived' ? (
              <InkButton
                type="button"
                variant="secondary"
                disabled={saving}
                onClick={() => void archive()}
              >
                归档
              </InkButton>
            ) : null}
          </div>
        </section>
      </section>
    </div>
  );
}
