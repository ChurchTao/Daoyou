import { CommandType, EventType, UnitKind } from '@daoyou/combat-core/enums';
import type { StoryBattleSnapshot } from '@daoyou/game-domain/combat/challenges';
import {
  MINE_SPARRING_MOVES as moves,
  mineSparringFlag,
  type MineSparringEffect,
} from '@daoyou/game-content/story/battles';

/** 留下演出会用到的实际命中、相生和跟击。只在本场结算时读取战斗记录。 */
export function mineSparringEffects(snapshot: StoryBattleSnapshot): string[] {
  const { playerId, events } = snapshot;
  const enemies = new Set(
    snapshot.input.units.filter((unit) => unit.side === 1).map((unit) => unit.id),
  );
  const pets = new Set(
    snapshot.input.units
      .filter((unit) => unit.kind === UnitKind.Pet && unit.ownerId === playerId)
      .map((unit) => unit.id),
  );
  const effects = new Set<MineSparringEffect>();
  const hits = new Map<string, number>();
  let skill: string | undefined;
  let actor: string | undefined;
  let woodMark = false;
  let fireWithWood = false;
  let pouncedTarget: string | undefined;

  for (const event of events) {
    if (event.type === EventType.RoundStart) pouncedTarget = undefined;
    if (event.type === EventType.ActionStart) {
      actor = event.unitId;
      skill = actor === playerId && event.command.type === CommandType.Skill
        ? event.command.skillId
        : undefined;
      fireWithWood = skill === moves.fire && woodMark;
      hits.clear();
    }
    if (event.type === EventType.StatusApplied) {
      if (event.unitId === playerId) {
        if (event.statusId === 'tianyan.status.mark.wood') woodMark = true;
        if (skill === moves.guard && event.statusId === 'jiujie.status.guardian')
          effects.add('guard');
      }
      if (enemies.has(event.unitId)) {
        if (skill === moves.wood && event.statusId === 'tianyan.status.bind')
          effects.add('wood');
        if (
          skill === moves.siphon &&
          (event.statusId === 'youdu.status.siphon' ||
            event.statusId === 'youdu.status.siphon_strong')
        )
          effects.add('siphon');
      }
    }
    if (
      event.type === EventType.StatusRemoved &&
      event.unitId === playerId &&
      event.statusId === 'tianyan.status.mark.wood'
    )
      woodMark = false;
    if (
      event.type === EventType.Heal &&
      skill === moves.fuyuan &&
      event.sourceId === playerId &&
      event.targetId === playerId &&
      event.amount > 0
    )
      effects.add('fuyuan');
    if (
      event.type !== EventType.Damage ||
      event.sourceId !== actor ||
      !enemies.has(event.targetId) ||
      event.amount <= 0
    )
      continue;

    const count = (hits.get(event.targetId) ?? 0) + 1;
    hits.set(event.targetId, count);
    switch (skill) {
      case moves.triple:
        if (count === 3) effects.add('triple');
        break;
      case moves.pierce:
        effects.add('pierce');
        break;
      case moves.fire:
        effects.add('fire');
        if (fireWithWood) effects.add('wood-fire');
        if (hits.size >= 2) effects.add('fire-both');
        break;
      case moves.thunder:
        effects.add('thunder');
        if (hits.size >= 2) effects.add('thunder-both');
        break;
      case moves.poxie:
        effects.add('poxie');
        if (hits.size >= 2) effects.add('poxie-both');
        break;
      case moves.rift:
        effects.add('rift');
        if (count > 1) effects.add('rift-echo');
        break;
      case moves.pounce:
        effects.add('pounce');
        pouncedTarget = event.targetId;
        break;
      default:
        if (pets.has(actor) && pouncedTarget === event.targetId)
          effects.add('beast-followup');
        break;
    }
  }
  return [...effects].map(mineSparringFlag);
}
