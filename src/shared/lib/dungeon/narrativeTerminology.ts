export function normalizeDungeonResourceTerminology(text: string): string {
  return text
    .replace(/补充灵力|恢复灵力/gu, '恢复法力')
    .replace(/回补灵力/gu, '回补法力')
    .replace(/补足灵力/gu, '补足法力')
    .replace(
      /灵力(?=(?:已经|已然|已近|已|近乎|几近|即将|逐渐)?(?:不足|匮乏|枯竭|耗尽|见底|亏空|透支|不济|消耗|损耗))/gu,
      '法力',
    )
    .replace(/((?:消耗|耗费|损耗|抽取)(?:了|自身|体内)?)灵力/gu, '$1法力');
}
