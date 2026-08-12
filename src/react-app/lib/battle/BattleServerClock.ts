type ClockSample = {
  readonly offsetMs: number;
  readonly rttMs: number;
};

const MAX_SAMPLES = 8;
const MAX_ACCEPTED_RTT_MS = 5_000;

/** Estimates server wall time without allowing the client to own game phases. */
export class BattleServerClock {
  private samples: ClockSample[] = [];
  private offsetMs = 0;
  private sampled = false;

  addRoundTripSample(
    clientSentAt: number,
    clientReceivedAt: number,
    serverNow: number,
  ): void {
    const rttMs = clientReceivedAt - clientSentAt;
    if (!Number.isFinite(rttMs) || rttMs < 0 || rttMs > MAX_ACCEPTED_RTT_MS) {
      return;
    }
    const midpoint = (clientSentAt + clientReceivedAt) / 2;
    this.samples.push({ offsetMs: serverNow - midpoint, rttMs });
    this.samples = this.samples
      .sort((left, right) => left.rttMs - right.rttMs)
      .slice(0, MAX_SAMPLES);
    const preferred = this.samples.slice(0, Math.max(1, Math.ceil(this.samples.length / 2)));
    this.offsetMs =
      preferred.reduce((sum, sample) => sum + sample.offsetMs, 0) /
      preferred.length;
    this.sampled = true;
  }

  addOneWayHint(serverNow: number, receivedAt = Date.now()): void {
    if (this.sampled || !Number.isFinite(serverNow)) return;
    this.offsetMs = serverNow - receivedAt;
  }

  now(localNow = Date.now()): number {
    return localNow + this.offsetMs;
  }

  uncertaintyMs(): number {
    return this.samples[0]?.rttMs ? this.samples[0].rttMs / 2 : Number.POSITIVE_INFINITY;
  }
}
