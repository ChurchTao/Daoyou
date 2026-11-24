import type {
  CombatV6CommandGroup,
  CombatV6SessionSnapshot,
  CombatV6TrainingPlayerInput,
} from '@daoyou/game-domain/combat';
import type { ExorcismBattleSnapshot } from '@daoyou/game-domain/dungeon/exorcism';
import { publicUnitAppearances } from '@daoyou/game-rules/combat/appearance';
import { automaticCommands } from '@daoyou/game-rules/combat/auto';
import { liveReplayDelta } from '@daoyou/game-rules/combat/playback';
import {
  combatV6Display,
  combatV6DisplayEvent,
  combatV6Units,
  visibleUnitNames,
} from '@daoyou/game-rules/combat/presentation';
import {
  createExorcismHost,
  ExorcismHost,
} from '@daoyou/game-rules/dungeon/exorcism';
import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import type { ActiveCultivatorRef } from '@server/lib/auth/types.js';
import { redis } from '@server/lib/redis/index.js';
import { randomInt, randomUUID } from 'node:crypto';

type Seat = { actor: ActiveCultivatorRef; week: string; position: number };
type Action =
  | { kind: 'command'; unitId: string; commands: CombatV6CommandGroup }
  | { kind: 'resolve' }
  | { kind: 'auto'; round: number };

interface Duel {
  id: string;
  seat: Seat;
  endsAt: number;
  revision: number;
  snapshot: ExorcismBattleSnapshot;
  outcome?: CombatV6SessionSnapshot['outcome'];
  completedAt?: number;
}

const key = (id: string) => `baixiao:duel:${id}`;
const retainMs = 60 * 60_000;
const compareAndSave = `
local existing = redis.call('GET', KEYS[1])
if not existing or cjson.decode(existing).revision ~= tonumber(ARGV[1]) then return 0 end
redis.call('SET', KEYS[1], ARGV[2], 'KEEPTTL')
return 1
`;

function view(duel: Duel, host: ExorcismHost, after = -1) {
  const { snapshot } = duel;
  const outcome =
    duel.outcome ?? (Date.now() >= duel.endsAt ? 'aborted' : undefined);
  const names = visibleUnitNames(host.state, snapshot.events, host.playerId);
  return {
    apiVersion: 1 as const,
    sessionId: duel.id,
    controlledUnitId: host.playerId,
    revision: duel.revision,
    expiresAt: new Date(duel.endsAt).toISOString(),
    combatVersions: host.state.versions,
    round: host.state.round,
    phase: host.state.phase,
    outcome,
    settlement: duel.outcome ? 'settled' : undefined,
    units: combatV6Units(host.state, snapshot.input.statusDefs ?? []),
    commandOptions: outcome ? undefined : host.queryCommands(),
    controlledCommandOptions: outcome
      ? undefined
      : host.controlledCommandOptions(),
    pendingCommand: host.state.units.find((unit) => unit.id === host.playerId)
      ?.command as CombatV6SessionSnapshot['pendingCommand'],
    display: {
      ...combatV6Display(
        snapshot.input.skills ?? [],
        snapshot.input.statusDefs ?? [],
      ),
      unitNames: names,
      unitAppearances: publicUnitAppearances(
        snapshot.timeline.unitAppearances,
        names,
      ),
    },
    events: snapshot.events.flatMap((event, seq) =>
      seq > after ? [{ seq, event: combatV6DisplayEvent(event) }] : [],
    ),
    latestEventSeq: snapshot.events.length - 1,
    playback: liveReplayDelta(snapshot.timeline, after),
  } satisfies CombatV6SessionSnapshot & { apiVersion: 1 };
}

@Injectable()
export class BaixiaoDuelService {
  async create(
    player: CombatV6TrainingPlayerInput,
    endsAt: number,
    seat: Seat,
  ) {
    const host = createExorcismHost(
      player,
      { realm: player.cultivator.realm, tier: 'normal' },
      { wins: 3, bossId: 'tide_serpent', lineageId: 'water' },
      randomInt(0, 0x7fffffff),
      { name: '百晓考官', appearance: { icon: 'icon:portrait-elder-m' } },
    );
    const remaining = endsAt - Date.now();
    if (remaining <= 0) throw new ConflictException('本场作答时间已尽。');
    const duel: Duel = {
      id: randomUUID(),
      seat,
      endsAt,
      revision: 0,
      snapshot: host.runtimeSnapshot(),
    };
    await redis.set(
      key(duel.id),
      JSON.stringify(duel),
      'PX',
      remaining + retainMs,
    );
    return duel.id;
  }

  private async require(actor: ActiveCultivatorRef, id: string) {
    const raw = await redis.get(key(id));
    const duel = raw ? (JSON.parse(raw) as Duel) : null;
    if (
      duel?.seat?.actor.userId !== actor.userId ||
      duel.seat.actor.cultivatorId !== actor.cultivatorId
    )
      throw new NotFoundException('这场挑战已无法继续。');
    return duel;
  }

  async result(actor: ActiveCultivatorRef, id: string) {
    const duel = await this.require(actor, id);
    return duel.completedAt === undefined
      ? null
      : {
          victory: duel.outcome === 'victory',
          completedAt: duel.completedAt,
        };
  }

  async read(actor: ActiveCultivatorRef, id: string, after = -1) {
    const duel = await this.require(actor, id);
    const host = new ExorcismHost(duel.snapshot, duel.snapshot);
    return view(duel, host, after);
  }

  async change(
    actor: ActiveCultivatorRef,
    id: string,
    revision: number,
    action: Action,
  ) {
    const duel = await this.require(actor, id);
    const host = new ExorcismHost(duel.snapshot, duel.snapshot);
    if (duel.outcome) return { battle: view(duel, host), seat: duel.seat };
    if (Date.now() >= duel.endsAt) return { battle: view(duel, host) };
    if (revision !== duel.revision)
      throw new ConflictException('战局已更新，请重试。');
    const after = duel.snapshot.events.length - 1;
    try {
      switch (action.kind) {
        case 'command':
          if (action.unitId !== host.playerId)
            throw new Error('无权提交此人物指令。');
          host.submitGroup(action.commands);
          break;
        case 'auto': {
          if (action.round !== host.state.round)
            throw new Error('战斗回合已更新。');
          const trace = host.trace();
          const commands = automaticCommands(
            host.state,
            host.playerId,
            trace.skills,
            (id) =>
              host
                .controlledCommandOptions()
                .find((option) => option.unitId === id)!,
            {
              statusDefs: trace.statusDefs,
              strategies: { [host.playerId]: host.playerAutoStrategy },
            },
          );
          if (commands.length) host.submitGroup(commands);
          host.resolveRound();
          break;
        }
        case 'resolve':
          host.resolveRound();
          break;
      }
    } catch (cause) {
      throw new BadRequestException(
        cause instanceof Error ? cause.message : '战斗指令无效。',
      );
    }
    duel.outcome = host.trace().outcome;
    if (duel.outcome) duel.completedAt = Date.now();
    duel.snapshot = host.runtimeSnapshot();
    duel.revision++;
    if (
      (await redis.eval(
        compareAndSave,
        1,
        key(id),
        revision,
        JSON.stringify(duel),
      )) !== 1
    )
      throw new ConflictException('战局已更新，请重试。');
    return {
      battle: view(duel, host, after),
      seat: duel.outcome ? duel.seat : undefined,
    };
  }
}
