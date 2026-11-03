import { GameSceneFrame } from '@app/components/game-shell/GameSceneFrame';
import { GameSceneTabs } from '@app/components/game-shell/GameSceneTabs';
import { InkButton } from '@app/components/ui/InkButton';
import { InkTooltip } from '@app/components/ui/InkTooltip';
import { cn } from '@app/lib/cn';
import { DAO_WEAPONS } from '@daoyou/game-content/equipment/weapons';
import {
  DAO_EQUIPMENT_SLOTS,
  DAO_WEAPON_TYPES,
  EQUIPMENT_SLOT_NAMES,
  type DaoEquipmentSlot,
  type DaoWeaponType,
} from '@daoyou/game-domain/equipment';
import {
  listEquipmentCodex,
  listEquipmentCodexAffixes,
  type EquipmentCodexArt,
  type EquipmentCodexEssence,
  type EquipmentCodexSlot,
} from '@daoyou/game-rules/equipment/codex';
import { useMemo, useState } from 'react';

const affixes = listEquipmentCodexAffixes();
const views = [
  { value: 'stats', label: '基础属性' },
  { value: 'essences', label: '器蕴' },
  { value: 'arts', label: '器诀' },
] as const;
type CodexView = (typeof views)[number]['value'];
type SlotFilter = DaoEquipmentSlot | 'all';

export default function EquipmentCodexPage() {
  const [view, setView] = useState<CodexView>('stats');
  const [weaponType, setWeaponType] = useState<DaoWeaponType>('sword');
  const catalog = useMemo(
    () => listEquipmentCodex(weaponType),
    [weaponType],
  );
  const [level, setLevel] = useState(catalog[0]?.level ?? 10);
  const [slot, setSlot] = useState<DaoEquipmentSlot>('weapon');
  const realm = catalog.find((entry) => entry.level === level) ?? catalog[0];
  const selected =
    realm?.slots.find((entry) => entry.slot === slot) ?? realm?.slots[0];

  return (
    <GameSceneFrame variant="workflow">
      <div className="flex min-w-0 items-end gap-3">
        <GameSceneTabs
          className="w-auto min-w-0 flex-1"
          activeValue={view}
          onChange={(value) => setView(value as CodexView)}
          items={views.map((entry) => ({ ...entry }))}
        />
        <InkButton href="/game/craft/refine" className="mb-2 shrink-0">
          返回炼器室
        </InkButton>
      </div>
      {view === 'stats' && realm && selected ? (
        <StatView
          catalog={catalog}
          realm={realm}
          slot={selected}
          weaponType={weaponType}
          onLevel={setLevel}
          onSlot={setSlot}
          onWeaponType={setWeaponType}
        />
      ) : null}
      {view === 'essences' ? (
        <AffixView entries={affixes.essences} label="器蕴" />
      ) : null}
      {view === 'arts' ? <AffixView entries={affixes.arts} label="器诀" /> : null}
    </GameSceneFrame>
  );
}

function StatView({
  catalog,
  realm,
  slot,
  weaponType,
  onLevel,
  onSlot,
  onWeaponType,
}: {
  catalog: ReturnType<typeof listEquipmentCodex>;
  realm: (typeof catalog)[number];
  slot: EquipmentCodexSlot;
  weaponType: DaoWeaponType;
  onLevel: (level: number) => void;
  onSlot: (slot: DaoEquipmentSlot) => void;
  onWeaponType: (type: DaoWeaponType) => void;
}) {
  return (
    <div className="grid min-w-0 gap-5">
      <GameSceneTabs
        activeValue={String(realm.level)}
        onChange={(value) => onLevel(Number(value))}
        items={catalog.map((entry) => ({
          value: String(entry.level),
          label: entry.realm,
        }))}
      />
      <div className="grid min-w-0 gap-5 md:grid-cols-[160px_minmax(0,1fr)]">
        <aside className="border-ink/15 min-w-0 border-b pb-4 md:border-r md:border-b-0 md:pr-4 md:pb-0">
          <div
            role="group"
            aria-label="道装部位"
            className="grid grid-cols-3 gap-1 md:grid-cols-1"
          >
            {realm.slots.map((entry) => (
              <button
                key={entry.slot}
                type="button"
                aria-pressed={slot.slot === entry.slot}
                onClick={() => onSlot(entry.slot)}
                className={cn(
                  'hover:bg-teal/5 border-l-2 px-2 py-3 text-left text-sm transition-colors',
                  slot.slot === entry.slot
                    ? 'border-teal bg-teal/8'
                    : 'border-transparent',
                )}
              >
                {entry.name}
              </button>
            ))}
          </div>
        </aside>
        <article className="min-w-0 space-y-5 text-sm" aria-label={`${slot.name}基础属性`}>
          <header>
            <h2 className="text-lg font-semibold">{slot.name}</h2>
            <p className="text-ink-secondary mt-1 text-xs">
              需{realm.realm}初期御使
            </p>
          </header>
          {slot.slot === 'weapon' ? (
            <fieldset className="space-y-1">
              <legend className="text-sm font-medium">器形</legend>
              <div className="flex flex-wrap gap-1">
                {DAO_WEAPON_TYPES.map((type) => (
                  <label key={type} className="cursor-pointer">
                    <input
                      type="radio"
                      name="codexWeaponType"
                      value={type}
                      checked={weaponType === type}
                      onChange={() => onWeaponType(type)}
                      className="peer sr-only"
                    />
                    <span className="peer-checked:bg-crimson/5 peer-checked:text-crimson peer-focus-visible:ring-crimson/50 flex h-8 min-w-8 items-center justify-center rounded-sm px-2 peer-checked:font-semibold peer-focus-visible:ring-1">
                      {DAO_WEAPONS[type].name}
                    </span>
                  </label>
                ))}
              </div>
            </fieldset>
          ) : null}
          <section aria-label="基础属性范围">
            <p className="text-ink-secondary mb-2 text-xs leading-6">
              材料达到品阶门槛时落在基础范围，平均高出两阶时达到最高范围。
            </p>
            <dl>
              {slot.stats.map((stat) => (
                <div
                  key={stat.attr}
                  className="border-ink/8 flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1 border-b py-2"
                >
                  <dt className="text-ink-secondary text-xs">{stat.label}</dt>
                  <dd className="flex flex-wrap gap-x-4">
                    <Range label="基础" min={stat.base.min} max={stat.base.max} />
                    <Range label="最高" min={stat.peak.min} max={stat.peak.max} />
                  </dd>
                </div>
              ))}
            </dl>
          </section>
        </article>
      </div>
    </div>
  );
}

function AffixView({
  entries,
  label,
}: {
  entries: Array<EquipmentCodexEssence | EquipmentCodexArt>;
  label: string;
}) {
  const [filter, setFilter] = useState<SlotFilter>('all');
  const visible = entries.filter(
    (entry) => filter === 'all' || entry.slots.includes(filter),
  );

  return (
    <div className="grid min-w-0 gap-5">
      <div
        role="group"
        aria-label={`${label}部位`}
        className="flex flex-wrap gap-1"
      >
        <FilterChip
          pressed={filter === 'all'}
          onClick={() => setFilter('all')}
        >
          全部
        </FilterChip>
        {DAO_EQUIPMENT_SLOTS.map((slot) => (
          <FilterChip
            key={slot}
            pressed={filter === slot}
            onClick={() => setFilter(slot)}
          >
            {EQUIPMENT_SLOT_NAMES[slot]}
          </FilterChip>
        ))}
      </div>
      <div
        role="group"
        aria-label={label}
        className="grid w-full grid-cols-4 items-start gap-2 lg:grid-cols-8"
      >
        {visible.map((entry) => (
          <AffixTile key={entry.id} entry={entry} />
        ))}
      </div>
    </div>
  );
}

function AffixTile({
  entry,
}: {
  entry: EquipmentCodexEssence | EquipmentCodexArt;
}) {
  const scope = slotScope(entry.slots);
  return (
    <InkTooltip
      label={`查看${entry.name}效果`}
      triggerClassName="border-ink/20 bg-bgpaper text-ink hover:border-ink/40 flex aspect-square w-full min-w-0 flex-col items-center justify-center rounded-xs border px-1 text-center transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-teal"
      triggerContent={
        <span
          className={
            entry.name.length > 4
              ? 'max-w-[4em] text-[11px] leading-[1.2] text-balance'
              : 'text-sm leading-4'
          }
        >
          {entry.name}
        </span>
      }
    >
      <p className="font-medium">{entry.name}</p>
      <p className="text-ink-secondary">{scope}</p>
      {'rageCost' in entry ? (
        <p>
          战意 <span className="font-mono">{entry.rageCost}</span>
        </p>
      ) : null}
      <p className="text-ink mt-1 whitespace-pre-line">{entry.description}</p>
    </InkTooltip>
  );
}

function FilterChip({
  pressed,
  onClick,
  children,
}: {
  pressed: boolean;
  onClick: () => void;
  children: string;
}) {
  return (
    <button
      type="button"
      aria-pressed={pressed}
      onClick={onClick}
      className={cn(
        'h-8 rounded-sm px-2 text-sm',
        pressed ? 'bg-crimson/5 text-crimson font-semibold' : 'text-ink-secondary',
      )}
    >
      {children}
    </button>
  );
}

function slotScope(slots: readonly DaoEquipmentSlot[]) {
  return slots.length === DAO_EQUIPMENT_SLOTS.length
    ? '全部部位'
    : slots.map((slot) => EQUIPMENT_SLOT_NAMES[slot]).join(' · ');
}

function Range({
  label,
  min,
  max,
}: {
  label: string;
  min: number;
  max: number;
}) {
  return (
    <span>
      <span className="text-ink-secondary text-xs">{label} </span>
      <span className="font-mono">
        {min}–{max}
      </span>
    </span>
  );
}
