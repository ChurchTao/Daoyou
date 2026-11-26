export type ActivityPhase =
  'waiting' | 'open' | 'closed' | 'settled' | 'unavailable';

const dateLabel = new Intl.DateTimeFormat('zh-CN', {
  timeZone: 'Asia/Shanghai',
  month: 'long',
  day: 'numeric',
  weekday: 'short',
});
const clockLabel = new Intl.DateTimeFormat('zh-CN', {
  timeZone: 'Asia/Shanghai',
  hour: '2-digit',
  minute: '2-digit',
  hourCycle: 'h23',
});

export function activityDate(date: string | number) {
  return dateLabel.format(new Date(date));
}

export function activityState(
  phase: ActivityPhase,
  opensAt: string | number,
  closesAt: string | number,
) {
  const time = (date: string | number) => clockLabel.format(new Date(date));
  switch (phase) {
    case 'waiting':
      return {
        title: '本期尚未开场',
        note: `${activityDate(opensAt)} ${time(opensAt)} 开场`,
      };
    case 'open':
      return {
        title: '开放入场',
        note: `${activityDate(closesAt)} ${time(closesAt)} 截止入场`,
      };
    case 'closed':
      return { title: '正在封榜', note: '上期收尾中，新一期换期后可入场。' };
    case 'settled':
      return { title: '本期已封榜', note: '可以查看本期榜单。' };
    case 'unavailable':
      return { title: '本期仍在筹备', note: '准备完成后即可入场。' };
  }
}

export function weeklyBoardStatus(
  state: 'live' | 'closing' | 'settled' | 'unavailable',
  closesAt: number,
) {
  switch (state) {
    case 'live':
      return {
        label: '实时排名',
        note: `${activityDate(closesAt)} 00:00 换期，声望在封榜后发放。`,
      } as const;
    case 'closing':
      return {
        label: '结算中',
        note: '正在处理本期剩余场次，名次仍可能变化。',
      } as const;
    case 'settled':
      return { label: '已封榜', note: '排名声望可通过传音领取。' } as const;
    case 'unavailable':
      return { label: '暂无赛况', note: '本期暂无可查看的成绩。' } as const;
  }
}
