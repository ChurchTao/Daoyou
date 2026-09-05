import { InkButton } from '@app/components/ui/InkButton';
import { InkCard } from '@app/components/ui/InkCard';
import type {
  CombatV6TrainingCommandV1,
  CombatV6TrainingSessionViewV1,
} from '@shared/contracts/combatV6';
type Session = Omit<CombatV6TrainingSessionViewV1, 'encounterId' | 'tier'>;

export function UnitCard({
  unit,
}: {
  unit: CombatV6TrainingSessionViewV1['units'][number];
}) {
  const recoverableHp = Math.max(1, unit.maxHp - unit.wound);
  return (
    <InkCard variant={unit.side === 0 ? 'highlighted' : 'default'} padding="sm">
      <div className="flex items-start justify-between gap-3">
        <div>
          <strong>{unit.name}</strong>
          <span className="text-ink-secondary ml-2 text-xs">
            {unit.side === 0 ? '我方' : '敌方'}·{unit.slot + 1}位
          </span>
        </div>
        <span className="text-xs">
          {unit.dead
            ? '死亡'
            : unit.downed
              ? '倒地'
              : unit.escaped
                ? '离场'
                : '站立'}
        </span>
      </div>
      <div className="mt-2 grid grid-cols-2 gap-2 text-sm">
        <span>
          气血 {unit.hp}/{recoverableHp}
        </span>
        <span>
          法力 {unit.mp}/{unit.maxMp}
        </span>
        <span>伤势 {unit.wound}</span>
        <span>
          护盾 {unit.barriers.reduce((sum, item) => sum + item.current, 0)}
        </span>
      </div>
      {(unit.statuses.length > 0 ||
        unit.resources.length > 0 ||
        unit.barriers.length > 0) && (
        <div className="text-ink-secondary mt-2 flex flex-wrap gap-x-3 gap-y-1 text-xs">
          {unit.statuses.map((status) => (
            <span key={`${status.id}-${status.remainingRounds}`}>
              {status.id} ×{status.stacks}（{status.remainingRounds}回合）
            </span>
          ))}
          {unit.barriers.map((barrier) => (
            <span key={barrier.id}>
              {barrier.name} {barrier.current}（{barrier.remainingRounds}回合）
            </span>
          ))}
          {unit.resources.map((resource) => (
            <span key={resource.id}>
              {resource.name} {resource.current}/{resource.max}
            </span>
          ))}
        </div>
      )}
    </InkCard>
  );
}

export function CommandPanel({
  session,
  pending,
  onSubmit,
  onResolve,
  onAbandon,
}: {
  session: Session;
  pending: boolean;
  onSubmit: (command: CombatV6TrainingCommandV1) => void;
  onResolve: () => void;
  onAbandon: () => void;
}) {
  const options = session.commandOptions;
  const targets = new Map(session.units.map((unit) => [unit.id, unit.name]));
  if (session.outcome) {
    const labels = {
      victory: '胜利',
      defeat: '落败',
      draw: '平局',
      aborted: '已中止',
    };
    return (
      <InkCard variant="highlighted" padding="lg">
        <h2 className="font-heading text-xl">
          战斗结果：{labels[session.outcome]}
        </h2>
        <div className="mt-3">
          <InkButton variant="primary" pending={pending} onClick={onAbandon}>
            结束本次战斗
          </InkButton>
        </div>
      </InkCard>
    );
  }
  return (
    <InkCard variant="elevated" padding="lg">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <h2 className="font-heading text-xl">第 {session.round} 回合指令</h2>
          <p className="text-ink-secondary mt-1 text-xs">
            {session.pendingCommand
              ? '已锁定一条指令，可继续覆盖。'
              : '请选择本回合指令。'}
          </p>
        </div>
        <InkButton variant="ghost" pending={pending} onClick={onAbandon}>
          放弃战斗
        </InkButton>
      </div>
      {!options?.canSubmit ? (
        <p className="text-crimson mt-3 text-sm">
          {options?.reasons.join('；') || '当前无法提交指令'}
        </p>
      ) : null}
      <div className="mt-4 space-y-3">
        <div className="flex flex-wrap gap-2">
          {options?.attackTargetIds.map((id) => (
            <InkButton
              key={id}
              disabled={pending || !options.canSubmit}
              onClick={() => onSubmit({ type: 'attack', target: id })}
            >
              攻击·{targets.get(id) ?? id}
            </InkButton>
          ))}
          {options?.canDefend ? (
            <InkButton
              disabled={pending || !options.canSubmit}
              onClick={() => onSubmit({ type: 'defend' })}
            >
              防御
            </InkButton>
          ) : null}
          {options?.protectTargetIds.map((id) => (
            <InkButton
              key={id}
              disabled={pending || !options.canSubmit}
              onClick={() => onSubmit({ type: 'protect', target: id })}
            >
              保护·{targets.get(id) ?? id}
            </InkButton>
          ))}
          {options?.canFlee ? (
            <InkButton
              disabled={pending || !options.canSubmit}
              onClick={() => onSubmit({ type: 'flee' })}
            >
              逃跑
            </InkButton>
          ) : null}
        </div>
        {options?.skills.map((skill) => (
          <div
            key={skill.skillId}
            className="border-ink/10 border-t pt-2 text-sm"
          >
            <div className="flex flex-wrap items-center gap-2">
              <strong>{skill.skillId}</strong>
              {!skill.ready ? (
                <span className="text-crimson text-xs">
                  {skill.reasons.join('；')}
                </span>
              ) : null}
              {skill.selectableTargetIds.map((id) => (
                <InkButton
                  key={id}
                  disabled={pending || !options.canSubmit || !skill.ready}
                  onClick={() =>
                    onSubmit({
                      type: 'skill',
                      skillId: skill.skillId,
                      targets: [id],
                    })
                  }
                >
                  施展·{targets.get(id) ?? id}
                </InkButton>
              ))}
            </div>
          </div>
        ))}
      </div>
      <div className="border-ink/15 mt-5 border-t pt-3">
        <InkButton
          variant="primary"
          pending={pending}
          disabled={!session.pendingCommand}
          onClick={onResolve}
        >
          推进回合
        </InkButton>
      </div>
    </InkCard>
  );
}
