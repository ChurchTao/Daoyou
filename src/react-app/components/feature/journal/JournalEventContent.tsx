import {
  JOURNAL_ACTIVITIES,
  type PlayerJournalEvent,
} from '@shared/contracts/playerJournal';
import { Fragment } from 'react';

const resourceStyles = {
  spiritStones: { label: '灵石', className: 'text-amber-700' },
  exp: { label: '修为', className: 'text-teal' },
  insight: { label: '感悟', className: 'text-resource-shield' },
  reputation: { label: '声望', className: 'text-amber-700' },
  contribution: { label: '宗门贡献', className: 'text-teal' },
  qi: { label: '灵气', className: 'text-ink-secondary' },
} as const;

function ResourceAmount({
  resource,
  value,
}: {
  resource: keyof typeof resourceStyles;
  value: number;
}) {
  const style = resourceStyles[resource];
  return (
    <span className={`whitespace-nowrap ${style.className}`}>
      {style.label}
      <span className="font-mono">
        {value > 0 ? '+' : ''}
        {(value === 0 ? 0 : value).toLocaleString('zh-CN')}
      </span>
    </span>
  );
}

export function JournalEventContent({ event }: { event: PlayerJournalEvent }) {
  if (event.type === 'resources.settled') {
    return (
      <>
        {JOURNAL_ACTIVITIES[event.activity]}
        {event.detail ? `（${event.detail}）` : ''}：
        {event.changes.map((change, index) => (
          <Fragment key={index}>
            {index > 0 ? '，' : null}
            {change.kind === 'resource' ? (
              <ResourceAmount
                resource={change.resource}
                value={change.amount}
              />
            ) : (
              <span>
                {change.name}
                <span className="font-mono whitespace-nowrap">
                  {change.amount > 0 ? '+' : ''}
                  {change.amount.toLocaleString('zh-CN')}
                </span>
              </span>
            )}
          </Fragment>
        ))}
        。
      </>
    );
  }
  if (event.type === 'retreat.completed') {
    return (
      <>
        闭关<span className="font-mono">{event.years}</span>年
        {event.summary.epiphany_triggered ? '（顿悟）' : ''}：
        <ResourceAmount resource="exp" value={event.summary.exp_gained} />，
        <ResourceAmount
          resource="insight"
          value={event.summary.insight_gained}
        />
        ，
        <ResourceAmount resource="qi" value={-event.qiSpent} />
        {event.depleted ? (
          <span className="text-crimson">，寿元已尽</span>
        ) : null}
        。
      </>
    );
  }
  const summary = event.summary;
  return (
    <>
      突破{summary.success ? '成功' : '失败'}（{summary.fromRealm}
      {summary.fromStage}
      {summary.success ? `→${summary.toRealm}${summary.toStage}` : ''}）：
      <ResourceAmount resource="exp" value={-event.expSpent} />，
      <ResourceAmount resource="insight" value={summary.insight_change} />，
      <ResourceAmount resource="qi" value={-event.qiSpent} />
      {summary.lifespanGained > 0 ? (
        <span className="whitespace-nowrap">
          ，寿元上限<span className="font-mono">+{summary.lifespanGained}</span>
          年
        </span>
      ) : null}
      {summary.naturalAttributeGrowth > 0 ? (
        <span className="whitespace-nowrap">
          ，六维各
          <span className="font-mono">+{summary.naturalAttributeGrowth}</span>
        </span>
      ) : null}
      {summary.attributePointReward > 0 ? (
        <span className="whitespace-nowrap">
          ，属性点
          <span className="font-mono">+{summary.attributePointReward}</span>
        </span>
      ) : null}
      {summary.inner_demon_triggered ? (
        <span className="text-crimson">，心魔缠身</span>
      ) : null}
      。
    </>
  );
}
