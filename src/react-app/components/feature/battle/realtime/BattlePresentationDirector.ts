import type { RealtimeBattlePhaserController } from './RealtimeBattlePhaserRuntime';
import {
  applyCombatVisualFactToSnapshot,
  type BattlePresentationSnapshotV1,
  type BattlePresentationWindowV1,
} from '@shared/online-battle/BattlePresentation';

export interface BattlePresentationDirectorInput {
  readonly window: BattlePresentationWindowV1;
  readonly startingSnapshot: BattlePresentationSnapshotV1;
  readonly finalSnapshot: BattlePresentationSnapshotV1;
  readonly serverNow: number;
  readonly onBeatStart?: (beat: BattlePresentationWindowV1['plan']['beats'][number]) => void;
  readonly onFactResolved?: (fact: Parameters<typeof applyCombatVisualFactToSnapshot>[1]) => void;
  readonly onComplete?: () => void;
}

/** Owns wall-clock playback; Phaser remains a disposable renderer. */
export class BattlePresentationDirector {
  private timers: number[] = [];
  private generation = 0;

  constructor(private readonly controller: RealtimeBattlePhaserController) {}

  play(input: BattlePresentationDirectorInput): void {
    this.cancel();
    const generation = this.generation;
    const elapsed = Math.max(0, input.serverNow - input.window.startedAt);
    let displayed = input.startingSnapshot;
    const resolveCommands = input.window.plan.beats.flatMap((beat) =>
      beat.timeline.commands
        .filter((command) => command.kind === 'resolve')
        .map((command) => ({ at: beat.startAt + command.at, fact: command.fact })),
    ).sort((left, right) => left.at - right.at);

    for (const command of resolveCommands) {
      if (command.at > elapsed) continue;
      displayed = applyCombatVisualFactToSnapshot(displayed, command.fact, command.at);
    }
    this.controller.syncSnapshot({
      ...displayed,
      elapsedMs: Math.min(elapsed, input.window.plan.durationMs),
      phase: '回合演算',
    });

    for (const beat of input.window.plan.beats) {
      if (beat.startAt + beat.duration <= elapsed) continue;
      const delay = Math.max(0, beat.startAt - elapsed);
      const offset = Math.max(0, elapsed - beat.startAt);
      this.schedule(delay, generation, () => {
        input.onBeatStart?.(beat);
        this.controller.playTimeline(beat.timeline, offset);
      });
    }

    for (const command of resolveCommands) {
      if (command.at <= elapsed) continue;
      this.schedule(command.at - elapsed, generation, () => {
        input.onFactResolved?.(command.fact);
        displayed = applyCombatVisualFactToSnapshot(displayed, command.fact, command.at);
        this.controller.syncSnapshot({ ...displayed, phase: '回合演算' });
      });
    }

    this.schedule(Math.max(0, input.window.plan.durationMs - elapsed), generation, () => {
      this.controller.syncSnapshot(input.finalSnapshot);
      input.onComplete?.();
    });
  }

  cancel(): void {
    this.generation += 1;
    for (const timer of this.timers) window.clearTimeout(timer);
    this.timers = [];
  }

  destroy(): void {
    this.cancel();
  }

  private schedule(delay: number, generation: number, run: () => void): void {
    const timer = window.setTimeout(() => {
      if (generation !== this.generation) return;
      run();
    }, delay);
    this.timers.push(timer);
  }
}
