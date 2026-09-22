import { GameIcon } from '@app/components/ui/GameIcon';
import { InkButton } from '@app/components/ui/InkButton';
import { InkDetailDrawer } from '@app/components/ui/InkDetailDrawer';
import { findBeastSkillPresentation } from '@shared/combat-v6/beast-skill-presentation';
import type { CombatV6SkillCommandOption } from '@shared/engine/combat-v6/core/types';
import { useState, type ReactNode } from 'react';
import { reasonText, skillNeedsTarget } from './presentation';
import type { CombatV6Session } from './session';

export function CombatV6SkillChoice({
  timing,
  category,
  skills,
  session,
  onClose,
  onSelect,
}: {
  timing?: ReactNode;
  category: 'spell' | 'art';
  skills: CombatV6SkillCommandOption[];
  session: CombatV6Session;
  onClose: () => void;
  onSelect: (skill: CombatV6SkillCommandOption) => void;
}) {
  // Default preview is not a user selection: the first click must never cast.
  const [selectedId, setSelectedId] = useState<string>();
  const selected =
    skills.find((skill) => skill.skillId === selectedId) ??
    skills.find((skill) => skill.ready) ??
    skills[0];
  const actor = session.units.find(
    (unit) => unit.id === session.commandOptions?.unitId,
  );
  const title = category === 'spell' ? '神通' : '器诀';
  const costItems = (skill: CombatV6SkillCommandOption) => [
    ...(skill.costs.mp
      ? [{ name: '法力', amount: skill.costs.mp, current: actor?.mp }]
      : []),
    ...(skill.costs.hp
      ? [{ name: '气血', amount: skill.costs.hp, current: actor?.hp }]
      : []),
    ...skill.costs.resources.map((cost) => ({
      name:
        actor?.resources.find((r) => r.id === cost.resourceId)?.name ?? '资源',
      amount: cost.amount,
      current: actor?.resources.find((r) => r.id === cost.resourceId)?.current,
    })),
  ];
  const scope = (skill: CombatV6SkillCommandOption) => {
    const targets = session.units.filter((unit) =>
      skill.selectableTargetIds.includes(unit.id),
    );
    const side =
      targets.length === 1 && targets[0].id === actor?.id
        ? '自身'
        : targets.length && targets.every((unit) => unit.side === actor?.side)
          ? '友方'
          : targets.length && targets.every((unit) => unit.side !== actor?.side)
            ? '敌方'
            : '目标';
    if (side === '自身') return side;
    return `${side} · ${skill.targetMode === 'all' ? '全体' : skill.targetMode === 'random' ? `随机至多 ${skill.targetCount} 个` : skill.targetCount > 1 ? `至多 ${skill.targetCount} 个` : '单体'}`;
  };
  return (
    <InkDetailDrawer
      isOpen
      title={title}
      size="lg"
      className="cv6-choice-drawer"
      onClose={onClose}
      description={
        <>
          {actor ? (
            <span className="cv6-choice-actor">
              <GameIcon
                value={
                  session.display?.unitAppearances?.[actor.id]?.icon ?? '👤'
                }
              />
              {actor.name}
            </span>
          ) : null}
          {timing}
        </>
      }
      footer={
        selected ? (
          <div className="cv6-choice-footer">
            <span>{selected.name}</span>
            <InkButton
              variant="primary"
              disabled={!selected.ready}
              onClick={() => onSelect(selected)}
            >
              {skillNeedsTarget(selected, actor?.id) ? '选择目标 →' : '施放'}
            </InkButton>
          </div>
        ) : undefined
      }
    >
      {selected ? (
        <div className="cv6-choice-layout">
          <div className="cv6-choice-list" aria-label={`${title}选择`}>
            {skills.map((skill) => {
              const icon = findBeastSkillPresentation(skill.skillId)?.icon;
              const quickConfirm = selectedId === skill.skillId && skill.ready;
              return (
                <button
                  key={skill.skillId}
                  type="button"
                  className={`cv6-choice-option ${!skill.ready ? 'is-unavailable' : ''}`}
                  aria-pressed={selected.skillId === skill.skillId}
                  onClick={() => {
                    if (quickConfirm) onSelect(skill);
                    else setSelectedId(skill.skillId);
                  }}
                >
                  <span className="cv6-choice-option-title">
                    {icon ? <GameIcon value={icon} /> : null}
                    <strong>{skill.name}</strong>
                    <span aria-hidden>
                      {selected.skillId === skill.skillId ? '✓' : '›'}
                    </span>
                  </span>
                  <span className="cv6-choice-option-meta">
                    <span>
                      {costItems(skill).map((cost) => (
                        <span key={cost.name}>
                          <span className="font-mono">{cost.amount}</span>{' '}
                          {cost.name}{' '}
                        </span>
                      ))}
                      {!costItems(skill).length ? '无消耗' : null}
                    </span>
                    <span
                      className={quickConfirm ? 'cv6-choice-quick' : undefined}
                    >
                      {quickConfirm
                        ? skillNeedsTarget(skill, actor?.id)
                          ? '再次点击施放 →'
                          : '再次点击施放 →'
                        : skill.ready
                          ? scope(skill)
                          : '暂不可用'}
                    </span>
                  </span>
                </button>
              );
            })}
          </div>
          <section
            className="cv6-choice-preview"
            aria-label={`${selected.name}效果`}
          >
            <h3>{selected.name}</h3>
            <p className="cv6-choice-scope">{scope(selected)}</p>
            <p className="cv6-choice-description">
              {session.display?.skillDetails?.[selected.skillId]?.description ??
                '暂无效果说明。'}
            </p>
            <dl className="cv6-choice-costs">
              {costItems(selected).map((cost) => (
                <div key={cost.name}>
                  <dt>{cost.name}</dt>
                  <dd>
                    <span className="font-mono">{cost.amount}</span>
                    {cost.current !== undefined ? (
                      <small>
                        当前 <span className="font-mono">{cost.current}</span>
                      </small>
                    ) : null}
                  </dd>
                </div>
              ))}
            </dl>
            {selected.reasons.length ? (
              <p className="cv6-choice-warning">
                {selected.reasons.map(reason => reason === 'cooldown' ? `冷却剩余 ${selected.cooldownRemaining ?? 0} 回合` : reasonText(reason)).join('；')}
                {selected.ready ? '（行动时判定）' : ''}
              </p>
            ) : null}
          </section>
        </div>
      ) : (
        <div className="cv6-choice-empty">
          <strong>尚无{title}</strong>
          <p>
            {category === 'art'
              ? '装备带有器诀的道装后，可在此选择。'
              : '掌握的主动神通会显示在这里。'}
          </p>
        </div>
      )}
    </InkDetailDrawer>
  );
}
