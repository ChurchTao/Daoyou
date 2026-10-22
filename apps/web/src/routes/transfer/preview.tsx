import { GameIcon } from '@app/components/ui/GameIcon';
import { InkBadge } from '@app/components/ui/InkBadge';
import { tierColorMap, type Tier } from '@app/components/ui/inkBadgeTiers';
import { ELEMENT_VALUES, type ElementType } from '@daoyou/constants/elements';
import { REALM_VALUES, type RealmType } from '@daoyou/constants/realms';
import { BEAST_SPECIES } from '@daoyou/game-content/beasts';
import { findItemDefinition } from '@daoyou/game-content/items';
import { CHARACTER_MANUALS_V1 } from '@daoyou/game-content/manuals';
import { getElementInfo } from '@daoyou/game-content/presentation/concepts';
import { COMBAT_V6_SECT_DEFINITIONS } from '@daoyou/game-content/sects';
import { CHARACTER_ATTRIBUTE_LABELS } from '@daoyou/game-domain/character';
import type { CultivatorCondition } from '@daoyou/game-domain/condition';
import {
  DAO_EQUIPMENT_SLOTS,
  EQUIPMENT_SLOT_NAMES,
} from '@daoyou/game-domain/equipment';
import { MANUAL_REALMS } from '@daoyou/game-domain/manuals/authoring';
import { getLevelRealmStage } from '@daoyou/game-domain/progression';
import { getBodyCultivationSummary } from '@daoyou/game-rules/body-cultivation/progress';
import type { ReactNode } from 'react';

export type Preview = {
  name: string;
  realm: string;
  realmStage: string;
  age?: number;
  lifespan?: number;
  attributes?: Record<string, number>;
  unallocatedAttributePoints?: number;
  cultivationProgress?: Record<string, unknown>;
  condition?: Record<string, unknown>;
  roots?: {
    element: string;
    strength: number;
    marrowWashBonus: number;
    grade: string | null;
  }[];
  fates?: { name: string; quality: string | null; description: string | null }[];
  spiritStones: number;
  sectId: string | null;
  sect?: {
    methods: Record<string, number>;
    activePathId: string;
    meridianDepth: number;
  } | null;
  manualCount: number;
  manuals: { id: string; level: number; unlockedLevel?: number }[];
  manualSlots?: { slot: number; manualId: string }[];
  equippedCount: number;
  items: {
    location?: string;
    slot: number | null;
    equipmentSlot?: string | null;
    definitionId: string;
    quantity: number;
    name: string | null;
    equipmentLevel: number | null;
    baseQuality: number | null;
  }[];
  beastCount: number;
  beasts: { name: string; speciesId: string; level: number; growth: number }[];
  storyReceiptCount?: number;
};

const attributeOrder = Object.keys(
  CHARACTER_ATTRIBUTE_LABELS,
) as (keyof typeof CHARACTER_ATTRIBUTE_LABELS)[];
const manualsById = new Map(
  CHARACTER_MANUALS_V1.map((manual) => [manual.id, manual]),
);
const speciesNames = new Map(
  BEAST_SPECIES.map((species) => [species.id as string, species.name]),
);
const equipmentOrder = new Map(
  DAO_EQUIPMENT_SLOTS.map((slot, index) => [slot, index]),
);

function amount(value: unknown) {
  return typeof value === 'number' && Number.isFinite(value)
    ? value.toLocaleString()
    : '—';
}

function knownTier(value: string | null | undefined): Tier | undefined {
  return value && value in tierColorMap ? (value as Tier) : undefined;
}

function elementIcon(element: string) {
  return (ELEMENT_VALUES as readonly string[]).includes(element)
    ? getElementInfo(element as ElementType).icon
    : '';
}

function sectDefinition(sectId: string | null | undefined) {
  if (!sectId || !(sectId in COMBAT_V6_SECT_DEFINITIONS)) return undefined;
  return COMBAT_V6_SECT_DEFINITIONS[
    sectId as keyof typeof COMBAT_V6_SECT_DEFINITIONS
  ];
}

function equipmentSlotName(slot: string | null | undefined) {
  if (!slot || !(slot in EQUIPMENT_SLOT_NAMES)) return null;
  return EQUIPMENT_SLOT_NAMES[slot as keyof typeof EQUIPMENT_SLOT_NAMES];
}

function itemTitle(item: Preview['items'][number]) {
  return item.name ?? findItemDefinition(item.definitionId)?.name ?? '未记载物品';
}

function bodySummary(preview: Preview) {
  const tracks = preview.condition?.tracks;
  if (!tracks || typeof tracks !== 'object' || !('bodyCultivation' in tracks))
    return null;
  const realm = (REALM_VALUES as readonly string[]).includes(preview.realm)
    ? (preview.realm as RealmType)
    : undefined;
  return getBodyCultivationSummary(
    preview.condition as unknown as CultivatorCondition,
    { cultivatorRealm: realm },
  );
}

function PreviewSection({
  title,
  children,
}: {
  title: string;
  children: ReactNode;
}) {
  return (
    <section className="border-ink/10 space-y-3 border-t pt-4">
      <h3 className="text-base font-semibold">{title}</h3>
      {children}
    </section>
  );
}

function Fact({ label, value }: { label: string; value: ReactNode }) {
  return (
    <div className="bg-ink/3 rounded-sm px-3 py-3">
      <p className="text-ink-secondary text-xs">{label}</p>
      <p className="mt-1 font-mono text-base font-semibold tracking-tight break-words sm:text-lg">
        {value}
      </p>
    </div>
  );
}

export function PreviewCard({
  preview,
  detailed = false,
}: {
  preview: Preview;
  detailed?: boolean;
}) {
  const body = detailed ? bodySummary(preview) : null;
  const sect = sectDefinition(preview.sectId);
  const path = sect?.paths.find(
    (entry) => entry.id === preview.sect?.activePathId,
  );
  const methods = sect
    ? sect.methods.flatMap((method) => {
        const level = preview.sect?.methods[method.id];
        return level === undefined
          ? []
          : [
              {
                id: method.id,
                name: method.name.replace(/[《》]/g, ''),
                level,
                primary: method.isPrimary,
              },
            ];
      })
    : [];
  const equippedManuals = new Set(
    preview.manualSlots?.map((slot) => slot.manualId),
  );
  const manuals = preview.manuals ?? [];
  const knownRealms = new Set<string>(MANUAL_REALMS);
  const items = [...(preview.items ?? [])].sort((left, right) => {
    const leftWorn = left.location === 'equipped' || left.equipmentSlot ? 0 : 1;
    const rightWorn =
      right.location === 'equipped' || right.equipmentSlot ? 0 : 1;
    if (leftWorn !== rightWorn) return leftWorn - rightWorn;
    if (leftWorn === 0) {
      return (
        (equipmentOrder.get(
          left.equipmentSlot as (typeof DAO_EQUIPMENT_SLOTS)[number],
        ) ?? 9) -
        (equipmentOrder.get(
          right.equipmentSlot as (typeof DAO_EQUIPMENT_SLOTS)[number],
        ) ?? 9)
      );
    }
    return (left.slot ?? 0) - (right.slot ?? 0);
  });
  const worn = items.filter(
    (item) => item.location === 'equipped' || item.equipmentSlot,
  );
  const packed = items.filter(
    (item) => item.location !== 'equipped' && !item.equipmentSlot,
  );

  return (
    <div className="space-y-4 text-sm leading-6">
      <div className="border-ink/15 bg-paper border p-4">
        <p className="text-crimson mb-1 text-xs tracking-widest">
          抵达目标界后的预计状态
        </p>
        <p className="text-xl font-semibold">
          {preview.name}
          <span className="text-ink-secondary ml-2 text-base font-normal">
            {preview.realm} · {preview.realmStage}
          </span>
        </p>
        <div className="mt-3 grid grid-cols-2 gap-2 sm:grid-cols-4">
          <Fact label="灵石" value={preview.spiritStones.toLocaleString()} />
          <Fact label="功法" value={preview.manualCount} />
          <Fact label="穿戴" value={preview.equippedCount} />
          <Fact label="灵兽" value={preview.beastCount} />
        </div>
      </div>
      {detailed && (
        <>
          <PreviewSection title="人物">
            <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
              <Fact
                label="寿元"
                value={
                  <>
                    {amount(preview.age)}
                    <span className="text-ink-secondary mx-1 font-sans text-sm font-normal">
                      /
                    </span>
                    {amount(preview.lifespan)}
                    <span className="text-ink-secondary ml-1 font-sans text-xs font-normal">
                      年
                    </span>
                  </>
                }
              />
              <Fact
                label="未分配属性点"
                value={amount(preview.unallocatedAttributePoints)}
              />
              <Fact
                label="修为"
                value={amount(preview.cultivationProgress?.cultivation_exp)}
              />
              <Fact
                label="感悟"
                value={amount(
                  preview.cultivationProgress?.comprehension_insight,
                )}
              />
            </div>
            <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
              {attributeOrder.map((key) => (
                <Fact
                  key={key}
                  label={CHARACTER_ATTRIBUTE_LABELS[key]}
                  value={amount(preview.attributes?.[key])}
                />
              ))}
            </div>
          </PreviewSection>
          <PreviewSection title="灵根">
            {preview.roots?.length ? (
              <dl className="grid gap-2 sm:grid-cols-2">
                {preview.roots.map((root, index) => {
                  const bonus = root.marrowWashBonus ?? 0;
                  const grade = knownTier(root.grade);
                  return (
                    <div
                      key={`${root.element}-${index}`}
                      className="bg-ink/3 flex items-center gap-3 rounded-sm px-3 py-3"
                    >
                      <GameIcon
                        value={elementIcon(root.element)}
                        className="size-8 text-3xl"
                      />
                      <dt className="min-w-0 flex-1">
                        <span className="font-semibold">{root.element}灵根</span>
                        {grade ? (
                          <InkBadge
                            tier={grade}
                            className="px-0 whitespace-nowrap"
                          />
                        ) : null}
                        {bonus > 0 ? (
                          <span className="text-ink-secondary mt-1 block text-xs">
                            含后天增益{' '}
                            <span className="font-mono">+{bonus}</span>
                          </span>
                        ) : null}
                      </dt>
                      <dd className="shrink-0 text-right">
                        <span className="block font-mono text-2xl font-semibold tracking-tight">
                          {root.strength}
                        </span>
                        <span className="text-ink-secondary text-xs">强度</span>
                      </dd>
                    </div>
                  );
                })}
              </dl>
            ) : (
              <p className="text-ink-secondary">暂无灵根记录。</p>
            )}
          </PreviewSection>
          <PreviewSection title="先天命格">
            {preview.fates?.length ? (
              <ul className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
                {preview.fates.map((fate, index) => {
                  const quality = knownTier(fate.quality);
                  return (
                    <li
                      key={`${fate.name}-${index}`}
                      className="bg-ink/3 rounded-sm px-3 py-3"
                    >
                      <div className="flex flex-wrap items-baseline gap-x-1">
                        <span
                          className={`font-semibold ${quality ? tierColorMap[quality] : ''}`}
                        >
                          {fate.name}
                        </span>
                        {quality ? (
                          <InkBadge
                            tier={quality}
                            className="px-0 whitespace-nowrap"
                          />
                        ) : null}
                      </div>
                      {fate.description ? (
                        <p className="text-ink-secondary mt-1 line-clamp-3 text-xs leading-5">
                          {fate.description}
                        </p>
                      ) : null}
                    </li>
                  );
                })}
              </ul>
            ) : (
              <p className="text-ink-secondary">暂无先天命格记录。</p>
            )}
          </PreviewSection>
          <PreviewSection title="肉身修炼">
            {body ? (
              <>
                <div className="bg-ink/3 flex items-center justify-between gap-4 rounded-sm px-3 py-3">
                  <div>
                    <p className="text-lg font-semibold">{body.realm.label}</p>
                    <p className="text-ink-secondary text-xs">
                      单轨上限{' '}
                      <span className="font-mono">
                        Lv.{body.trackLevelCap}
                      </span>
                    </p>
                  </div>
                  <div className="text-right">
                    <p className="font-mono text-2xl font-semibold tracking-tight">
                      Lv.{body.totalLevel}
                    </p>
                    <p className="text-ink-secondary text-xs">五轨总等级</p>
                  </div>
                </div>
                <div className="grid gap-2 lg:grid-cols-2">
                  {body.tracks.map((track) => (
                    <article
                      key={track.key}
                      className="bg-ink/3 rounded-sm px-3 py-3"
                    >
                      <div className="flex items-baseline justify-between gap-3">
                        <h4 className="font-semibold">{track.name}</h4>
                        <span className="font-mono text-lg font-semibold tracking-tight">
                          Lv.{track.level}
                        </span>
                      </div>
                      <p className="text-ink-secondary mt-1 text-xs">
                        {track.shortDesc}
                      </p>
                      <div
                        className="bg-ink/10 mt-3 h-1.5 overflow-hidden rounded-full"
                        aria-hidden="true"
                      >
                        <div
                          className="bg-crimson/70 h-full rounded-full"
                          style={{
                            width: `${Math.max(0, Math.min(100, track.threshold > 0 ? (track.progress / track.threshold) * 100 : 0))}%`,
                          }}
                        />
                      </div>
                      <p className="text-ink-secondary mt-2 text-xs">
                        进度{' '}
                        <span className="font-mono">
                          {track.progress} / {track.threshold}
                        </span>
                      </p>
                    </article>
                  ))}
                </div>
              </>
            ) : (
              <p className="text-ink-secondary">尚未开始炼体。</p>
            )}
          </PreviewSection>
          <PreviewSection title="宗门心法">
            {preview.sect && sect ? (
              <>
                <p>
                  {sect.name}
                  {path ? ` · ${path.name}` : ''}
                  <span className="text-ink-secondary">
                    {' '}
                    · 经脉第 {preview.sect.meridianDepth} 层
                  </span>
                </p>
                <p className="text-crimson">
                  虚空已损伤自身修为，下列宗门心法每门降低 10
                  级，最低保留 1 级。贡献与职位不携带。
                </p>
                <ul className="grid gap-2 sm:grid-cols-2">
                  {methods.map((method) => (
                    <li
                      key={method.id}
                      className="bg-ink/3 rounded-sm px-3 py-3"
                    >
                      <div className="flex items-baseline justify-between gap-3">
                        <span className="font-semibold">{method.name}</span>
                        <span className="font-mono font-semibold tracking-tight">
                          {method.level}级
                        </span>
                      </div>
                      {method.primary ? (
                        <p className="text-ink-secondary mt-1 text-xs">主心法</p>
                      ) : null}
                    </li>
                  ))}
                </ul>
              </>
            ) : (
              <p className="text-ink-secondary">散修，不携带宗门心法。</p>
            )}
          </PreviewSection>
          <PreviewSection title="所修功法">
            {manuals.length ? (
              <div className="space-y-3">
                {MANUAL_REALMS.map((realm) => {
                  const learned = manuals.filter(
                    (manual) => manualsById.get(manual.id)?.realm === realm,
                  );
                  if (!learned.length) return null;
                  return (
                    <div key={realm}>
                      <p className="text-ink-secondary mb-2 text-xs">{realm}</p>
                      <ul className="grid gap-2 sm:grid-cols-2">
                        {learned.map((manual) => (
                          <ManualLine
                            key={manual.id}
                            manual={manual}
                            equipped={equippedManuals.has(manual.id)}
                          />
                        ))}
                      </ul>
                    </div>
                  );
                })}
                {manuals.some(
                  (manual) => !knownRealms.has(manualsById.get(manual.id)?.realm ?? ''),
                ) ? (
                  <ul className="grid gap-2 sm:grid-cols-2">
                    {manuals
                      .filter(
                        (manual) =>
                          !knownRealms.has(manualsById.get(manual.id)?.realm ?? ''),
                      )
                      .map((manual) => (
                        <ManualLine
                          key={manual.id}
                          manual={manual}
                          equipped={equippedManuals.has(manual.id)}
                        />
                      ))}
                  </ul>
                ) : null}
              </div>
            ) : (
              <p className="text-ink-secondary">无已学功法。</p>
            )}
          </PreviewSection>
          <PreviewSection title={`可携带物品 · ${items.length} 格`}>
            {items.length ? (
              <div className="space-y-3">
                <ItemGroup title="所御道装" items={worn} />
                <ItemGroup title="背包" items={packed} />
              </div>
            ) : (
              <p className="text-ink-secondary">无可携带物品。</p>
            )}
          </PreviewSection>
          <PreviewSection title={`随行灵兽 · ${preview.beasts.length} / 3 只`}>
            {preview.beasts.length ? (
              <ul className="grid gap-2 sm:grid-cols-2">
                {preview.beasts.map((beast, index) => {
                  const species = speciesNames.get(beast.speciesId) ?? '灵兽';
                  return (
                    <li
                      key={`${beast.speciesId}-${index}`}
                      className="bg-ink/3 rounded-sm px-3 py-3"
                    >
                      <div className="flex items-baseline justify-between gap-3">
                        <span className="font-semibold">
                          {beast.name || species}
                        </span>
                        <span className="font-mono font-semibold tracking-tight">
                          {beast.level} 级
                        </span>
                      </div>
                      <p className="text-ink-secondary mt-1 text-xs">
                        {beast.name && beast.name !== species ? `${species} · ` : ''}
                        成长{' '}
                        <span className="font-mono">
                          {Number.isFinite(beast.growth)
                            ? beast.growth.toFixed(3)
                            : '—'}
                        </span>
                      </p>
                    </li>
                  );
                })}
              </ul>
            ) : (
              <p className="text-ink-secondary">无可携带灵兽。</p>
            )}
            <p className="text-ink-secondary text-xs">
              剧情记录 {preview.storyReceiptCount ?? 0} 条也会随角色迁移。
            </p>
          </PreviewSection>
        </>
      )}
    </div>
  );
}

function ManualLine({
  manual,
  equipped,
}: {
  manual: Preview['manuals'][number];
  equipped: boolean;
}) {
  const name = manualsById.get(manual.id)?.name ?? '未记载功法';
  const opened =
    manual.unlockedLevel !== undefined && manual.unlockedLevel > manual.level;
  const notes = [
    equipped ? '已装配' : '',
    manual.level === 9 ? '圆满' : '',
    opened ? `已开放至第 ${manual.unlockedLevel} 层` : '',
  ].filter(Boolean);
  return (
    <li className="bg-ink/3 rounded-sm px-3 py-3">
      <div className="flex items-baseline justify-between gap-3">
        <span className="font-semibold">{name}</span>
        <span className="font-mono font-semibold tracking-tight">
          {manual.level} 层
        </span>
      </div>
      {notes.length ? (
        <p className="text-ink-secondary mt-1 text-xs">{notes.join(' · ')}</p>
      ) : null}
    </li>
  );
}

function ItemGroup({
  title,
  items,
}: {
  title: string;
  items: Preview['items'];
}) {
  if (!items.length) return null;
  return (
    <div>
      <p className="text-ink-secondary mb-2 text-xs">{title}</p>
      <ul className="grid gap-2 sm:grid-cols-2">
        {items.map((item, index) => {
          const worn = item.location === 'equipped' || item.equipmentSlot;
          const place = worn
            ? (equipmentSlotName(item.equipmentSlot) ?? '穿戴')
            : `第 ${(item.slot ?? 0) + 1} 格`;
          const wield =
            item.equipmentLevel === null
              ? null
              : getLevelRealmStage(item.equipmentLevel).label;
          return (
            <li
              key={`${item.location}-${item.slot}-${item.definitionId}-${index}`}
              className="bg-ink/3 rounded-sm px-3 py-3"
            >
              <p className="text-ink-secondary text-xs">{place}</p>
              <div className="mt-1 flex items-baseline justify-between gap-3">
                <span className="font-semibold break-words">
                  {itemTitle(item)}
                </span>
                {item.quantity > 1 ? (
                  <span className="font-mono font-semibold tracking-tight">
                    ×{item.quantity}
                  </span>
                ) : null}
              </div>
              {wield ? (
                <p className="text-ink-secondary mt-1 text-xs">
                  御使境界 {wield}
                </p>
              ) : null}
            </li>
          );
        })}
      </ul>
    </div>
  );
}
