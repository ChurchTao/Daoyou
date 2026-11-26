import type { ContestAttempt } from '@daoyou/game-domain/alchemy/contest';
import {
  getAlchemyPropertyLabel,
  getPillAppearanceLabel,
} from '@daoyou/game-rules/alchemy';
import {
  contestVerdicts,
  formatStrength,
  heatNames,
  type ContestSession,
} from './presentation';

const scoreLabels = {
  effect: '药效',
  quality: '品质',
  quantity: '产量',
  appearance: '品相',
  time: '用时',
} as const;

export function ContestReceipt({
  attempt,
  session,
}: {
  attempt: ContestAttempt;
  session: ContestSession;
}) {
  const { question } = session;
  const [main, ...otherEffects] = attempt.effects;
  const secondary = otherEffects.some(
    ({ key, value }) => key === question.secondary && value > 0,
  );
  const madePills = attempt.lots.length > 0;
  const count = attempt.lots.reduce((sum, lot) => sum + lot.quantity, 0);
  const qualified = attempt.qualifiedLots.reduce(
    (sum, lot) => sum + lot.quantity,
    0,
  );
  const criteria = [
    {
      name: '主药效',
      target: `${getAlchemyPropertyLabel(question.primary)} ≥ ${formatStrength(question.primary, question.minimumStrength)}`,
      actual: main
        ? `${getAlchemyPropertyLabel(main.key)} ${formatStrength(main.key, main.value)}`
        : '—',
      passed:
        main?.key === question.primary &&
        main.value >= question.minimumStrength,
    },
    ...(question.secondary
      ? [
          {
            name: '辅药效',
            target: getAlchemyPropertyLabel(question.secondary),
            actual: secondary
              ? getAlchemyPropertyLabel(question.secondary)
              : '未形成',
            passed: secondary,
          },
        ]
      : []),
    {
      name: '丹毒',
      target: `≤ ${question.maximumToxicity}`,
      actual: String(attempt.toxicity),
      passed: attempt.toxicity <= question.maximumToxicity,
    },
  ];
  return (
    <div className="contest-receipt">
      <div className="contest-receipt-lede">
        <div>
          <p className={attempt.qualified ? 'text-teal' : 'text-crimson'}>
            {attempt.qualified ? '达标' : '本炉不计分'}
          </p>
          <h3>
            {attempt.qualified
              ? question.pillName
              : contestVerdicts[attempt.reason ?? 'empty'][0]}
          </h3>
          {attempt.reason && (
            <p className="text-ink-secondary">
              {contestVerdicts[attempt.reason][1]}
            </p>
          )}
        </div>
        {attempt.qualified && (
          <p className="contest-receipt-score">
            <b className="font-mono">{attempt.score}</b> 分
          </p>
        )}
      </div>
      {madePills && (
        <table className="contest-criteria-table">
          <thead>
            <tr>
              <th scope="col">验丹项</th>
              <th scope="col">本期要求</th>
              <th scope="col">本炉结果</th>
            </tr>
          </thead>
          <tbody>
            {criteria.map(({ name, target, actual, passed }) => (
              <tr key={name}>
                <th scope="row">{name}</th>
                <td>{target}</td>
                <td>
                  {actual}
                  <small className={passed ? 'text-teal' : 'text-crimson'}>
                    {passed ? '达标' : '未达标'}
                  </small>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
      <dl className="contest-facts">
        {madePills && (
          <>
            <div>
              <dt>出丹</dt>
              <dd>
                {attempt.lots.map(({ quality, quantity }, index) => (
                  <span key={quality}>
                    {index > 0 && '、'}
                    {quality} <span className="font-mono">×{quantity}</span>
                  </span>
                ))}
                {qualified > 0 && qualified < count && (
                  <span className="text-ink-secondary">
                    （<span className="font-mono">{qualified}</span> 枚达标）
                  </span>
                )}
              </dd>
            </div>
            <div>
              <dt>品相</dt>
              <dd>{getPillAppearanceLabel(attempt.appearance)}</dd>
            </div>
          </>
        )}
        <div>
          <dt>投料</dt>
          <dd>
            {attempt.doses.map(({ materialId, dose }, index) => (
              <span key={materialId}>
                {index > 0 && '、'}
                {
                  session.materials.find(({ id }) => id === materialId)?.name
                }{' '}
                <span className="font-mono">×{dose}</span>
              </span>
            ))}
          </dd>
        </div>
        <div>
          <dt>火候</dt>
          <dd>
            {heatNames[attempt.heat]} ·{' '}
            <span className="font-mono">
              {attempt.stability} 稳度 / {Math.round(attempt.purity * 100)}%
              纯度
            </span>
          </dd>
        </div>
      </dl>
      {attempt.qualified && (
        <dl className="contest-score-parts" aria-label="分项得分">
          {(Object.keys(scoreLabels) as (keyof typeof scoreLabels)[]).map(
            (key) => (
              <div key={key}>
                <dt>{scoreLabels[key]}</dt>
                <dd className="font-mono">{attempt.points[key]}</dd>
              </div>
            ),
          )}
        </dl>
      )}
    </div>
  );
}
