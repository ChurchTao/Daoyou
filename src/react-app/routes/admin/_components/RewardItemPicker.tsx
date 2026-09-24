import {
  InventoryGrid,
  ItemSlot,
} from '@app/components/feature/items/ItemSlot';
import { InkButton, InkInput, InkNotice, InkSelect } from '@app/components/ui';
import { TALISMAN_SCENARIO_OPTIONS } from '@shared/config/talismanScenarios';
import {
  rewardDisplayItem,
  RewardItemSchema,
} from '@shared/contracts/adminRewards';
import { DAO_EQUIPMENT_TEMPLATES_V1 } from '@shared/engine/combat-v6/equipment/content';
import {
  equipmentRealm,
  OPEN_EQUIPMENT_LEVELS,
} from '@shared/engine/combat-v6/equipment/realm';
import { DAO_WEAPONS } from '@shared/engine/combat-v6/equipment/weapons';
import type { ItemGrant } from '@shared/inventory';
import {
  INVENTORY_MATERIAL_TYPES,
  MATERIAL_TYPE_NAMES,
} from '@shared/items/definitions/materials';
import { libraryMaterialGrant } from '@shared/items/libraryMaterialGrant';
import { ITEM_DEFINITIONS } from '@shared/items/registry';
import { ALCHEMY_PROPERTY_LABELS } from '@shared/lib/alchemyProperties';
import type { ItemLibraryEntry } from '@shared/lib/itemLibrary';
import { QUALITY_VALUES } from '@shared/types/constants';
import { useEffect, useState } from 'react';
import { AdminDialog } from './AdminDialog';

const kinds = {
  beast_book: '传承灵印',
  beast_refinement: '归元灵露',
  manual_jade: '功法玉简',
  blueprint: '图纸',
  inscription: '阵纹',
  material: '材料',
  seed: '灵种',
  pill: '丹药',
  spirit_fruit: '灵果',
  talisman: '符箓',
  equipment: '道装',
};
const families = {
  healing: '疗伤',
  mana: '回元',
  detox: '解毒',
  cultivation: '修为',
  beast_cultivation: '灵兽修为',
  insight: '感悟',
  breakthrough: '突破',
  tempering: '淬体',
  marrow_wash: '洗髓',
  longevity: '延寿',
  hybrid: '复合',
};
export function RewardItemPicker({
  onSelect,
  disabled = false,
  label = '选择道具',
}: {
  onSelect: (item: ItemGrant) => void;
  disabled?: boolean;
  label?: string;
}) {
  const [open, setOpen] = useState(false);
  const [kind, setKind] = useState<keyof typeof kinds>('beast_book');
  const [query, setQuery] = useState('');
  const [materialType, setMaterialType] = useState<string>('herb');
  const [page, setPage] = useState(1);
  const [pages, setPages] = useState(1);
  const [materials, setMaterials] = useState<ItemGrant[]>([]);
  const [generated, setGenerated] = useState<
    Array<{ kind: string; item: ItemGrant }>
  >([]);
  const [creating, setCreating] = useState(false);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState('');
  const [name, setName] = useState('');
  const [quality, setQuality] = useState<string>('凡品');
  const [effect, setEffect] = useState('restore_hp');
  const [secondary, setSecondary] = useState('');
  const [tertiary, setTertiary] = useState('');
  const [appearance, setAppearance] = useState('middle');
  const [family, setFamily] = useState('healing');
  const [scenario, setScenario] = useState<string>(
    TALISMAN_SCENARIO_OPTIONS[0].value,
  );
  const [templateId, setTemplateId] = useState<string>(
    DAO_EQUIPMENT_TEMPLATES_V1[0].id,
  );
  const [level, setLevel] = useState('10');
  const [baseQuality, setBaseQuality] = useState('0');
  const [weapon, setWeapon] = useState('sword');
  const isGenerator = [
    'pill',
    'spirit_fruit',
    'talisman',
    'equipment',
  ].includes(kind);
  const isLibrary = kind === 'material' || kind === 'seed';
  useEffect(() => {
    if (!open || !isLibrary) return;
    const controller = new AbortController();
    const timer = setTimeout(async () => {
      setPending(true);
      setError('');
      setMaterials([]);
      try {
        const params = new URLSearchParams({
          type: 'material',
          status: 'published',
          page: String(page),
          pageSize: '24',
          q: query,
          materialType: kind === 'seed' ? 'seed' : materialType,
        });
        const response = await fetch(`/api/admin/item-library?${params}`, {
          signal: controller.signal,
        });
        const data = await response.json();
        if (!response.ok) throw new Error(data.error ?? '加载失败');
        const grants: ItemGrant[] = [];
        for (const entry of data.items as ItemLibraryEntry[]) {
          try {
            const grant = libraryMaterialGrant(entry);
            if ((grant.definitionId === 'seed.v1') === (kind === 'seed'))
              grants.push(grant);
          } catch {
            /* Historical unsupported materials are not selectable. */
          }
        }
        if (!controller.signal.aborted) {
          setMaterials(grants);
          setPages(data.totalPages ?? 1);
        }
      } catch (e) {
        if (!controller.signal.aborted)
          setError(e instanceof Error ? e.message : '加载失败');
      } finally {
        if (!controller.signal.aborted) setPending(false);
      }
    }, 250);
    return () => {
      clearTimeout(timer);
      controller.abort();
    };
  }, [open, isLibrary, kind, query, page, materialType]);
  const catalogue: ItemGrant[] = isGenerator
    ? generated
        .filter((entry) => entry.kind === kind)
        .map((entry) => entry.item)
    : ITEM_DEFINITIONS.filter((d) => d.kind === kind).map((d) => ({
        definitionId: d.id,
        quantity: 1,
      }));
  const filtered = catalogue.filter((item) =>
    rewardDisplayItem(item).name.includes(query),
  );
  const totalPages = isLibrary
    ? pages
    : Math.max(1, Math.ceil(filtered.length / 24));
  const items = isLibrary
    ? materials
    : filtered.slice((page - 1) * 24, page * 24);
  function select(item: ItemGrant) {
    onSelect(RewardItemSchema.parse(item));
    setOpen(false);
  }
  async function generate() {
    setPending(true);
    setError('');

    try {
      const input =
        kind === 'equipment'
          ? {
              kind,
              templateId,
              equipmentLevel: Number(level),
              baseQuality: Number(baseQuality),
              ...(templateId.includes('.weapon.')
                ? { weaponType: weapon }
                : {}),
            }
          : kind === 'talisman'
            ? { kind, scenario }
            : kind === 'spirit_fruit'
              ? { kind, name, quality, family }
              : {
                  kind,
                  name,
                  quality,
                  effects: [effect, secondary, tertiary].filter(Boolean),
                  appearance,
                };
      const response = await fetch('/api/admin/reward-items/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(input),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error ?? '生成失败');
      const item = RewardItemSchema.parse(data.item);
      setGenerated((previous) => [{ kind, item }, ...previous]);
      setQuery('');
      setPage(1);
      setCreating(false);
    } catch (e) {
      setError(e instanceof Error ? e.message : '生成失败');
    } finally {
      setPending(false);
    }
  }
  return (
    <>
      <InkButton
        type="button"
        variant="secondary"
        disabled={disabled}
        onClick={() => setOpen(true)}
      >
        {label}
      </InkButton>
      <AdminDialog
        open={open}
        onClose={() => {
          setOpen(false);
          setCreating(false);
        }}
        title={creating ? `生成${kinds[kind]}` : '选择道具'}
        wide
        busy={pending}
        footer={
          creating ? (
            <>
              <InkButton disabled={pending} onClick={() => setCreating(false)}>
                返回道具列表
              </InkButton>
              <InkButton
                variant="primary"
                pending={pending}
                onClick={() => void generate()}
              >
                生成并预览
              </InkButton>
            </>
          ) : (
            <span className="text-ink-secondary mr-auto text-sm">
              点击物品格查看详情，在预览中选择。
            </span>
          )
        }
      >
        <div className="space-y-4">
          {!creating ? (
            <>
              <div
                className="flex flex-wrap gap-x-4 gap-y-2"
                role="group"
                aria-label="道具分类"
              >
                {Object.entries(kinds).map(([value, label]) => (
                  <button
                    key={value}
                    type="button"
                    aria-pressed={kind === value}
                    disabled={pending}
                    className={`border-b-2 py-1 text-sm ${kind === value ? 'border-crimson text-crimson font-semibold' : 'text-ink-secondary hover:text-ink border-transparent'}`}
                    onClick={() => {
                      setKind(value as keyof typeof kinds);
                      setPage(1);
                      setQuery('');
                      setMaterials([]);
                      setError('');
                    }}
                  >
                    {label}
                  </button>
                ))}
              </div>
              <div className="flex flex-wrap items-end justify-between gap-3">
                <InkInput
                  label="搜索道具"
                  value={query}
                  onChange={(v) => {
                    setQuery(v);
                    setPage(1);
                  }}
                />
                {kind === 'material' && (
                  <InkSelect
                    label="材料种类"
                    value={materialType}
                    onChange={(v) => {
                      setMaterialType(v);
                      setPage(1);
                    }}
                  >
                    {INVENTORY_MATERIAL_TYPES.map((v) => (
                      <option key={v} value={v}>
                        {MATERIAL_TYPE_NAMES[v]}
                      </option>
                    ))}
                  </InkSelect>
                )}
                {isGenerator && (
                  <InkButton
                    variant="primary"
                    onClick={() => {
                      setCreating(true);
                      setError('');
                    }}
                  >
                    生成{kinds[kind]}
                  </InkButton>
                )}
              </div>
              {pending ? (
                <InkNotice>加载中…</InkNotice>
              ) : (
                <InventoryGrid className="grid-cols-3 sm:grid-cols-6">
                  {items.map((item, index) => (
                    <ItemSlot
                      key={`${kind}-${page}-${index}`}
                      item={rewardDisplayItem(item)}
                      quantityLabel="奖励"
                    >
                      {(close) => (
                        <InkButton
                          variant="primary"
                          onClick={() => {
                            close();
                            select(item);
                          }}
                        >
                          选择此物
                        </InkButton>
                      )}
                    </ItemSlot>
                  ))}
                </InventoryGrid>
              )}
              {!pending && !items.length && (
                <div className="text-ink-secondary py-10 text-center text-sm">
                  {isGenerator &&
                  !generated.some((entry) => entry.kind === kind)
                    ? `尚未生成${kinds[kind]}，生成后将在这里预览与选择。`
                    : '没有匹配的道具'}
                </div>
              )}
              {totalPages > 1 && (
                <div className="border-ink/10 flex items-center justify-between border-t pt-3">
                  <InkButton
                    disabled={page <= 1 || pending}
                    onClick={() => setPage((p) => p - 1)}
                  >
                    上一页
                  </InkButton>
                  <span className="font-mono text-sm">
                    {page} / {totalPages}
                  </span>
                  <InkButton
                    disabled={page >= totalPages || pending}
                    onClick={() => setPage((p) => p + 1)}
                  >
                    下一页
                  </InkButton>
                </div>
              )}
            </>
          ) : (
            <>
              <fieldset
                disabled={pending}
                className="grid gap-3 sm:grid-cols-2"
              >
                {(kind === 'pill' || kind === 'spirit_fruit') && (
                  <>
                    <InkInput label="名称" value={name} onChange={setName} />
                    <InkSelect
                      label="品质"
                      value={quality}
                      onChange={setQuality}
                    >
                      {QUALITY_VALUES.map((q) => (
                        <option key={q}>{q}</option>
                      ))}
                    </InkSelect>
                  </>
                )}
                {kind === 'pill' && (
                  <>
                    {[
                      ['主药效', effect, setEffect],
                      ['辅药效', secondary, setSecondary],
                      ['第三药效', tertiary, setTertiary],
                    ].map(([label, value, setter], i) => (
                      <InkSelect
                        key={i}
                        label={label as string}
                        value={value as string}
                        onChange={setter as (v: string) => void}
                      >
                        {i > 0 && <option value="">无</option>}
                        {Object.entries(ALCHEMY_PROPERTY_LABELS).map(
                          ([v, l]) => (
                            <option key={v} value={v}>
                              {l}
                            </option>
                          ),
                        )}
                      </InkSelect>
                    ))}
                    <InkSelect
                      label="品相"
                      value={appearance}
                      onChange={setAppearance}
                    >
                      {Object.entries({
                        low: '下品',
                        middle: '中品',
                        high: '上品',
                        perfect: '极品',
                      }).map(([v, l]) => (
                        <option key={v} value={v}>
                          {l}
                        </option>
                      ))}
                    </InkSelect>
                  </>
                )}
                {kind === 'spirit_fruit' && (
                  <InkSelect label="果效" value={family} onChange={setFamily}>
                    {Object.entries(families).map(([v, l]) => (
                      <option key={v} value={v}>
                        {l}
                      </option>
                    ))}
                  </InkSelect>
                )}
                {kind === 'talisman' && (
                  <InkSelect
                    label="用途"
                    value={scenario}
                    onChange={setScenario}
                  >
                    {TALISMAN_SCENARIO_OPTIONS.map((o) => (
                      <option key={o.value} value={o.value}>
                        {o.label}
                      </option>
                    ))}
                  </InkSelect>
                )}
                {kind === 'equipment' && (
                  <>
                    <InkSelect
                      label="部位"
                      value={templateId}
                      onChange={setTemplateId}
                    >
                      {DAO_EQUIPMENT_TEMPLATES_V1.map((t) => (
                        <option key={t.id} value={t.id}>
                          {t.name}
                        </option>
                      ))}
                    </InkSelect>
                    <InkSelect label="境界" value={level} onChange={setLevel}>
                      {OPEN_EQUIPMENT_LEVELS.map((l) => (
                        <option key={l} value={l}>
                          {equipmentRealm(l).realm}
                        </option>
                      ))}
                    </InkSelect>
                    <InkInput
                      label="材料品阶进度（0～1）"
                      value={baseQuality}
                      onChange={setBaseQuality}
                    />
                    {templateId.includes('.weapon.') && (
                      <InkSelect
                        label="器形"
                        value={weapon}
                        onChange={setWeapon}
                      >
                        {Object.entries(DAO_WEAPONS).map(([v, d]) => (
                          <option key={v} value={v}>
                            {d.name}
                          </option>
                        ))}
                      </InkSelect>
                    )}
                  </>
                )}
              </fieldset>
            </>
          )}
          {error && <InkNotice tone="warning">{error}</InkNotice>}
        </div>
      </AdminDialog>
    </>
  );
}
