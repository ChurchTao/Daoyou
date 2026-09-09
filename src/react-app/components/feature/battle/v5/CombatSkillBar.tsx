import { cn } from '@shared/lib/cn';
import type { PublicBattleUnitSnapshotV1 } from '@shared/types/battle';
import { format } from 'd3-format';

interface Props {
  unit: PublicBattleUnitSnapshotV1 | null;
}

type SkillState = PublicBattleUnitSnapshotV1['cooldowns'][number];

const fmtInt = format(',d');

function SkillStateItem({
  skill,
  unit,
}: {
  skill: SkillState;
  unit: PublicBattleUnitSnapshotV1;
}) {
  const isOnCooldown = skill.current > 0;
  const hpCost = skill.costs?.find((cost) => cost.resource === 'hp');
  const mpCost = skill.costs?.find((cost) => cost.resource === 'mp');
  const resolvedMpCost = mpCost?.resolvedAmount ?? skill.mpCost;
  const isLowMp = unit.mp.current < resolvedMpCost;
  const isLowHp = hpCost ? unit.hp.current <= hpCost.resolvedAmount : false;
  const stateLabel = isOnCooldown
    ? `CD ${skill.current}`
    : isLowMp || isLowHp
      ? isLowHp
        ? '血竭'
        : '缺灵'
      : '可用';
  const costLabel = hpCost
    ? `血 ${fmtInt(hpCost.resolvedAmount)}`
    : resolvedMpCost > 0
      ? `灵 ${fmtInt(resolvedMpCost)}`
      : '免耗';

  return (
    <div className="bg-battle-faint border-battle-faint grid min-w-0 grid-cols-[minmax(0,1fr)_auto_auto] items-center gap-x-1.5 border border-dashed px-1.5 py-1">
      <span className="text-ink min-w-0 truncate">{skill.skillName}</span>
      <span
        className={cn(
          'shrink-0 border px-1 py-0.5 text-[10px] leading-none font-medium',
          isOnCooldown
            ? 'border-battle-faint bg-paper text-battle-muted'
            : isLowMp
              ? 'border-crimson/20 bg-crimson/5 text-crimson'
              : 'border-teal/20 bg-teal/10 text-teal',
        )}
      >
        {stateLabel}
      </span>
      <span className="text-battle-muted shrink-0 font-mono text-[10px] leading-none">
        {costLabel}
      </span>
    </div>
  );
}

export function CombatSkillBar({ unit }: Props) {
  if (!unit || unit.cooldowns.length === 0) return null;

  const defaultAttack = unit.cooldowns.find(
    (skill) => skill.isDefaultAttack === true,
  );
  const equippedSkills = unit.cooldowns.filter(
    (skill) => skill.isDefaultAttack !== true,
  );

  return (
    <div className="space-y-2 text-[13px] leading-5">
      <div className="text-battle-muted text-xs">技能状态</div>
      {defaultAttack ? (
        <div className="space-y-1">
          <div className="text-battle-muted text-[10px]">
            基础式 · 不占主动栏
          </div>
          <SkillStateItem skill={defaultAttack} unit={unit} />
        </div>
      ) : null}
      {equippedSkills.length > 0 ? (
        <div className="space-y-1">
          <div className="text-battle-muted text-[10px]">装配神通</div>
          <div className="grid grid-cols-2 gap-1.5">
            {equippedSkills.map((skill) => (
              <SkillStateItem key={skill.skillId} skill={skill} unit={unit} />
            ))}
          </div>
        </div>
      ) : null}
    </div>
  );
}
