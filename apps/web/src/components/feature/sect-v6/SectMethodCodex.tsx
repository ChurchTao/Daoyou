import { GameImage } from '@app/components/ui/GameImage';
import { InkButton } from '@app/components/ui/InkButton';
import { InkNotice } from '@app/components/ui/InkNotice';
import { cn } from '@app/lib/cn';
import { useCultivatorIdentity } from '@app/lib/resources/player';
import type { SkillDef } from '@daoyou/combat-core/types';
import type { SectV6View } from '@daoyou/contracts/sects/combat';
import { COMBAT_V6_SECT_DEFINITIONS } from '@daoyou/game-content/sects';
import type {
  SectMethodDefV6,
  SectSkillDefV6,
} from '@daoyou/game-domain/combat';
import { sectSkillCatalog } from '@daoyou/game-rules/sects/presentation';
import { useEffect, useState } from 'react';
import { combatV6Request } from '../combat-v6/request';
import { SkillDescription } from '../skills/SkillDescription';

const slotPositions = [
  'col-start-1 row-start-2',
  'col-start-3 row-start-2',
  'col-start-1 row-start-3',
  'col-start-3 row-start-3',
  'col-start-1 row-start-1',
  'col-start-3 row-start-1',
] as const;

export function SectMethodCodex() {
  const [view, setView] = useState<SectV6View>();
  const [error, setError] = useState('');
  const [refresh, setRefresh] = useState(0);
  useEffect(() => {
    const controller = new AbortController();
    void combatV6Request<SectV6View>('/api/combat-v6/sect', {
      signal: controller.signal,
    })
      .then((data) => {
        if (!controller.signal.aborted) setView(data);
      })
      .catch((cause: unknown) => {
        if (!controller.signal.aborted)
          setError(cause instanceof Error ? cause.message : '读取心法失败');
      });
    return () => controller.abort();
  }, [refresh]);
  if (error) {
    return (
      <InkNotice>
        {error}
        <InkButton
          className="ml-2"
          onClick={() => {
            setError('');
            setView(undefined);
            setRefresh((value) => value + 1);
          }}
        >
          重新读取
        </InkButton>
      </InkNotice>
    );
  }
  if (!view) return <p className="text-ink-secondary">正在翻阅心法……</p>;
  if (!view.progress) {
    return (
      <InkNotice>
        {view.blockedReason ?? '尚未入宗，无从修习心法。'}
        <InkButton href="/game/sect" className="ml-2">
          前往宗门
        </InkButton>
      </InkNotice>
    );
  }
  return (
    <Codex progress={view.progress} characterLevel={view.characterLevel} />
  );
}

function Codex({
  progress,
  characterLevel,
}: {
  progress: NonNullable<SectV6View['progress']>;
  characterLevel: number;
}) {
  const gender = useCultivatorIdentity().data?.cultivator?.gender;
  const definition = COMBAT_V6_SECT_DEFINITIONS[progress.sectId];
  const skills = sectSkillCatalog(progress, characterLevel).filter(
    (skill) =>
      !skill.passive ||
      definition.skills.some((entry) => entry.definition.id === skill.id),
  );
  const groups = definition.methods
    .slice()
    .sort((left, right) => left.slot - right.slot)
    .map((method) => ({
      method,
      level: progress.methods[method.id] ?? 0,
      skills: [
        ...skills.filter(
          (skill) => skill.methodId === method.id && skill.available,
        ),
        ...skills.filter(
          (skill) => skill.methodId === method.id && !skill.available,
        ),
      ],
    }));
  const opening = groups
    .flatMap((group) => group.skills)
    .find((skill) => skill.available);
  const [methodId, setMethodId] = useState(
    () =>
      groups.find((group) =>
        group.skills.some((skill) => skill.id === opening?.id),
      )?.method.id ??
      groups.find((group) => group.method.isPrimary)?.method.id ??
      groups[0]?.method.id ??
      '',
  );
  const [selectedId, setSelectedId] = useState(
    () => opening?.id ?? groups[0]?.skills[0]?.id ?? '',
  );
  const group = groups.find((item) => item.method.id === methodId) ?? groups[0];
  const selected = group?.skills.find((skill) => skill.id === selectedId);
  const chooseMethod = (id: string) => {
    const next = groups.find((item) => item.method.id === id);
    setMethodId(id);
    setSelectedId(next?.skills[0]?.id ?? '');
  };
  if (!group) {
    return <p className="text-ink-secondary text-sm">此宗尚未配置心法。</p>;
  }
  return (
    <div className="grid items-start gap-5 text-sm lg:grid-cols-[minmax(0,1.05fr)_minmax(0,1fr)] lg:gap-7">
      <section aria-label="心法" className="lg:sticky lg:top-3">
        <div className="grid grid-cols-[6.75rem_minmax(0,1fr)_6.75rem] grid-rows-3 items-center gap-x-1 gap-y-2 sm:grid-cols-[8.75rem_minmax(0,1fr)_8.75rem] sm:gap-x-2">
          {gender ? (
            <GameImage
              src={`/assets/manuals/cultivator-${gender === '女' ? 'female' : 'male'}-meditation.webp`}
              alt=""
              width={960}
              height={960}
              draggable={false}
              className="pointer-events-none col-start-2 row-span-3 row-start-1 h-56 w-full object-contain select-none sm:h-72 lg:h-[22rem]"
            />
          ) : (
            <div className="col-start-2 row-span-3 row-start-1 h-56 sm:h-72 lg:h-[22rem]" />
          )}
          {groups.map((item) => (
            <div
              key={item.method.id}
              className={slotPositions[item.method.slot - 1]}
            >
              <MethodOrbit
                method={item.method}
                level={item.level}
                selected={item.method.id === group.method.id}
                onSelect={() => chooseMethod(item.method.id)}
              />
            </div>
          ))}
        </div>
      </section>
      <section
        aria-label={`${group.method.name}的神通`}
        className="border-ink/15 min-w-0 border-t pt-4 lg:border-t-0 lg:border-l lg:pt-0 lg:pl-7"
      >
        <header className="mb-3 flex min-h-11 items-baseline gap-2">
          <h3 className="font-medium">{group.method.name}</h3>
          <span className="text-ink-secondary font-mono text-xs">
            {group.level}级
          </span>
        </header>
        {group.skills.length ? (
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-2">
            {group.skills.map((skill) => {
              const active = skill.id === selected?.id;
              return (
                <button
                  key={skill.id}
                  type="button"
                  aria-pressed={active}
                  onClick={() => setSelectedId(skill.id)}
                  className={cn(
                    'focus-visible:outline-crimson relative min-h-16 border border-l-2 px-2 py-2 text-left focus-visible:outline-2 focus-visible:outline-offset-2',
                    active
                      ? 'border-ink/15 border-l-crimson bg-ink/5'
                      : skill.available
                        ? 'border-ink/15 hover:bg-ink/5'
                        : 'border-ink/10 text-ink/45 hover:bg-ink/5',
                  )}
                >
                  <span className="block pr-1 text-sm font-medium">
                    {skill.name}
                  </span>
                  <span className="text-ink-secondary mt-1 block text-xs">
                    {skill.passive ? '被动' : '神通'}
                    {skill.available ? '' : ' · 未习'}
                  </span>
                </button>
              );
            })}
          </div>
        ) : (
          <p className="text-ink-secondary border-ink/10 border-y py-12 text-center">
            此心法没有可查阅的神通。
          </p>
        )}
        {selected ? (
          <div className="border-ink/15 mt-4 border-t pt-4">
            <SkillSheet
              skill={selected}
              definition={findSkill(progress.sectId, selected.id)}
            />
          </div>
        ) : null}
      </section>
    </div>
  );
}

function MethodOrbit({
  method,
  level,
  selected,
  onSelect,
}: {
  method: SectMethodDefV6;
  level: number;
  selected: boolean;
  onSelect: () => void;
}) {
  return (
    <button
      type="button"
      aria-pressed={selected}
      aria-label={`${method.name}，${level}级${method.isPrimary ? '，主修' : ''}`}
      onClick={onSelect}
      className={cn(
        'focus-visible:outline-crimson min-h-16 w-full px-0.5 py-1.5 text-center transition-colors focus-visible:outline-2 focus-visible:outline-offset-2',
        selected
          ? 'bg-ink/8 text-ink'
          : 'text-ink-secondary hover:bg-ink/5 hover:text-ink',
        level === 0 && !selected && 'text-ink/40',
      )}
    >
      {method.isPrimary ? (
        <span className="text-crimson block text-[10px] tracking-[0.28em]">
          主修
        </span>
      ) : null}
      <span className="inline-flex max-w-full items-center justify-center gap-1">
        {selected ? (
          <span
            aria-hidden="true"
            className="h-1.5 w-1.5 shrink-0 rotate-45 bg-current"
          />
        ) : null}
        <span
          className={cn(
            'inline-block border-b border-current pb-0.5 text-xs leading-4 whitespace-nowrap sm:text-sm sm:leading-5',
            selected && 'border-b-2 font-semibold',
          )}
        >
          {method.name}
        </span>
      </span>
      <span className="mt-0.5 block font-mono text-xs">
        {level}
        <span className="font-sans">级</span>
      </span>
    </button>
  );
}

function SkillSheet({
  skill,
  definition,
}: {
  skill: ReturnType<typeof sectSkillCatalog>[number];
  definition: SkillDef | undefined;
}) {
  const lines = skill.description.split('\n');
  const flavor = lines.length > 1 ? lines[0] : null;
  const effect =
    lines.length > 1 ? lines.slice(1).join('\n') : skill.description;
  const costs = [
    describeCost(definition?.costMp, '法力'),
    describeCost(definition?.costHp, '气血'),
  ].filter((item): item is string => !!item);
  return (
    <article>
      <header className="flex flex-wrap items-baseline gap-2">
        <h3 className="text-lg font-semibold">{skill.name}</h3>
        <span className="text-ink-secondary text-xs">
          {skill.passive ? '被动' : '神通'}
          {skill.available ? ' · 已习' : ' · 未习'}
        </span>
      </header>
      {flavor ? (
        <p className="text-ink-secondary mt-3 leading-7">{flavor}</p>
      ) : null}
      <div className="border-ink/10 mt-4 border-t pt-4">
        <p className="text-ink-secondary text-xs">功效</p>
        <p className="mt-2 leading-7 whitespace-pre-line">
          <SkillDescription text={effect} />
        </p>
      </div>
      {costs.length ||
      (typeof definition?.cooldownRounds === 'number' &&
        definition.cooldownRounds > 0) ||
      (typeof definition?.initialCooldownRounds === 'number' &&
        definition.initialCooldownRounds > 0) ? (
        <dl className="border-ink/10 mt-4 grid gap-3 border-t pt-4 text-sm sm:grid-cols-2">
          {costs.length ? (
            <div>
              <dt className="text-ink-secondary text-xs">消耗</dt>
              <dd className="mt-1">{costs.join('，')}</dd>
            </div>
          ) : null}
          {typeof definition?.cooldownRounds === 'number' &&
          definition.cooldownRounds > 0 ? (
            <div>
              <dt className="text-ink-secondary text-xs">冷却</dt>
              <dd className="mt-1">
                <span className="font-mono">{definition.cooldownRounds}</span>{' '}
                回合
              </dd>
            </div>
          ) : null}
          {typeof definition?.initialCooldownRounds === 'number' &&
          definition.initialCooldownRounds > 0 ? (
            <div>
              <dt className="text-ink-secondary text-xs">开场冷却</dt>
              <dd className="mt-1">
                <span className="font-mono">
                  {definition.initialCooldownRounds}
                </span>{' '}
                回合
              </dd>
            </div>
          ) : null}
        </dl>
      ) : null}
      {!skill.available && skill.requirement ? (
        <p className="text-ink-secondary mt-4 text-sm leading-6">
          {skill.requirement}
        </p>
      ) : null}
    </article>
  );
}

function describeCost(
  cost: SkillDef['costMp'],
  unit: '法力' | '气血',
): string | null {
  if (typeof cost === 'number') return cost > 0 ? `${cost}${unit}` : null;
  if (!cost) return null;
  const perTarget = /^(\d+)\s*\*\s*targets$/.exec(cost.trim());
  if (perTarget) return `每目标${perTarget[1]}${unit}`;
  if (unit === '气血' && cost.replace(/\s/g, '') === 'floor(maxHp*0.2)')
    return '最大气血的20%（向下取整）';
  return `变动${unit}（以施放时为准）`;
}

function findSkill(
  sectId: keyof typeof COMBAT_V6_SECT_DEFINITIONS,
  id: string,
) {
  const definition = COMBAT_V6_SECT_DEFINITIONS[sectId];
  const skills: SectSkillDefV6[] = [
    ...definition.skills,
    ...definition.paths.flatMap((path) => [
      ...(path.grantSkills ?? []),
      ...(path.foundationPassives ?? []),
      ...path.nodes.flatMap((node) => [
        ...(node.grantSkills ?? []),
        ...(node.passives ?? []),
      ]),
    ]),
  ];
  return skills.find((skill) => skill.definition.id === id)?.definition;
}
