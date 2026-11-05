import { describe, expect, it } from 'vitest';
import { STANDARD_SECT_PRESENTATION } from '../core/index.js';
import { PRODUCTION_SECT_PRESENTATIONS } from './productionRuntime.js';

const facilityActorKeys = [
  ['hall', 'registry'],
  ['hall', 'stipend'],
  ['treasury', 'keeper'],
  ['industries', 'construction'],
  ['industries', 'donation'],
  ['archive', 'keeper'],
  ['paths', 'guide'],
  ['arena', 'instructor'],
  ['arena', 'marshal'],
  ['cultivation', 'keeper'],
  ['alchemy', 'keeper'],
  ['refinery', 'keeper'],
  ['spiritVein', 'keeper'],
  ['herbGarden', 'keeper'],
  ['gate', 'keeper'],
  ['spiritVein', 'facility'],
  ['herbGarden', 'facility'],
  ['gate', 'facility'],
] as const;

describe('production sect affairs presentations', () => {
  it('keeps the tournament entrance on the arena facility', () => {
    for (const presentation of Object.values(PRODUCTION_SECT_PRESENTATIONS)) {
      expect(
        presentation.rooms.arena.actors.find(
          (actor) => actor.roleKey === 'ring',
        ),
      ).toMatchObject({
        appearance: 'facility',
        conversation: {
          renderer: 'sect.arena.tournament',
          parameters: { locationKey: 'sect.arena' },
        },
      });
      expect(
        presentation.rooms.arena.actors.find(
          (actor) => actor.roleKey === 'marshal',
        )?.conversation.renderer,
      ).toBe('sect.arena.marshal');
    }
  });

  it('preserves standard facility roles and conversation bindings', () => {
    for (const presentation of Object.values(PRODUCTION_SECT_PRESENTATIONS)) {
      const actors = facilityActorKeys.map(([roomKey, roleKey]) =>
        presentation.rooms[roomKey].actors.find(
          (actor) => actor.roleKey === roleKey,
        ),
      );

      for (const [index, actor] of actors.entries()) {
        const [roomKey, roleKey] = facilityActorKeys[index];
        const standardActor = STANDARD_SECT_PRESENTATION.rooms[
          roomKey
        ].actors.find((candidate) => candidate.roleKey === roleKey);
        expect(actor).toBeDefined();
        expect(actor).toMatchObject({
          conversation: standardActor?.conversation,
        });
      }
    }
  });

  it('exposes only the gate and formation to foreign visitors', () => {
    for (const presentation of Object.values(PRODUCTION_SECT_PRESENTATIONS)) {
      const visitorHotspots = presentation.map.hotspots
        .filter((hotspot) => hotspot.visitor)
        .map((hotspot) => hotspot.id)
        .sort();

      expect(visitorHotspots).toEqual(['formation', 'gate']);
    }
  });
});
