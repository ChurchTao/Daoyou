import {
  InventoryGrid,
  ItemSlot,
} from '@app/components/feature/items/ItemSlot';
import { InkModal } from '@app/components/layout';
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
import { libraryMaterialGrant } from '@shared/items/libraryMaterialGrant';
import { ITEM_DEFINITIONS } from '@shared/items/registry';
import { ALCHEMY_PROPERTY_LABELS } from '@shared/lib/alchemyProperties';
import type { ItemLibraryEntry } from '@shared/lib/itemLibrary';
import { QUALITY_VALUES } from '@shared/types/constants';
import { useEffect, useState } from 'react';

const kinds = {
  fixed: '固定道具',
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
const fixedKinds = {
  all: '全部',
  beast_book: '传承灵印',
  beast_refinement: '归元灵露',
  manual_jade: '功法玉简',
  blueprint: '图纸',
  inscription: '阵纹',
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
  const [kind, setKind] = useState<keyof typeof kinds>('fixed');
  const [fixedKind, setFixedKind] = useState('all');
  const [query, setQuery] = useState('');
  const [page, setPage] = useState(1);
  const [pages, setPages] = useState(1);
  const [materials, setMaterials] = useState<ItemGrant[]>([]);
  const [generated, setGenerated] = useState<ItemGrant>();
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
          pageSize: '40',
          q: query,
          ...(kind === 'seed' ? { materialType: 'seed' } : {}),
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
  }, [open, isLibrary, kind, query, page]);
  const fixed = ITEM_DEFINITIONS.filter(
    (d) =>
      !['equipment', 'material', 'seed', 'consumable'].includes(d.kind) &&
      (fixedKind === 'all' || d.kind === fixedKind) &&
      d.name.includes(query),
  );
  const totalPages =
    kind === 'fixed' ? Math.max(1, Math.ceil(fixed.length / 40)) : pages;
  const items: ItemGrant[] =
    kind === 'fixed'
      ? fixed
          .slice((page - 1) * 40, page * 40)
          .map((d) => ({ definitionId: d.id, quantity: 1 }))
      : materials;
  function select(item: ItemGrant) {
    onSelect(RewardItemSchema.parse(item));
    setOpen(false);
  }
  async function generate() {
    setPending(true);
    setError('');
    setGenerated(undefined);
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
      setGenerated(RewardItemSchema.parse(data.item));
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
      <InkModal
        isOpen={open}
        onClose={() => setOpen(false)}
        title="选择奖励道具"
        className="max-w-4xl"
      >
        <div className="space-y-4">
          <InkSelect
            label="道具来源"
            value={kind}
            onChange={(v) => {
              setKind(v as keyof typeof kinds);
              setPage(1);
              setGenerated(undefined);
              setError('');
            }}
          >
            {Object.entries(kinds).map(([v, l]) => (
              <option key={v} value={v}>
                {l}
              </option>
            ))}
          </InkSelect>
          {kind === 'fixed' || isLibrary ? (
            <>
              <div className="flex flex-wrap gap-3">
                <InkInput
                  label="搜索名称"
                  value={query}
                  onChange={(v) => {
                    setQuery(v);
                    setPage(1);
                  }}
                />
                {kind === 'fixed' && (
                  <InkSelect
                    label="分类"
                    value={fixedKind}
                    onChange={(v) => {
                      setFixedKind(v);
                      setPage(1);
                    }}
                  >
                    {Object.entries(fixedKinds).map(([v, l]) => (
                      <option key={v} value={v}>
                        {l}
                      </option>
                    ))}
                  </InkSelect>
                )}
              </div>
              {pending ? (
                <InkNotice>加载中…</InkNotice>
              ) : (
                <InventoryGrid>
                  {items.map((item, i) => (
                    <ItemSlot
                      key={`${item.definitionId}-${i}`}
                      item={rewardDisplayItem(item)}
                      quantityLabel="奖励"
                      >
                      {(close) => (
                        <InkButton
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
              {!pending && items.length === 0 && (
                <InkNotice>没有匹配的道具</InkNotice>
              )}
              <div className="flex items-center justify-between">
                <InkButton
                  disabled={page <= 1 || pending}
                  onClick={() => setPage((p) => p - 1)}
                >
                  上一页
                </InkButton>
                <span className="font-mono">
                  {page} / {totalPages}
                </span>
                <InkButton
                  disabled={page >= totalPages || pending}
                  onClick={() => setPage((p) => p + 1)}
                >
                  下一页
                </InkButton>
              </div>
            </>
          ) : (
            <>
              <div
                className="grid gap-3 sm:grid-cols-2"
                onChangeCapture={() => setGenerated(undefined)}
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
              </div>
              <InkButton disabled={pending} onClick={() => void generate()}>
                {pending ? '生成中…' : generated ? '重新生成' : '生成预览'}
              </InkButton>
              {generated && (
                <div className="flex items-center gap-4">
                  <div className="w-24">
                    <ItemSlot
                      item={rewardDisplayItem(generated)}
                      quantityLabel="奖励"
                    />
                  </div>
                  <InkButton onClick={() => select(generated)}>
                    使用此道具
                  </InkButton>
                </div>
              )}
            </>
          )}
          {error && <InkNotice tone="warning">{error}</InkNotice>}
        </div>
      </InkModal>
    </>
  );
}
