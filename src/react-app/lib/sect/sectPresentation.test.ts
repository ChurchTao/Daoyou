import { describe, expect, it } from 'vitest';
import { getSectPresentation, registerSectPresentation } from './sectPresentation';

describe('sect presentation registry', () => {
  it('requires each sect to provide its own presentation module', () => {
    expect(() => getSectPresentation('missing-sect')).toThrow('尚未注册展示模块');
    registerSectPresentation({
      sectId: 'fixture-presentation',
      mapImage: '/fixture.webp',
      mapAlt: '夹具宗门舆图',
      facilityLabels: {},
      lockedFacilities: [],
      hotspots: [],
    });
    expect(getSectPresentation('fixture-presentation').mapAlt).toBe('夹具宗门舆图');
  });
});
