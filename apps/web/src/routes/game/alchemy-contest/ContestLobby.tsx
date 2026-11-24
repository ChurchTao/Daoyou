import { GameImage } from '@app/components/ui/GameImage';
import { InkButton } from '@app/components/ui/InkButton';
import type { ContestStatus } from '@daoyou/contracts/alchemy/contest';
import { contestRewardForRank } from '@daoyou/game-rules/alchemy/contest';
import { beijingDate, beijingTime } from './presentation';

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
  const lastStart = new Date(status.lastStartAt);
  const opensAt = new Date(status.opensAt);
  const phase =
    status.phase === 'open' && now > +lastStart ? 'closing' : status.phase;
  const canStart = phase === 'open' && unlocked && !status.otherCharacter;
  const phaseLabel = {
    waiting: '本期尚未开赛',
    open: '本期已开赛',
    closing: '入场已截止',
    closed: '正在结算排名',
    settled: '本期已封榜',
    unavailable: '本期仍在筹备',
  }[phase];
  const message = status.otherCharacter
    ? '本账号已用另一位角色参赛。'
    : {
        waiting: `${beijingDate.format(opensAt)} ${beijingTime.format(opensAt)} 开赛`,
        open:
          unlocked === null
            ? '正在确认参赛资格。'
            : unlocked
              ? `${beijingTime.format(lastStart)} 截止入场。入场后开始计时，并锁定本期参赛角色。`
              : '完成主线炼丹指引后即可参赛。',
        closing: null,
        closed: null,
        settled: null,
        unavailable: '请稍后再来。',
      }[phase];
  return (
    <div className="contest-lobby">
      <div className="contest-lobby-scene">
        <GameImage
          src="/assets/maps/luanxinghai-region-v1.webp"
          alt=""
          className="contest-lobby-image"
        />
        <div className="contest-lobby-content">
          <p className="contest-lobby-location">乱星海 · 丹塔</p>
          <h2>{phaseLabel}</h2>
          {message && <p className="contest-lobby-message">{message}</p>}
          {(phase === 'waiting' || canStart) && (
            <div className="contest-lobby-terms">
              <div>
                <b>
                  <span className="font-mono">15</span> 分钟
                </b>
                <span>个人赛时</span>
              </div>
              <div>
                <b>
                  <span className="font-mono">3</span> 炉
                </b>
                <span>炼制上限</span>
              </div>
              <div>
                <b>免费</b>
                <span>材料与炉气</span>
              </div>
            </div>
          )}
          {canStart ? (
            <InkButton
              variant="primary"
              className="contest-main-action"
              pending={pending}
              pendingLabel="正在入场…"
              onClick={start}
            >
              入场参赛
            </InkButton>
          ) : (
            <InkButton
              variant="primary"
              className="contest-main-action"
              href={rankHref}
            >
              查看炼丹榜
            </InkButton>
          )}
          <p className="contest-lobby-schedule">
            每周三 <span className="font-mono">14:00 至 16:00</span> · 北京时间
          </p>
        </div>
      </div>
    </div>
  );
}
