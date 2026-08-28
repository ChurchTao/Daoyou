import type { History } from './types';

const CHOICE_MARKER = ' -> Choice: ';
const COSTS_MARKER = ' -> Costs: ';

export interface DungeonHistoryLogEntry {
  round: number;
  scene: string;
  choice: string | null;
  actualCosts: string[];
}

export function serializeDungeonHistoryLog(history: History[]): string {
  return history
    .map((entry) => {
      const choice = entry.choice ? `${CHOICE_MARKER}${entry.choice}` : '';
      const costs = entry.actual_costs?.length
        ? `${COSTS_MARKER}${entry.actual_costs.join('、')}`
        : '';
      return `[Round ${entry.round}] ${entry.scene}${choice}${costs}`;
    })
    .join('\n');
}

export function parseDungeonHistoryLog(log: string): DungeonHistoryLogEntry[] {
  if (!log) return [];

  const entries: DungeonHistoryLogEntry[] = [];
  for (const line of log.split('\n').filter((value) => value.trim())) {
    const header = line.match(/^\[Round (\d+)\] (.*)$/u);
    if (!header) continue;

    let body = header[2] ?? '';
    let actualCosts: string[] = [];
    const costsIndex = body.lastIndexOf(COSTS_MARKER);
    if (costsIndex >= 0) {
      actualCosts = body
        .slice(costsIndex + COSTS_MARKER.length)
        .split('、')
        .map((cost) => cost.trim())
        .filter(Boolean);
      body = body.slice(0, costsIndex);
    }

    let choice: string | null = null;
    const choiceIndex = body.lastIndexOf(CHOICE_MARKER);
    if (choiceIndex >= 0) {
      choice = body.slice(choiceIndex + CHOICE_MARKER.length).trim() || null;
      body = body.slice(0, choiceIndex);
    }

    entries.push({
      round: Number(header[1]),
      scene: body.trim(),
      choice,
      actualCosts,
    });
  }
  return entries;
}
