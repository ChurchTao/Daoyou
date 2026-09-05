import { GameLoadingState } from '@app/components/game-shell/GameLoadingState';
import type { ReactNode } from 'react';
import { Link } from 'react-router';
import './combat-v6.css';

export function CombatV6Page({
  title,
  children,
  loading,
  error,
  active = false,
  back = '/game',
  backLabel = '返回',
  onRetry,
}: {
  title: string;
  children: ReactNode;
  loading?: boolean;
  error?: string;
  active?: boolean;
  back?: string;
  backLabel?: string;
  onRetry?: () => void;
}) {
  return (
    <div className={`combat-v6-page ${active ? 'is-active' : ''}`}>
      {!active && (
        <header className="cv6-page-header">
          <h1>{title}</h1>
          <Link to={back}>{backLabel}</Link>
        </header>
      )}
      {error && (
        <p className="cv6-error" role="alert">
          {error}
          {onRetry ? (
            <button className="ml-2 underline" onClick={onRetry}>
              重新载入战斗
            </button>
          ) : null}
        </p>
      )}
      {loading ? (
        <GameLoadingState message="正在载入战斗……" variant="scene" />
      ) : (
        children
      )}
    </div>
  );
}
