import { InkTooltip } from '@app/components/ui/InkTooltip';
import type { CombatV6SkillCommandOption } from '@shared/engine/combat-v6/core/types';
import { reasonText } from './presentation';

export function CombatV6SkillChoice({
  skill,
  detail,
  resources,
  onSelect,
}: {
  skill: CombatV6SkillCommandOption;
  detail?: string;
  resources: Array<{ id: string; name: string }>;
  onSelect: () => void;
}) {
  const costs =
    [
      skill.costs.mp ? `${skill.costs.mp} 法力` : '',
      skill.costs.hp ? `${skill.costs.hp} 气血` : '',
      ...skill.costs.resources.map(
        (cost) =>
          `${cost.amount} ${resources.find((resource) => resource.id === cost.resourceId)?.name ?? '资源'}`,
      ),
    ]
      .filter(Boolean)
      .join(' · ') || '无消耗';
  return (
    <div className="cv6-skill-row">
      <div className="cv6-skill-name">
        <button
          type="button"
          className="cv6-skill-select"
          disabled={!skill.ready}
          onClick={onSelect}
        >
          {skill.name}
        </button>
        <InkTooltip label={`查看${skill.name}说明`}>
          <p className="mb-1 font-medium">{skill.name}</p>
          <p>{detail ?? '暂无技能效果说明。'}</p>
          <p className="text-ink-secondary mt-1 text-xs">
            {skill.targetMode === 'all'
              ? '作用于全部有效目标'
              : skill.targetMode === 'random'
                ? `随机选取至多 ${skill.targetCount} 个目标`
                : `作用于至多 ${skill.targetCount} 个目标`}
          </p>
        </InkTooltip>
      </div>
      <small>
        {costs}
        {!skill.ready ? ` · ${skill.reasons.map(reasonText).join('；')}` : ''}
      </small>
    </div>
  );
}
