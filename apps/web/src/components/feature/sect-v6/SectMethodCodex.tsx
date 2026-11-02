import { InkButton } from '@app/components/ui/InkButton';
import { InkNotice } from '@app/components/ui/InkNotice';
import { cn } from '@app/lib/cn';
import type { SkillDef } from '@daoyou/combat-core/types';
import type { SectV6View } from '@daoyou/contracts/sects/combat';
import { COMBAT_V6_SECT_DEFINITIONS } from '@daoyou/game-content/sects';
import type { SectSkillDefV6 } from '@daoyou/game-domain/combat';
import { sectSkillCatalog } from '@daoyou/game-rules/sects/presentation';
import { useEffect, useState } from 'react';
import { combatV6Request } from '../combat-v6/request';
import { SkillDescription } from '../skills/SkillDescription';

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
  const definition = COMBAT_V6_SECT_DEFINITIONS[progress.sectId];
  const methodSkillIds = new Set([
    ...definition.skills.map((skill) => skill.definition.id),
    ...definition.paths.flatMap((path) => [
      ...(path.grantSkills ?? []).map((skill) => skill.definition.id),
      ...(path.foundationPassives ?? []).map((skill) => skill.definition.id),
    ]),
  ]);
  const skills = sectSkillCatalog(progress, characterLevel).filter((skill) =>
    methodSkillIds.has(skill.id),
  );
  const groups = definition.methods
    .slice()
    .sort((left, right) => left.slot - right.slot)
    .map((method) => ({
      method,
      level: progress.methods[method.id] ?? 0,
      skills: skills.filter((skill) => skill.methodId === method.id),
    }))
    .filter((group) => group.skills.length > 0);
  const opening =
    groups.flatMap((group) => group.skills).find((skill) => skill.available) ??
    groups[0]?.skills[0];
  const [methodId, setMethodId] = useState(
    () =>
      groups.find((group) =>
        group.skills.some((skill) => skill.id === opening?.id),
      )?.method.id ??
      groups[0]?.method.id ??
      '',
  );
  const [selectedId, setSelectedId] = useState(opening?.id ?? '');
  const group = groups.find((item) => item.method.id === methodId) ?? groups[0];
  const selected =
    group?.skills.find((skill) => skill.id === selectedId) ?? group?.skills[0];
  const learned = group?.skills.filter((skill) => skill.available) ?? [];
  const unlearned = group?.skills.filter((skill) => !skill.available) ?? [];
  const chooseMethod = (id: string) => {
    const next = groups.find((item) => item.method.id === id);
    setMethodId(id);
    const skill =
      next?.skills.find((item) => item.available) ?? next?.skills[0];
    if (skill) setSelectedId(skill.id);
  };
  if (!group || !selected) {
    return <p className="text-ink-secondary text-sm">此宗尚未配置心法神通。</p>;
  }
  return (
    <div>
      <div
        role="tablist"
        aria-label="心法"
        className="border-ink/10 flex gap-1 overflow-x-auto border-b"
      >
        {groups.map((item) => {
          const active = item.method.id === group.method.id;
          return (
            <button
              key={item.method.id}
              type="button"
              role="tab"
              aria-selected={active}
              onClick={() => chooseMethod(item.method.id)}
              className={cn(
                'focus-visible:outline-crimson/60 shrink-0 border-b-2 px-3 py-2 text-left focus-visible:outline-2 focus-visible:outline-offset-2',
                active
                  ? 'border-crimson text-ink'
                  : 'text-ink-secondary hover:text-ink border-transparent',
              )}
            >
              <span className="block text-sm leading-5">
                {item.method.name}
              </span>
              <span className="mt-0.5 block text-xs leading-4">
                <span className="font-mono">{item.level}</span>级
                {item.method.isPrimary ? ' · 主修' : ''}
              </span>
            </button>
          );
        })}
      </div>
      <div className="mt-6 grid items-start gap-8 lg:grid-cols-[15.5rem_minmax(0,1fr)]">
        <div>
          {learned.length ? (
            <SkillTiles
              label="已习"
              skills={learned}
              selectedId={selected.id}
              onSelect={setSelectedId}
            />
          ) : null}
          {unlearned.length ? (
            <div className={learned.length ? 'mt-5' : undefined}>
              <SkillTiles
                label="未习"
                skills={unlearned}
                selectedId={selected.id}
                onSelect={setSelectedId}
                quiet
              />
            </div>
          ) : null}
        </div>
        <SkillSheet
          skill={selected}
          definition={findSkill(progress.sectId, selected.id)}
        />
      </div>
    </div>
  );
}

function SkillTiles({
  label,
  skills,
  selectedId,
  onSelect,
  quiet = false,
}: {
  label: string;
  skills: ReturnType<typeof sectSkillCatalog>;
  selectedId: string;
  onSelect: (id: string) => void;
  quiet?: boolean;
}) {
  return (
    <div>
      <p className="text-ink-secondary mb-2 text-xs">{label}</p>
      <div className="grid grid-cols-3 gap-2 sm:grid-cols-4 lg:grid-cols-2">
        {skills.map((skill) => {
          const selected = skill.id === selectedId;
          return (
            <button
              key={skill.id}
              type="button"
              aria-pressed={selected}
              onClick={() => onSelect(skill.id)}
              className={cn(
                'focus-visible:outline-crimson/60 flex min-h-14 flex-col items-center justify-center px-2 py-2 text-center focus-visible:outline-2 focus-visible:outline-offset-2',
                selected
                  ? 'bg-ink text-bgpaper'
                  : quiet
                    ? 'text-ink/45 hover:text-ink hover:bg-ink/5'
                    : 'bg-bgpaper text-ink border-ink/15 hover:border-ink/40 border',
              )}
            >
              <span className="line-clamp-2 text-sm leading-5">
                {skill.name}
              </span>
              {skill.available ? (
                <span
                  className={cn(
                    'font-mono text-[11px] leading-none',
                    selected ? 'text-bgpaper/70' : 'text-ink-secondary',
                  )}
                >
                  {skill.level}
                </span>
              ) : null}
            </button>
          );
        })}
      </div>
    </div>
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
    typeof definition?.costMp === 'number' && definition.costMp > 0
      ? `${definition.costMp}法力`
      : null,
    typeof definition?.costHp === 'number' && definition.costHp > 0
      ? `${definition.costHp}气血`
      : null,
  ].filter((item): item is string => !!item);
  return (
    <article>
      <p className="text-ink-secondary text-xs leading-5">
        {skill.passive ? '被动' : '神通'}
        {skill.available ? ' · 已习' : ' · 未习'}
      </p>
      <h3 className="mt-1 text-3xl leading-tight font-medium">{skill.name}</h3>
      {flavor ? <p className="mt-5 text-lg leading-8">{flavor}</p> : null}
      <div className="border-ink/10 mt-6 border-t pt-4">
        <p className="text-ink-secondary text-xs">功效</p>
        <p className="mt-2 leading-7 whitespace-pre-line">
          <SkillDescription text={effect} />
        </p>
      </div>
      {costs.length ||
      (typeof definition?.cooldownRounds === 'number' &&
        definition.cooldownRounds > 0) ? (
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
