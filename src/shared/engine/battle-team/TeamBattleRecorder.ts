import type {
  TeamBattleLogEvent,
  TeamBattleLogEventInput,
  TeamBattleFrame,
  TeamUnitSnapshot,
  TeamBattleRecord,
  TeamBattleParticipants,
  TeamBattleOutcome,
} from './types';
import type { TeamUnit } from './TeamUnit';

/**
 * 战斗时间线记录器。
 *
 * 每条 logEvent 后可 captureFrame，frame.seq 关联到该事件。
 * 前端用 seq 在 frames 中查找当前显示帧。
 */
export class TeamBattleRecorder {
  private _events: TeamBattleLogEvent[] = [];
  private _frames: TeamBattleFrame[] = [];
  private _seqCounter = 0;

  constructor(private _getSnapshots: () => Record<string, TeamUnitSnapshot>) {}

  nextSeq(): number {
    return ++this._seqCounter;
  }

  log(e: TeamBattleLogEventInput): void {
    const event = { ...e, seq: this.nextSeq() } as TeamBattleLogEvent;
    this._events.push(event);
  }

  captureFrame(round: number): void {
    const units = this._getSnapshots();
    this._frames.push({
      seq: this._seqCounter,
      round,
      units,
    });
  }

  initialFrame(units: TeamUnit[]): void {
    const snapshots: Record<string, TeamUnitSnapshot> = {};
    for (const u of units) snapshots[u.id] = u.snapshot();
    this._frames.push({
      seq: -1,
      round: 0,
      units: snapshots,
    });
  }

  build(
    participants: TeamBattleParticipants,
    outcome: TeamBattleOutcome,
  ): TeamBattleRecord {
    const unitIds: string[] = [];
    const unitNames: Record<string, string> = {};
    for (const p of [...participants.teamA, ...participants.teamB]) {
      unitIds.push(p.id);
      unitNames[p.id] = p.name;
    }

    return {
      participants,
      outcome,
      events: [...this._events],
      stateTimeline: {
        frames: [...this._frames],
        unitIds,
        unitNames,
      },
      finalSnapshots: this._getSnapshots(),
    };
  }

  get events(): readonly TeamBattleLogEvent[] {
    return this._events;
  }
}
