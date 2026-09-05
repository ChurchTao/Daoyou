import type { CombatV6SkillCommandOption } from '@shared/engine/combat-v6/core/types';
import { useId, useState } from 'react';
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
  const [hovered, setHovered] = useState(false);
  const [expanded, setExpanded] = useState(false);
  const preview = hovered || expanded;
  const descriptionId = useId();
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
    <div className="cv6-skill-row" onPointerLeave={() => setHovered(false)}>
      <div className="cv6-skill-name">
        <button
          type="button"
          className="cv6-skill-select"
          disabled={!skill.ready}
          onClick={onSelect}
        >
          {skill.name}
        </button>
        <button
          type="button"
          className="cv6-skill-help"
          aria-label={`查看${skill.name}说明`}
          aria-expanded={preview}
          aria-controls={descriptionId}
          onPointerEnter={(event) => {
            if (event.pointerType === 'mouse') setHovered(true);
          }}
          onClick={() => setExpanded((value) => !value)}
          onBlur={() => setExpanded(false)}
        >
          ?
        </button>
      </div>
      <small>
        {costs}
        {!skill.ready ? ` · ${skill.reasons.map(reasonText).join('；')}` : ''}
      </small>
      <div id={descriptionId} hidden={!preview} className="cv6-skill-preview">
        <p>{detail ?? '暂无技能效果说明。'}</p>
        <p>
          {skill.targetMode === 'all'
            ? '作用于全部有效目标'
            : skill.targetMode === 'random'
              ? `随机选取至多 ${skill.targetCount} 个目标`
              : `作用于至多 ${skill.targetCount} 个目标`}
        </p>
      </div>
    </div>
  );
}
