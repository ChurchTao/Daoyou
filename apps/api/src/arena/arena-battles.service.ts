import { Injectable } from '@nestjs/common';
import type { ActiveCultivatorRef } from '@server/lib/auth/types.js';
import {
  arenaReplayV6,
  ownedArenaV6,
  submitArenaV6,
  watchedArenaV6,
} from '@server/combat/application/CombatV6ArenaService.js';
import { arenaView } from '@daoyou/shared/combat-v6/arena';
import type { ArenaV6Submit } from '@daoyou/shared/contracts/combatV6Arena';

@Injectable()
export class ArenaBattlesService {
  async authorizeSocket(
    actor: ActiveCultivatorRef,
    id: string,
    spectator: boolean,
  ) {
    await (spectator ? watchedArenaV6 : ownedArenaV6)(id, actor);
  }

  async read(
    actor: ActiveCultivatorRef,
    id: string,
    spectator: boolean,
    cursor?: number,
  ) {
    const { runtime, participant } = await (
      spectator ? watchedArenaV6 : ownedArenaV6
    )(id, actor);
    const last = runtime.lastResults[participant.unitId];
    const incremental =
      last?.revision === runtime.revision &&
      last.playback?.fromEventSeq === cursor;
    const view = incremental
      ? {
          ...last,
          serverNow: Date.now(),
          events: last.events.filter((e) => e.seq > cursor!),
        }
      : arenaView(runtime, participant.unitId, Date.now());
    const unchanged = cursor === view.latestEventSeq;
    return {
      success: true,
      data: {
        session: unchanged
          ? { ...view, events: [], playback: undefined }
          : view,
        full: !incremental && !unchanged,
      },
    };
  }
  async submit(actor: ActiveCultivatorRef, id: string, input: ArenaV6Submit) {
    return { success: true, data: await submitArenaV6(id, actor, input) };
  }
  async replay(actor: ActiveCultivatorRef, id: string) {
    return { success: true, data: await arenaReplayV6(id, actor) };
  }
}
