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

  const loadItems = useCallback(async () => {
    const params = new URLSearchParams();
    if (statusFilter) params.set('status', statusFilter);
    params.set('type', 'material');
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
  }, [page, query, statusFilter]);

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

  const buildSubmitBody = async () => {
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

  const generateSpiritSeeds = async () => {
    const count = Number(seedGenerateCount);
    if (!Number.isInteger(count) || count < 1 || count > 50) {
      pushToast({
        message: '灵种生成数量必须为 1 至 50 的整数',
        tone: 'warning',
      });
      return;
    }
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
    } catch (error) {
      pushToast({
        message: error instanceof Error ? error.message : '批量生成灵种失败',
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

  return (
    <div className="space-y-6">
      <h2 className="font-heading text-3xl">材料库</h2>
      <section className="space-y-4">
        <div className="flex flex-wrap gap-3">
          <InkInput
            label="搜索材料"
            value={query}
            onChange={(v) => {
              setQuery(v);
              setPage(1);
            }}
          />
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
          <InventoryGrid>
            {items.map((entry) => {
              let item;
              try {
                item = rewardDisplayItem(libraryMaterialGrant(entry));
              } catch {
                return (
                  <div key={entry.id} className="text-sm text-ink-secondary">
                    {entry.name} · 已弃用，不能用于新版发放
                  </div>
                );
              }
              return (
                <ItemSlot key={entry.id} item={item}>
                  {(close) => (
                    <InkButton
                      onClick={() => {
                        close();
                        setDraft(entryToDraft(entry));
                      }}
                    >
                      编辑材料
                    </InkButton>
                  )}
                </ItemSlot>
              );
            })}
          </InventoryGrid>
        )}
        <div className="flex items-center gap-4">
          <InkButton disabled={page <= 1} onClick={() => setPage((p) => p - 1)}>
            上一页
          </InkButton>
          <span className="font-mono">
            {page} / {totalPages}
          </span>
          <InkButton
            disabled={page >= totalPages}
            onClick={() => setPage((p) => p + 1)}
          >
            下一页
          </InkButton>
        </div>
      </section>
      <section className="border-ink/15 space-y-4 border-t pt-4">
        <h3>{draft.rowId ? '编辑材料' : '新增材料'}</h3>
        <div className="grid gap-3 sm:grid-cols-2">
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
        </div>
        <div className="flex flex-wrap gap-3">
          <InkButton disabled={saving} onClick={() => void save()}>
            保存材料
          </InkButton>
          <InkButton
            disabled={saving || !draft.rowId}
            onClick={() => void archive()}
          >
            归档
          </InkButton>
          <InkButton onClick={() => setDraft(createEmptyDraft())}>
            新增材料
          </InkButton>
        </div>
      </section>
      <details className="border-ink/15 space-y-4 border-t pt-4">
        <summary>批量生成与每日生成</summary>
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
            onChange={(v) => setGenerateQuality(v as typeof generateQuality)}
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
        <InkButton disabled={saving} onClick={() => void generateMaterials()}>
          生成材料
        </InkButton>
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
        <InkButton disabled={saving} onClick={() => void generateSpiritSeeds()}>
          生成灵种
        </InkButton>
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
          <InkButton
            disabled={dailySettingsLoading || dailySettingsSaving}
            onClick={() => void saveDailySettings()}
          >
            保存生成配置
          </InkButton>
        </div>
      </details>
    </div>
  );
}
