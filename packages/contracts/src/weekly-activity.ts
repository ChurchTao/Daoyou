export type WeeklyRankingPeriod = {
  week: string;
  closesAt: number;
  state: 'live' | 'closing' | 'settled' | 'unavailable';
};
