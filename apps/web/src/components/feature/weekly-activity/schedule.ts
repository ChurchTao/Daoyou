export type ActivityPhase =
  'waiting' | 'open' | 'closing' | 'closed' | 'settled' | 'unavailable';

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
  lastStartAt: string | number,
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
        note: `北京时间 ${time(lastStartAt)} 截止入场`,
      };
    case 'closing':
      return {
        title: '入场已截止',
        note: `本期北京时间 ${time(closesAt)} 结束`,
      };
    case 'closed':
      return { title: '正在封榜', note: '本期名次将在封榜后公布。' };
    case 'settled':
      return { title: '本期已封榜', note: '可以查看本期榜单。' };
    case 'unavailable':
      return { title: '本期仍在筹备', note: '准备完成后即可入场。' };
  }
}
