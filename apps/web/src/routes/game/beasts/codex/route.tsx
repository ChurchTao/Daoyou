import { BeastIcon } from '@app/components/feature/beasts/BeastIcon';
import { BeastSkillGrid } from '@app/components/feature/beasts/BeastSkillGrid';
import { GameSceneFrame } from '@app/components/game-shell/GameSceneFrame';
import { GameSceneTabs } from '@app/components/game-shell/GameSceneTabs';
import { InkButton } from '@app/components/ui/InkButton';
import { InkSwitch } from '@app/components/ui/InkSwitch';
import { InkTooltip } from '@app/components/ui/InkTooltip';
import { BEAST_RARE_SPECIES_IDS } from '@daoyou/game-content/beasts';
import { getMapNode } from '@daoyou/game-content/world/map';
import { getLevelRealmStage } from '@daoyou/game-domain/progression';
import {
  beastMutationBonus,
  listBeastCodex,
  type BeastCodexEntry,
  type BeastCodexHabitat,
} from '@daoyou/game-rules/beasts/presentation';
import { getAtlasRegion } from '@daoyou/game-rules/world/atlas';
import { useMemo, useState } from 'react';
import { useNavigate } from 'react-router';
import { BeastRosterScroll } from '../BeastRosterScroll';

const entries = listBeastCodex();
const realms = [...new Set(entries.map((entry) => entry.realm))];
const aptitudeRows = [
  ['attack', '攻击资质'],
  ['defense', '防御资质'],
  ['health', '体力资质'],
  ['mana', '法力资质'],
  ['speed', '速度资质'],
] as const;

function growthText(milli: number) {
  return (milli / 1000).toFixed(3);
}

function habitatPlace(habitat: BeastCodexHabitat) {
  const location = getMapNode(habitat.nodeId);
  const area = location ? getAtlasRegion(location)?.name : undefined;
  const place = location?.name ?? habitat.name;
  return area ? `${area} · ${place}` : place;
}

export default function BeastCodexPage() {
  const navigate = useNavigate();
  const [realm, setRealm] = useState('all');
  const [speciesId, setSpeciesId] = useState<string | null>(null);
  const [mutant, setMutant] = useState(false);
  const visible = useMemo(
    () =>
      realm === 'all'
        ? entries
        : entries.filter((entry) => entry.realm === realm),
    [realm],
  );
  const selected =
    visible.find((entry) => entry.id === speciesId) ?? visible[0];

  function choose(id: string) {
    setSpeciesId(id);
  }

  return (
    <GameSceneFrame variant="workflow">
      <GameSceneTabs
        activeValue={realm}
        onChange={(value) => {
          setRealm(value);
          const next =
            value === 'all'
              ? entries
              : entries.filter((entry) => entry.realm === value);
          if (!next.some((entry) => entry.id === speciesId) && next[0])
            choose(next[0].id);
        }}
        items={[
          { value: 'all', label: '全部' },
          ...realms.map((value) => ({ value, label: value })),
        ]}
      />
      <div className="grid min-w-0 gap-5 md:grid-cols-[200px_minmax(0,1fr)]">
        <aside className="border-ink/15 min-w-0 border-b pb-4 md:relative md:min-h-60 md:border-r md:border-b-0 md:pb-0">
          <div className="md:absolute md:inset-0 md:flex md:min-h-0 md:flex-col md:pr-4">
            <BeastRosterScroll key={realm}>
              {visible.map((entry) => (
                <button
                  type="button"
                  key={entry.id}
                  aria-pressed={selected?.id === entry.id}
                  onClick={() => choose(entry.id)}
                  className={`hover:bg-teal/5 flex min-w-0 items-center gap-2 border-l-2 px-1 py-3 text-left transition-colors md:gap-3 md:px-2 ${selected?.id === entry.id ? 'border-teal bg-teal/8' : 'border-transparent'}`}
                >
                  <span
                    aria-hidden
                    className="shrink-0 font-sans text-2xl md:text-3xl"
                  >
                    <BeastIcon speciesId={entry.id} isMutant={mutant} />
                  </span>
                  <span className="min-w-0">
                    <span className="block truncate text-sm" title={entry.name}>
                      {entry.name}
                    </span>
                    <span className="text-ink-secondary text-xs">
                      {entry.realm}
                    </span>
                  </span>
                </button>
              ))}
            </BeastRosterScroll>
          </div>
        </aside>
        {selected ? (
          <CodexDetail
            entry={selected}
            mutant={mutant}
            onMutantChange={setMutant}
            onTravel={(habitat) =>
              navigate(
                `/game/wild?nodeId=${encodeURIComponent(habitat.nodeId)}`,
                {
                  state: {
                    codexReturnTo: '/game/beasts/codex',
                  },
                },
              )
            }
          />
        ) : null}
      </div>
    </GameSceneFrame>
  );
}

function CoreSkillMark() {
  return (
    <div className="text-ink-secondary mt-1 flex items-center justify-center text-xs">
      <span>必带</span>
      <InkTooltip label="必带说明">
        必带技能每次融合、洗炼、捕捉时都必定会出现。
      </InkTooltip>
    </div>
  );
}

function CodexDetail({
  entry,
  mutant,
  onMutantChange,
  onTravel,
}: {
  entry: BeastCodexEntry;
  mutant: boolean;
  onMutantChange: (mutant: boolean) => void;
  onTravel: (habitat: BeastCodexHabitat) => void;
}) {
  const bound = (value: number) => (mutant ? beastMutationBonus(value) : value);
  return (
    <div className="@container min-w-0 space-y-5">
      <div className="relative">
        <div className="absolute top-0 right-0 flex items-center gap-2">
          <span className="text-ink-secondary text-xs">变异</span>
          <InkSwitch
            checked={mutant}
            onCheckedChange={onMutantChange}
            aria-label="变异形态"
          />
        </div>
        <div className="grid grid-cols-[96px_minmax(0,1fr)] items-center gap-x-3 gap-y-2 @min-[30rem]:grid-cols-[128px_minmax(0,1fr)] @min-[30rem]:items-start @min-[30rem]:gap-x-5 @min-[38rem]:grid-cols-[160px_minmax(0,1fr)]">
          <div className="row-span-2 flex items-center justify-center @min-[30rem]:row-span-1">
            <BeastIcon
              speciesId={entry.id}
              isMutant={mutant}
              className="text-[96px] @min-[30rem]:text-[128px] @min-[38rem]:text-[160px]"
            />
          </div>
          <div className="contents min-w-0 @min-[30rem]:block">
            <h2 className="self-end truncate pr-16 text-xl" title={entry.name}>
              {entry.name}
            </h2>
            <p className="text-ink-secondary mt-1 self-start pr-16 text-xs leading-6">
              {BEAST_RARE_SPECIES_IDS.has(entry.id) ? '稀有异兽 · ' : ''}
              {entry.realm} · 携带要求{' '}
              {getLevelRealmStage(entry.carryLevel).label}
            </p>
            <p className="text-ink-secondary col-span-2 text-sm leading-6 @min-[30rem]:mt-2">
              {entry.description}
            </p>
          </div>
        </div>
      </div>
      <section className="border-ink/15 border-t pt-4">
        <h3 className="text-teal mb-2 text-sm">
          {mutant ? '变异资质范围' : '资质范围'}
        </h3>
        <dl className="grid grid-cols-2 gap-x-5 lg:grid-cols-3">
          {aptitudeRows.map(([key, label]) => (
            <div
              key={key}
              className="border-ink/8 flex flex-wrap items-baseline justify-between gap-x-3 border-b py-1.5"
            >
              <dt className="text-ink-secondary text-xs">{label}</dt>
              <dd className="ml-auto font-mono text-sm">
                {bound(entry.aptitudes[key].min)}～
                {bound(entry.aptitudes[key].max)}
              </dd>
            </div>
          ))}
          <div className="border-ink/8 flex flex-wrap items-baseline justify-between gap-x-3 border-b py-1.5">
            <dt className="text-ink-secondary text-xs">成长</dt>
            <dd className="ml-auto font-mono text-sm">
              {growthText(bound(entry.growthMilli.min))}～
              {growthText(bound(entry.growthMilli.max))}
            </dd>
          </div>
        </dl>
      </section>
      <section>
        <h3 className="text-teal mb-2 text-sm">技能</h3>
        <BeastSkillGrid
          skills={entry.skills.map((skill) => skill.id)}
          slots={entry.skills.length}
          label={`${entry.name}的技能`}
          captions={Object.fromEntries(
            entry.skills
              .filter((skill) => skill.innate === 'core')
              .map((skill) => [skill.id, <CoreSkillMark key={skill.id} />]),
          )}
        />
      </section>
      <section className="border-ink/15 border-t pt-4">
        <h3 className="text-teal mb-2 text-sm">出没</h3>
        <ul className="divide-ink/8 divide-y">
          {entry.habitats.map((habitat) => (
            <li
              key={`${habitat.nodeId}:${habitat.minLevel}`}
              className="flex flex-wrap items-center justify-between gap-x-3 gap-y-1 py-2"
            >
              <div className="min-w-0">
                <p className="text-sm">{habitatPlace(habitat)}</p>
                <p className="text-ink-secondary text-xs">
                  {habitat.realmRequirement}开放 ·{' '}
                  <span className="font-mono">
                    {habitat.minLevel}～{habitat.maxLevel}
                  </span>
                  级
                </p>
              </div>
              <InkButton onClick={() => onTravel(habitat)}>前往</InkButton>
            </li>
          ))}
        </ul>
      </section>
    </div>
  );
}
