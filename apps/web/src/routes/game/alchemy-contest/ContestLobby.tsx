import { activityState } from '@app/components/feature/weekly-activity/schedule';
import { WeeklyActivityLobby } from '@app/components/feature/weekly-activity/WeeklyActivity';
import { InkButton } from '@app/components/ui/InkButton';
import type { ContestStatus } from '@daoyou/contracts/alchemy/contest';
import { CONTEST_REWARD_GRADES } from '@daoyou/game-rules/alchemy/contest';

export function ContestRewards() {
  return (
    <section className="contest-rewards">
      <h3>完赛奖励</h3>
      <p>
        炼出达标丹药后，按总分结算修为、灵石和道具，A、S
        档另有感悟。每位达标者额外获得一件地品至神品草药，境界越高，草药品阶越有优势。
      </p>
      <table className="contest-rewards-table">
        <thead>
          <tr>
            <th>档位</th>
            <th>最低总分</th>
          </tr>
        </thead>
        <tbody>
          {CONTEST_REWARD_GRADES.map(({ grade, minimumScore }) => (
            <tr key={grade}>
              <th scope="row">{grade}</th>
              <td className="font-mono">{minimumScore}</td>
            </tr>
          ))}
        </tbody>
      </table>
      <p>封榜后，前 100 名还可领取排名声望。</p>
    </section>
  );
}

export function ContestLobby({
  status,
  now,
  unlocked,
  pending,
  rankHref,
  start,
}: {
  status: ContestStatus;
  now: number;
  unlocked: boolean | null;
  pending: boolean;
  rankHref: string;
  start: () => void;
}) {
  const phase =
    status.phase === 'open' && now > Date.parse(status.lastStartAt)
      ? 'closing'
      : status.phase;
  const canStart = phase === 'open' && unlocked && !status.otherCharacter;
  const state = activityState(
    phase,
    status.opensAt,
    status.lastStartAt,
    status.closesAt,
  );
  const note = status.otherCharacter
    ? '本账号已用另一位角色参赛。'
    : phase === 'open' && !unlocked
      ? unlocked === null
        ? '正在确认参赛资格。'
        : '完成主线炼丹指引后即可参赛。'
      : state.note;
  return (
    <WeeklyActivityLobby
      art="/assets/maps/luanxinghai-region-v1.webp"
      place="乱星海 · 丹塔"
      title={state.title}
      note={note}
      schedule="每周三 14:00–16:00 · 北京时间"
      facts={['个人赛时 15 分钟', '最多 3 炉', '材料与炉气免费']}
      admission={canStart && '入场即开始计时，并锁定本期参赛角色。'}
      action={
        canStart && (
          <InkButton
            variant="primary"
            pending={pending}
            pendingLabel="正在入场…"
            onClick={start}
          >
            入场参赛
          </InkButton>
        )
      }
      rankHref={rankHref}
      rankName="炼丹榜"
    />
  );
}
