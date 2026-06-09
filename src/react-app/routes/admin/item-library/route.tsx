import { useInkUI } from '@app/components/providers/InkUIProvider';
import { InkButton } from '@app/components/ui/InkButton';
import { InkInput } from '@app/components/ui/InkInput';
import { InkNotice } from '@app/components/ui/InkNotice';
import { InkSelect } from '@app/components/ui/InkSelect';
import { DEFAULT_AFFIX_REGISTRY } from '@shared/engine/creation-v2/affixes';
import {
  CONSUMABLE_TYPE_VALUES,
  ELEMENT_VALUES,
  EQUIPMENT_SLOT_VALUES,
  MATERIAL_TYPE_VALUES,
  QUALITY_VALUES,
  REALM_STAGE_VALUES,
  REALM_VALUES,
} from '@shared/types/constants';
import type {
  CreateItemLibraryEntry,
  ItemLibraryEntry,
  UpdateItemLibraryEntry,
} from '@shared/lib/itemLibrary';
import { useCallback, useEffect, useMemo, useState } from 'react';

interface ItemLibraryResponse {
  items?: ItemLibraryEntry[];
  item?: ItemLibraryEntry;
  payload?: Extract<ItemLibraryEntry, { type: 'artifact' }>['payload'];
  error?: string;
}

interface ItemLibraryDraft {
  rowId: string;
  itemId: string;
  type: ItemLibraryEntry['type'];
  status: ItemLibraryEntry['status'];
  name: string;
  description: string;
  materialType: string;
  materialRank: string;
  materialElement: string;
  consumablePayloadText: string;
  artifactSlot: string;
  artifactElement: string;
  artifactRealm: string;
  artifactRealmStage: string;
  artifactAffixIds: string[];
  artifactPayload:
    | Extract<ItemLibraryEntry, { type: 'artifact' }>['payload']
    | null;
}

type ConsumableEntryPayload = Extract<
  CreateItemLibraryEntry,
  { type: 'consumable' }
>['payload'];

const artifactAffixOptions = DEFAULT_AFFIX_REGISTRY.getAll()
  .filter((affix) => affix.applicableTo.includes('artifact'))
  .map((affix) => ({
    id: affix.id,
    name: affix.displayName,
    description: affix.displayDescription,
    category: affix.category,
    rarity: affix.rarity,
  }));

function defaultConsumablePayload() {
  return {
    name: '清心丹',
    type: '丹药',
    quality: '凡品',
    description: '一枚可用于测试发放的丹药。',
    prompt: '',
    score: 80,
    spec: {
      kind: 'pill',
      family: 'healing',
      operations: [
        {
          type: 'restore_resource',
          resource: 'hp',
          mode: 'flat',
          value: 100,
        },
      ],
      consumeRules: {
        scene: 'out_of_battle_only',
        quotaCategory: 'none',
      },
      alchemyMeta: {
        source: 'improvised',
        sourceMaterials: [],
        stability: 80,
        toxicityRating: 5,
        tags: [],
      },
    },
  };
}

function createEmptyDraft(): ItemLibraryDraft {
  return {
    rowId: '',
    itemId: '',
    type: 'material',
    status: 'published',
    name: '',
    description: '',
    materialType: MATERIAL_TYPE_VALUES[0],
    materialRank: QUALITY_VALUES[0],
    materialElement: '',
    consumablePayloadText: JSON.stringify(defaultConsumablePayload(), null, 2),
    artifactSlot: EQUIPMENT_SLOT_VALUES[0],
    artifactElement: ELEMENT_VALUES[0],
    artifactRealm: '',
    artifactRealmStage: '',
    artifactAffixIds: [],
    artifactPayload: null,
  };
}

function entryToDraft(entry: ItemLibraryEntry): ItemLibraryDraft {
  const draft = createEmptyDraft();
  draft.rowId = entry.id;
  draft.itemId = entry.itemId;
  draft.type = entry.type;
  draft.status = entry.status;
  draft.name = entry.name;
  draft.description = entry.description ?? '';

  if (entry.type === 'material') {
    draft.materialType = entry.payload.type;
    draft.materialRank = entry.payload.rank;
    draft.materialElement = entry.payload.element ?? '';
  }

  if (entry.type === 'consumable') {
    draft.consumablePayloadText = JSON.stringify(entry.payload, null, 2);
  }

  if (entry.type === 'artifact') {
    draft.artifactSlot = entry.editorConfig.slot;
    draft.artifactElement = entry.editorConfig.element;
    draft.artifactRealm = entry.editorConfig.realm ?? '';
    draft.artifactRealmStage = entry.editorConfig.realmStage ?? '';
    draft.artifactAffixIds = entry.editorConfig.affixIds;
    draft.artifactPayload = entry.payload;
  }

  return draft;
}

function getTypeLabel(type: ItemLibraryEntry['type']) {
  switch (type) {
    case 'material':
      return '材料';
    case 'consumable':
      return '消耗品';
    case 'artifact':
      return '法宝';
  }
}

function getEntryMeta(entry: ItemLibraryEntry) {
  const parts = [getTypeLabel(entry.type)];
  if (entry.quality) parts.push(entry.quality);
  if (entry.element) parts.push(entry.element);
  if (entry.category) parts.push(entry.category);
  return parts.join(' / ');
}

export default function ItemLibraryAdminPage() {
  const { pushToast } = useInkUI();
  const [items, setItems] = useState<ItemLibraryEntry[]>([]);
  const [draft, setDraft] = useState<ItemLibraryDraft>(() => createEmptyDraft());
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [statusFilter, setStatusFilter] = useState('published');
  const [typeFilter, setTypeFilter] = useState('');
  const [query, setQuery] = useState('');

  const selectedAffixSet = useMemo(
    () => new Set(draft.artifactAffixIds),
    [draft.artifactAffixIds],
  );

  const loadItems = useCallback(async () => {
    const params = new URLSearchParams();
    if (statusFilter) params.set('status', statusFilter);
    if (typeFilter) params.set('type', typeFilter);
    if (query.trim()) params.set('q', query.trim());

    const response = await fetch(`/api/admin/item-library?${params.toString()}`);
    const data = (await response.json()) as ItemLibraryResponse;
    if (!response.ok) {
      throw new Error(data.error ?? '加载道具库失败');
    }
    setItems(data.items ?? []);
  }, [query, statusFilter, typeFilter]);

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

  const buildSubmitBody = async ():
    Promise<CreateItemLibraryEntry | UpdateItemLibraryEntry> => {
    const name = draft.name.trim();
    if (!name) throw new Error('请填写名称');

    if (draft.type === 'material') {
      return {
        itemId: draft.itemId.trim(),
        type: 'material',
        status: draft.status,
        payload: {
          name,
          type: draft.materialType as (typeof MATERIAL_TYPE_VALUES)[number],
          rank: draft.materialRank as (typeof QUALITY_VALUES)[number],
          ...(draft.materialElement
            ? { element: draft.materialElement as (typeof ELEMENT_VALUES)[number] }
            : {}),
          ...(draft.description.trim()
            ? { description: draft.description.trim() }
            : {}),
        },
        editorConfig: {},
      };
    }

    if (draft.type === 'consumable') {
      let payload: unknown;
      try {
        payload = JSON.parse(draft.consumablePayloadText);
      } catch {
        throw new Error('消耗品 payload JSON 格式错误');
      }

      return {
        itemId: draft.itemId.trim(),
        type: 'consumable',
        status: draft.status,
        payload: {
          ...(payload as Record<string, unknown>),
          name,
          ...(draft.description.trim()
            ? { description: draft.description.trim() }
            : {}),
        } as ConsumableEntryPayload,
        editorConfig: {},
      };
    }

    const payload = draft.artifactPayload ?? (await previewArtifact());
    if (!payload) {
      throw new Error('法宝预览生成失败');
    }

    return {
      itemId: draft.itemId.trim(),
      type: 'artifact',
      status: draft.status,
      payload,
      editorConfig: {
        slot: draft.artifactSlot as (typeof EQUIPMENT_SLOT_VALUES)[number],
        element: draft.artifactElement as (typeof ELEMENT_VALUES)[number],
        ...(draft.artifactRealm
          ? { realm: draft.artifactRealm as (typeof REALM_VALUES)[number] }
          : {}),
        ...(draft.artifactRealmStage
          ? {
              realmStage:
                draft.artifactRealmStage as (typeof REALM_STAGE_VALUES)[number],
            }
          : {}),
        affixIds: draft.artifactAffixIds,
      },
    };
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
              onChange={setQuery}
              placeholder="名称或 itemId"
            />
            <div className="grid grid-cols-2 gap-3">
              <InkSelect
                label="状态"
                value={statusFilter}
                onChange={setStatusFilter}
              >
                <option value="">全部</option>
                <option value="published">published</option>
                <option value="archived">archived</option>
              </InkSelect>
              <InkSelect
                label="类型"
                value={typeFilter}
                onChange={setTypeFilter}
              >
                <option value="">全部</option>
                <option value="material">材料</option>
                <option value="consumable">消耗品</option>
                <option value="artifact">法宝</option>
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
                  {item.itemId} · {item.status} · {getEntryMeta(item)}
                </span>
              </button>
            ))}
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
                setDraft((current) => ({
                  ...createEmptyDraft(),
                  rowId: current.rowId,
                  itemId: current.itemId,
                  name: current.name,
                  description: current.description,
                  status: current.status,
                  type: value as ItemLibraryEntry['type'],
                }))
              }
              disabled={Boolean(draft.rowId)}
            >
              <option value="material">材料</option>
              <option value="consumable">消耗品</option>
              <option value="artifact">法宝</option>
            </InkSelect>
            <InkSelect
              label="状态"
              value={draft.status}
              onChange={(value) =>
                setDraftField('status', value as ItemLibraryEntry['status'])
              }
            >
              <option value="published">published</option>
              <option value="archived">archived</option>
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
                onChange={(value) => setDraftField('materialType', value)}
              >
                {MATERIAL_TYPE_VALUES.map((value) => (
                  <option key={value} value={value}>
                    {value}
                  </option>
                ))}
              </InkSelect>
              <InkSelect
                label="品阶"
                value={draft.materialRank}
                onChange={(value) => setDraftField('materialRank', value)}
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
                onChange={(value) => setDraftField('materialElement', value)}
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
            <InkInput
              label="消耗品 payload JSON"
              value={draft.consumablePayloadText}
              onChange={(value) => setDraftField('consumablePayloadText', value)}
              hint={`type 可用：${CONSUMABLE_TYPE_VALUES.join('、')}；spec.kind 支持 pill / talisman。`}
              multiline
              rows={18}
            />
          ) : null}

          {draft.type === 'artifact' ? (
            <div className="space-y-4">
              <div className="grid gap-3 md:grid-cols-4">
                <InkSelect
                  label="槽位"
                  value={draft.artifactSlot}
                  onChange={(value) => {
                    setDraftField('artifactSlot', value);
                    setDraftField('artifactPayload', null);
                  }}
                >
                  {EQUIPMENT_SLOT_VALUES.map((value) => (
                    <option key={value} value={value}>
                      {value}
                    </option>
                  ))}
                </InkSelect>
                <InkSelect
                  label="元素"
                  value={draft.artifactElement}
                  onChange={(value) => {
                    setDraftField('artifactElement', value);
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
                  label="境界锚点"
                  value={draft.artifactRealm}
                  onChange={(value) => {
                    setDraftField('artifactRealm', value);
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
                    setDraftField('artifactRealmStage', value);
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

              <div className="border-ink/12 bg-paper/70 max-h-[420px] space-y-2 overflow-auto border border-dashed p-4">
                {artifactAffixOptions.map((affix) => (
                  <label
                    key={affix.id}
                    className="border-ink/12 flex gap-3 border-b border-dashed pb-2 text-sm"
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
                        {affix.id} / {affix.category} / {affix.rarity}
                      </span>
                      <span className="text-ink-secondary mt-1 block">
                        {affix.description}
                      </span>
                    </span>
                  </label>
                ))}
              </div>

              <div className="flex flex-wrap items-center gap-3">
                <InkButton
                  type="button"
                  variant="secondary"
                  onClick={() =>
                    void previewArtifact()
                      .then(() =>
                        pushToast({ message: '法宝预览已生成', tone: 'success' }),
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
