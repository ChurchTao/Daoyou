import { InkButton } from '@app/components/ui/InkButton';
import { CONTEST_ATTEMPTS } from '@daoyou/game-domain/alchemy/contest';
import { getAlchemyPropertyLabel } from '@daoyou/game-rules/alchemy';
import {
  formatClock,
  formatStrength,
  type ContestSession,
} from './presentation';

export function ContestTicket({
  session,
  seconds,
  busy,
  firing,
  showReceipt,
  confirmFinish,
}: {
  session: ContestSession;
  seconds: number;
  busy: boolean;
  firing: boolean;
  showReceipt: (index: number) => void;
  confirmFinish: () => void;
}) {
  const { question, attempts } = session;
  return (
    <section className="contest-ticket" aria-label="本期目标与赛况">
      <div className="contest-ticket-copy">
        <div className="contest-ticket-title">
          <span className="contest-ticket-seal">本期目标</span>
          <h2>{question.title}</h2>
        </div>
        {question.title !== question.pillName && (
          <p className="contest-ticket-goal">
            炼制 <b>{question.pillName}</b>
          </p>
        )}
        <dl className="contest-targets">
          <div>
            <dt>主药效</dt>
            <dd>
              {getAlchemyPropertyLabel(question.primary)}{' '}
              <span className="font-mono">
                ≥ {formatStrength(question.primary, question.minimumStrength)}
              </span>
            </dd>
          </div>
          {question.secondary && (
            <div>
              <dt>辅药效</dt>
              <dd>{getAlchemyPropertyLabel(question.secondary)}</dd>
            </div>
          )}
          <div>
            <dt>丹毒</dt>
            <dd className="font-mono">≤ {question.maximumToxicity}</dd>
          </div>
        </dl>
      </div>

      <div className="contest-participation">
        <div className="contest-participation-heading">
          <h3>我的三炉</h3>
          <div className="contest-timing">
            <span>剩余</span>
            <time
              className="font-mono"
              dateTime={'PT' + seconds + 'S'}
              data-urgent={seconds < 60 || undefined}
            >
              {formatClock(seconds)}
            </time>
          </div>
          <InkButton
            variant="secondary"
            disabled={busy}
            onClick={confirmFinish}
          >
            提前结算
          </InkButton>
        </div>
        <ContestRounds
          attempts={attempts}
          currentIndex={attempts.length}
          busy={busy}
          firing={firing}
          showReceipt={showReceipt}
        />
      </div>
    </section>
  );
}

export function ContestRounds({
  attempts,
  currentIndex,
  busy = false,
  firing = false,
  showReceipt,
}: {
  attempts: ContestSession['attempts'];
  currentIndex?: number;
  busy?: boolean;
  firing?: boolean;
  showReceipt: (index: number) => void;
}) {
  return (
    <ol className="contest-rounds">
      {Array.from({ length: CONTEST_ATTEMPTS }, (_, index) => {
        const attempt = attempts[index];
        const current = index === currentIndex;
        const state = attempt
          ? attempt.qualified
            ? '达标'
            : attempt.lots.length
              ? '未达标'
              : '未成丹'
          : current
            ? firing
              ? '炼制中'
              : '待开炉'
            : '未开炉';
        const label = (
          <>
            第 <span className="font-mono">{index + 1}</span> 炉
          </>
        );
        return (
          <li key={index}>
            {attempt ? (
              <button
                type="button"
                className="contest-round"
                aria-haspopup="dialog"
                disabled={busy}
                aria-label={`查看第 ${index + 1} 炉，${state}`}
                data-kind={attempt.qualified ? 'passed' : 'failed'}
                onClick={() => showReceipt(index)}
              >
                <span>{label}</span>
                <span className="contest-round-state">
                  {state}
                  <span aria-hidden="true"> ›</span>
                </span>
              </button>
            ) : (
              <div
                className="contest-round"
                aria-current={current ? 'step' : undefined}
              >
                <span>{label}</span>
                <span className="contest-round-state">{state}</span>
              </div>
            )}
          </li>
        );
      })}
    </ol>
  );
}
