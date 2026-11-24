import { GameImage } from '@app/components/ui/GameImage';
import { InkButton } from '@app/components/ui/InkButton';
import type { ReactNode } from 'react';
import { Link } from 'react-router';
import './weekly-activity.css';

export function WeeklyActivityHeader({
  title,
  place,
  mapHref,
  onRules,
  rulesLabel = '规则与奖励',
  disabled,
}: {
  title: string;
  place: string;
  mapHref: string;
  onRules: () => void;
  rulesLabel?: string;
  disabled?: boolean;
}) {
  return (
    <header className="weekly-activity-header">
      <div className="weekly-activity-header-content">
        <Link to={mapHref} aria-label={`返回${place}`}>
          <span aria-hidden="true">‹ </span>
          {place}
        </Link>
        <h1>{title}</h1>
        <InkButton variant="secondary" disabled={disabled} onClick={onRules}>
          {rulesLabel}
        </InkButton>
      </div>
    </header>
  );
}

export function WeeklyActivityLobby({
  art,
  place,
  title,
  note,
  schedule,
  facts,
  admission,
  action,
  rankHref,
  rankName,
}: {
  art: string;
  place: string;
  title: string;
  note: string;
  schedule: string;
  facts: readonly string[];
  admission?: ReactNode;
  action?: ReactNode;
  rankHref: string;
  rankName: string;
}) {
  return (
    <section
      className="weekly-activity-lobby"
      aria-labelledby="weekly-activity-state"
    >
      <GameImage src={art} alt="" className="weekly-activity-art" />
      <div className="weekly-activity-lobby-inner">
        <div className="weekly-activity-entry">
          <p className="weekly-activity-place">{place}</p>
          <h2 id="weekly-activity-state">{title}</h2>
          <p role="status">{note}</p>
          <ul className="weekly-activity-facts">
            {facts.map((fact) => (
              <li key={fact}>{fact}</li>
            ))}
          </ul>
          {admission && (
            <p className="weekly-activity-admission">{admission}</p>
          )}
          <div className="weekly-activity-actions">
            {action}
            <InkButton
              variant={action ? 'secondary' : 'primary'}
              href={rankHref}
            >
              查看{rankName}
            </InkButton>
          </div>
          <p className="weekly-activity-schedule">{schedule}</p>
        </div>
      </div>
    </section>
  );
}
