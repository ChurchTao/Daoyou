import { activityState } from '@app/components/feature/weekly-activity/schedule';
import { WeeklyActivityLobby } from '@app/components/feature/weekly-activity/WeeklyActivity';
import { InkButton } from '@app/components/ui/InkButton';
import type { ContestStatus } from '@daoyou/contracts/alchemy/contest';
import { contestRewardForRank } from '@daoyou/game-rules/alchemy/contest';

const rankBands = [
  [1, '第 1 名'],
  [2, '第 2 名'],
  [3, '第 3 名'],
  [4, '第 4 至 10 名'],
  [11, '第 11 至 50 名'],
  [51, '第 51 名及以后'],
] as const;
const percent = (value: number) => `${Number((value * 100).toFixed(2))}%`;

export function ContestRewards() {
  return (
    <section className="contest-rewards">
      <h3>上榜奖励</h3>
      <p>
        封榜后，丹塔会把声望和抽中的奖品寄到邮箱。每位上榜道友抽一次，最多得一件奖品。
      </p>
      <table className="contest-rewards-table">
        <thead>
          <tr>
            <th>名次</th>
            <th>声望</th>
            <th>上品传承灵印</th>
            <th>上品归元灵露</th>
            <th>高品材料</th>
          </tr>
        </thead>
        <tbody>
          {rankBands.map(([rank, label]) => {
            const { reputation, odds } = contestRewardForRank(rank);
            return (
              <tr key={rank}>
                <th scope="row">{label}</th>
                <td>{reputation}</td>
                <td>{percent(odds.book)}</td>
                <td>{percent(odds.dew)}</td>
                <td>{percent(odds.material)}</td>
              </tr>
            );
          })}
        </tbody>
      </table>
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
