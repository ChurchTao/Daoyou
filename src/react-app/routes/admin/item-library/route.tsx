import {
  InventoryGrid,
  ItemSlot,
} from '@app/components/feature/items/ItemSlot';
import { useInkUI } from '@app/components/providers/InkUIProvider';
import { InkButton, InkInput, InkNotice, InkSelect } from '@app/components/ui';
import { rewardDisplayItem } from '@shared/contracts/adminRewards';
import {
  INVENTORY_MATERIAL_TYPES,
  MATERIAL_TYPE_NAMES,
} from '@shared/items/definitions/materials';
import { libraryMaterialGrant } from '@shared/items/libraryMaterialGrant';
import {
  DEFAULT_ITEM_LIBRARY_DAILY_MATERIAL_GENERATION_SETTINGS,
  type ItemLibraryDailyMaterialGenerationSettings,
} from '@shared/lib/constants/appSettings';
import type {
  CreateItemLibraryEntry,
  ItemLibraryEntry,
} from '@shared/lib/itemLibrary';
import {
  ELEMENT_VALUES,
  MATERIAL_TYPE_VALUES,
  QUALITY_VALUES,
} from '@shared/types/constants';
import { useCallback, useEffect, useState } from 'react';
import { AdminDialog } from '../_components/AdminDialog';
import { AdminPageHeader } from '../_components/AdminPage';
import {
  buildItemLibrarySubmitBody,
  createEmptyDraft,
  entryToDraft,
  type ItemLibraryDraft,
} from './itemLibraryEditor.helpers';
interface ItemLibraryResponse {
  items?: ItemLibraryEntry[];
  item?: ItemLibraryEntry;
  totalPages?: number;
  generated?: number;
  error?: string;
}
interface DailyMaterialGenerationSettingsResponse {
  settings?: ItemLibraryDailyMaterialGenerationSettings;
  error?: string;
}
export default function ItemLibraryAdminPage() {
  const { pushToast } = useInkUI();
  const [items, setItems] = useState<ItemLibraryEntry[]>([]);
  const [draft, setDraft] = useState<ItemLibraryDraft>(() =>
    createEmptyDraft(),
  );
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [dialogError, setDialogError] = useState('');
  const [panel, setPanel] = useState<'edit' | 'generate' | 'daily' | null>(
    null,
  );
  const [generationKind, setGenerationKind] = useState('material');
  const [materialFilter, setMaterialFilter] = useState('');
  const [statusFilter, setStatusFilter] = useState('published');
  const [query, setQuery] = useState('');
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [generateCount, setGenerateCount] = useState('20');
  const [generateType, setGenerateType] =
    useState<(typeof MATERIAL_TYPE_VALUES)[number]>('herb');
  const [generateQuality, setGenerateQuality] = useState(QUALITY_VALUES[0]);
  const [generateSeed, setGenerateSeed] = useState('');
  const [seedGenerateCount, setSeedGenerateCount] = useState('10');
  const [seedGenerateQuality, setSeedGenerateQuality] = useState(
    QUALITY_VALUES[0],
  );
  const [seedGenerateElement, setSeedGenerateElement] = useState('');
  const [dailySettings, setDailySettings] =
    useState<ItemLibraryDailyMaterialGenerationSettings>(
      DEFAULT_ITEM_LIBRARY_DAILY_MATERIAL_GENERATION_SETTINGS,
    );
  const [dailySettingsLoading, setDailySettingsLoading] = useState(true);
  const [dailySettingsSaving, setDailySettingsSaving] = useState(false);

  const openPanel = (next: typeof panel) => {
    setDialogError('');
    setPanel(next);
  };

  const loadItems = useCallback(
    async (signal?: AbortSignal) => {
      const params = new URLSearchParams();
      if (statusFilter) params.set('status', statusFilter);
      params.set('type', 'material');
      if (query.trim()) params.set('q', query.trim());
      params.set('page', String(page));
      params.set('pageSize', '24');
      if (materialFilter) params.set('materialType', materialFilter);

      const response = await fetch(
        `/api/admin/item-library?${params.toString()}`,
        { signal },
      );
      const data = (await response.json()) as ItemLibraryResponse;
      if (!response.ok) {
        throw new Error(data.error ?? '加载道具库失败');
      }
      if (signal?.aborted) return;
      setItems(data.items ?? []);
      setTotalPages(data.totalPages ?? 1);
    },
    [page, query, statusFilter, materialFilter],
  );

  useEffect(() => {
    const controller = new AbortController();
    const timer = setTimeout(async () => {
      setLoading(true);
      try {
        await loadItems(controller.signal);
      } catch (error) {
        if (!controller.signal.aborted)
          pushToast({
            message: error instanceof Error ? error.message : '加载材料库失败',
            tone: 'danger',
          });
      } finally {
        if (!controller.signal.aborted) setLoading(false);
      }
    }, 200);
    return () => {
      clearTimeout(timer);
      controller.abort();
    };
  }, [loadItems, pushToast]);

  useEffect(() => {
    if (panel !== 'daily') return;
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
          setDialogError(
            error instanceof Error ? error.message : '加载每日生成配置失败',
          );
        }
      } finally {
        if (!cancelled) setDailySettingsLoading(false);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [pushToast, panel]);

  const setDraftField = <K extends keyof ItemLibraryDraft>(
    key: K,
    value: ItemLibraryDraft[K],
  ) => {
    setDraft((current) => ({ ...current, [key]: value }));
  };

  const buildSubmitBody = async () => {
    return buildItemLibrarySubmitBody(draft);
  };

  const save = async () => {
    if (!draft.rowId && !draft.itemId.trim()) {
      setDialogError('请填写材料 ID');
      return;
    }

    setDialogError('');
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
      openPanel(null);
      pushToast({ message: '材料已保存', tone: 'success' });
    } catch (error) {
      setDialogError(error instanceof Error ? error.message : '保存道具失败');
    } finally {
      setSaving(false);
    }
  };

  const archive = async () => {
    if (!draft.rowId) return;
    setDialogError('');
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
      openPanel(null);
      pushToast({ message: '材料已归档', tone: 'success' });
    } catch (error) {
      setDialogError(error instanceof Error ? error.message : '归档道具失败');
    } finally {
      setSaving(false);
    }
  };

  const generateMaterials = async () => {
    const count = Number(generateCount);
    if (!Number.isInteger(count) || count < 1) {
      setDialogError('生成数量必须为正整数');
      return;
    }
    setDialogError('');
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
      await loadItems();
      openPanel(null);
    } catch (error) {
      setDialogError(
        error instanceof Error ? error.message : '批量生成材料失败',
      );
    } finally {
      setSaving(false);
    }
  };

  const generateSpiritSeeds = async () => {
    const count = Number(seedGenerateCount);
    if (!Number.isInteger(count) || count < 1 || count > 50) {
      setDialogError('灵种生成数量必须为 1 至 50 的整数');
      return;
    }
    setDialogError('');
    setSaving(true);
    try {
      const response = await fetch('/api/admin/item-library/seeds/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          count,
          quality: seedGenerateQuality,
          element: seedGenerateElement || undefined,
          status: 'published',
        }),
      });
      const data = (await response.json()) as ItemLibraryResponse;
      if (!response.ok) {
        throw new Error(data.error ?? '批量生成灵种失败');
      }
      pushToast({
        message: `已生成 ${data.generated ?? data.items?.length ?? 0} 枚灵种并写入道具库`,
        tone: 'success',
      });
      setQuery('');
      setPage(1);
      await loadItems();
      openPanel(null);
    } catch (error) {
      setDialogError(
        error instanceof Error ? error.message : '批量生成灵种失败',
      );
    } finally {
      setSaving(false);
    }
  };

  const saveDailySettings = async () => {
    if (!Number.isInteger(dailySettings.count) || dailySettings.count < 1) {
      setDialogError('每日生成数量必须为正整数');
      return;
    }

    setDialogError('');
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
      openPanel(null);
      pushToast({ message: '每日生成配置已保存', tone: 'success' });
    } catch (error) {
      setDialogError(
        error instanceof Error ? error.message : '保存每日生成配置失败',
      );
    } finally {
      setDailySettingsSaving(false);
    }
  };

  const available = items.flatMap((entry) => {
    try {
      return [{ entry, item: rewardDisplayItem(libraryMaterialGrant(entry)) }];
    } catch {
      return [];
    }
  });
  const unavailable = items.filter(
    (entry) => !available.some((value) => value.entry.id === entry.id),
  );
  return (
    <div className="space-y-6">
      <AdminPageHeader
        title="材料库"
        description="维护可用于上架和发放的材料与灵种。"
        actions={
          <>
            <InkButton
              variant="primary"
              onClick={() => {
                setDraft(createEmptyDraft());
                openPanel('edit');
              }}
            >
              新增材料
            </InkButton>
            <InkButton variant="secondary" onClick={() => openPanel('daily')}>
              每日生成设置
            </InkButton>
            <InkButton onClick={() => openPanel('generate')}>
              批量生成
            </InkButton>
          </>
        }
      />
      <div className="flex flex-wrap items-end gap-4">
        <InkInput
          label="搜索材料"
          value={query}
          onChange={(v) => {
            setQuery(v);
            setPage(1);
          }}
        />
        <InkSelect
          label="材料分类"
          value={materialFilter}
          onChange={(v) => {
            setMaterialFilter(v);
            setPage(1);
          }}
        >
          <option value="">全部</option>
          {INVENTORY_MATERIAL_TYPES.map((v) => (
            <option key={v} value={v}>
              {MATERIAL_TYPE_NAMES[v]}
            </option>
          ))}
          <option value="seed">灵种</option>
        </InkSelect>
        <InkSelect
          label="状态"
          value={statusFilter}
          onChange={(v) => {
            setStatusFilter(v);
            setPage(1);
          }}
        >
          <option value="published">已发布</option>
          <option value="archived">已归档</option>
        </InkSelect>
      </div>
      {loading ? (
        <InkNotice>加载中…</InkNotice>
      ) : (
        <>
          {!available.length && <InkNotice>当前条件下没有可用材料</InkNotice>}
          <InventoryGrid className="grid-cols-3 sm:grid-cols-6 lg:grid-cols-8">
            {available.map(({ entry, item }) => (
              <ItemSlot key={entry.id} item={item} quantityLabel="库存">
                {(close) => (
                  <InkButton
                    onClick={() => {
                      close();
                      setDraft(entryToDraft(entry));
                      openPanel('edit');
                    }}
                  >
                    编辑材料
                  </InkButton>
                )}
              </ItemSlot>
            ))}
          </InventoryGrid>
          {unavailable.length > 0 && (
            <details className="text-ink-secondary border-ink/10 border-t pt-4 text-sm">
              <summary className="cursor-pointer">
                本页另有 {unavailable.length} 项弃用材料
              </summary>
              <p className="mt-2">这些旧材料不能用于新版发放。</p>
              <ul className="mt-2 space-y-1">
                {unavailable.map((entry) => (
                  <li key={entry.id}>{entry.name}</li>
                ))}
              </ul>
            </details>
          )}
        </>
      )}
      <div className="border-ink/10 flex items-center justify-between border-t pt-3">
        <InkButton
          disabled={loading || page <= 1}
          onClick={() => setPage((p) => p - 1)}
        >
          上一页
        </InkButton>
        <span className="font-mono text-sm">
          {page} / {totalPages}
        </span>
        <InkButton
          disabled={loading || page >= totalPages}
          onClick={() => setPage((p) => p + 1)}
        >
          下一页
        </InkButton>
      </div>
      <AdminDialog
        error={dialogError}
        open={panel === 'edit'}
        onClose={() => openPanel(null)}
        busy={saving}
        title={draft.rowId ? '编辑材料' : '新增材料'}
        footer={
          <>
            {draft.rowId && draft.status !== 'archived' && (
              <InkButton
                disabled={saving}
                className="mr-auto"
                onClick={() => void archive()}
              >
                归档材料
              </InkButton>
            )}
            <InkButton disabled={saving} onClick={() => openPanel(null)}>
              取消
            </InkButton>
            <InkButton
              variant="primary"
              pending={saving}
              onClick={() => void save()}
            >
              保存材料
            </InkButton>
          </>
        }
      >
        <fieldset disabled={saving} className="grid gap-4 sm:grid-cols-2">
          <InkInput
            label="材料 ID"
            value={draft.itemId}
            disabled={Boolean(draft.rowId)}
            onChange={(v) => setDraftField('itemId', v)}
          />
          <InkInput
            label="名称"
            value={draft.name}
            disabled={draft.materialType === 'seed'}
            onChange={(v) => setDraftField('name', v)}
          />
          <InkSelect
            label="种类"
            value={draft.materialType}
            disabled={draft.materialType === 'seed'}
            onChange={(v) =>
              setDraftField(
                'materialType',
                v as ItemLibraryDraft['materialType'],
              )
            }
          >
            {INVENTORY_MATERIAL_TYPES.map((v) => (
              <option key={v} value={v}>
                {MATERIAL_TYPE_NAMES[v]}
              </option>
            ))}
            {draft.materialType === 'seed' && (
              <option value="seed">灵种</option>
            )}
          </InkSelect>
          <InkSelect
            label="品阶"
            value={draft.materialRank}
            disabled={draft.materialType === 'seed'}
            onChange={(v) =>
              setDraftField(
                'materialRank',
                v as ItemLibraryDraft['materialRank'],
              )
            }
          >
            {QUALITY_VALUES.map((v) => (
              <option key={v}>{v}</option>
            ))}
          </InkSelect>
          <InkSelect
            label="五行"
            value={draft.materialElement}
            disabled={draft.materialType === 'seed'}
            onChange={(v) =>
              setDraftField(
                'materialElement',
                v as ItemLibraryDraft['materialElement'],
              )
            }
          >
            <option value="">无</option>
            {ELEMENT_VALUES.map((v) => (
              <option key={v}>{v}</option>
            ))}
          </InkSelect>
          <InkSelect
            label="发布状态"
            value={draft.status}
            onChange={(v) =>
              setDraftField('status', v as ItemLibraryDraft['status'])
            }
          >
            <option value="published">已发布</option>
            <option value="archived">已归档</option>
          </InkSelect>
          <InkInput
            label="描述"
            value={draft.description}
            disabled={draft.materialType === 'seed'}
            onChange={(v) => setDraftField('description', v)}
          />
        </fieldset>
      </AdminDialog>
      <AdminDialog
        error={dialogError}
        open={panel === 'generate'}
        onClose={() => openPanel(null)}
        busy={saving}
        title="批量生成"
        footer={
          <>
            <InkButton disabled={saving} onClick={() => openPanel(null)}>
              取消
            </InkButton>
            <InkButton
              variant="primary"
              pending={saving}
              onClick={() =>
                void (generationKind === 'material'
                  ? generateMaterials()
                  : generateSpiritSeeds())
              }
            >
              生成并发布
            </InkButton>
          </>
        }
      >
        <fieldset disabled={saving} className="space-y-5">
          <InkSelect
            label="生成内容"
            value={generationKind}
            onChange={setGenerationKind}
          >
            <option value="material">材料</option>
            <option value="seed">灵种</option>
          </InkSelect>
          {generationKind === 'material' ? (
            <div className="grid gap-3 sm:grid-cols-3">
              <InkInput
                label="生成数量"
                value={generateCount}
                onChange={setGenerateCount}
              />
              <InkSelect
                label="材料种类"
                value={generateType}
                onChange={(v) => setGenerateType(v as typeof generateType)}
              >
                {INVENTORY_MATERIAL_TYPES.map((v) => (
                  <option key={v} value={v}>
                    {MATERIAL_TYPE_NAMES[v]}
                  </option>
                ))}
              </InkSelect>
              <InkSelect
                label="生成品阶"
                value={generateQuality}
                onChange={(v) =>
                  setGenerateQuality(v as typeof generateQuality)
                }
              >
                {QUALITY_VALUES.map((v) => (
                  <option key={v}>{v}</option>
                ))}
              </InkSelect>
              <InkInput
                label="生成种子（可留空）"
                value={generateSeed}
                onChange={setGenerateSeed}
              />
            </div>
          ) : (
            <div className="grid gap-3 sm:grid-cols-3">
              <InkInput
                label="灵种数量"
                value={seedGenerateCount}
                onChange={setSeedGenerateCount}
              />
              <InkSelect
                label="灵种品阶"
                value={seedGenerateQuality}
                onChange={(v) =>
                  setSeedGenerateQuality(v as typeof seedGenerateQuality)
                }
              >
                {QUALITY_VALUES.map((v) => (
                  <option key={v}>{v}</option>
                ))}
              </InkSelect>
              <InkSelect
                label="灵种五行"
                value={seedGenerateElement}
                onChange={setSeedGenerateElement}
              >
                <option value="">随机</option>
                {ELEMENT_VALUES.map((v) => (
                  <option key={v}>{v}</option>
                ))}
              </InkSelect>
            </div>
          )}
        </fieldset>
      </AdminDialog>
      <AdminDialog
        error={dialogError}
        open={panel === 'daily'}
        onClose={() => openPanel(null)}
        busy={dailySettingsSaving}
        title="每日生成设置"
        footer={
          <>
            <InkButton
              disabled={dailySettingsSaving}
              onClick={() => openPanel(null)}
            >
              取消
            </InkButton>
            <InkButton
              variant="primary"
              disabled={dailySettingsLoading}
              pending={dailySettingsSaving}
              onClick={() => void saveDailySettings()}
            >
              保存设置
            </InkButton>
          </>
        }
      >
        <fieldset disabled={dailySettingsLoading || dailySettingsSaving}>
          <div className="flex flex-wrap items-center gap-3">
            <label>
              <input
                type="checkbox"
                checked={dailySettings.enabled}
                disabled={dailySettingsLoading}
                onChange={(e) =>
                  setDailySettings((s) => ({ ...s, enabled: e.target.checked }))
                }
              />{' '}
              每日生成材料
            </label>
            <InkInput
              label="每日数量"
              value={String(dailySettings.count)}
              onChange={(v) =>
                setDailySettings((s) => ({ ...s, count: Number(v) }))
              }
            />
          </div>
        </fieldset>
      </AdminDialog>
    </div>
  );
}
