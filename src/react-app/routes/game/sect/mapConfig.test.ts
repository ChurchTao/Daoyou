import { PRODUCTION_SECT_PRESENTATIONS } from '@shared/engine/sect/content';
import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

const SECT_MAP_HOTSPOTS = PRODUCTION_SECT_PRESENTATIONS.lingxiao.map.hotspots;

describe('sect map configuration', () => {
  it('keeps every map hotspot and route unique', () => {
    const ids = SECT_MAP_HOTSPOTS.map((spot) => spot.id);
    const routes = SECT_MAP_HOTSPOTS.flatMap((spot) =>
      spot.route ? [spot.route] : [],
    );

    expect(new Set(ids).size).toBe(ids.length);
    expect(new Set(routes).size).toBe(routes.length);
    expect(routes).toEqual(
      expect.arrayContaining([
        '/game/sect/archive',
        '/game/sect/enlightenment-cliff',
        '/game/sect/arena',
        '/game/sect/alchemy',
        '/game/sect/refinery',
        '/game/sect/spirit-vein',
        '/game/sect/herb-garden',
      ]),
    );
  });

  it('keeps the formation locked and all other hotspots navigable', () => {
    const locked = SECT_MAP_HOTSPOTS.filter((spot) => spot.locked);
    expect(locked).toHaveLength(1);
    expect(locked[0]?.id).toBe('formation');
    expect(locked[0]?.route).toBeUndefined();
    expect(
      SECT_MAP_HOTSPOTS.filter((spot) => !spot.locked).every((spot) =>
        Boolean(spot.route),
      ),
    ).toBe(true);
  });

  it('uses the router and a unified transform canvas instead of native anchors', () => {
    const source = readFileSync(
      'src/react-app/routes/game/sect/route.tsx',
      'utf8',
    );
    expect(source).toContain('useNavigate');
    expect(source).toContain('TransformWrapper');
    expect(source).toContain('TransformComponent');
    expect(source).not.toContain('<a');
    expect(source).not.toContain('设施名录');
  });

  it('keeps legacy routes as replace redirects', () => {
    const redirects = [
      [
        'src/react-app/routes/game/sect/archive/methods/route.tsx',
        '/game/sect/archive',
      ],
      [
        'src/react-app/routes/game/sect/archive/paths/route.tsx',
        '/game/sect/enlightenment-cliff',
      ],
      [
        'src/react-app/routes/game/sect/archive/abilities/route.tsx',
        '/game/sect/arena',
      ],
      [
        'src/react-app/routes/game/sect/abilities/redirect.tsx',
        '/game/sect/arena',
      ],
      ['src/react-app/routes/game/sect/workshop/route.tsx', '/game/sect'],
    ] as const;

    for (const [file, target] of redirects) {
      const source = readFileSync(file, 'utf8');
      expect(source).toContain(`to="${target}"`);
      expect(source).toContain('replace');
    }
  });

  it('reuses shared workbench scenes for normal and sect routes', () => {
    const routePairs = [
      [
        'src/react-app/routes/game/craft/alchemy/route.tsx',
        'src/react-app/routes/game/sect/alchemy/route.tsx',
        'AlchemyScene',
      ],
      [
        'src/react-app/routes/game/craft/refine/route.tsx',
        'src/react-app/routes/game/sect/refinery/route.tsx',
        'RefineScene',
      ],
      [
        'src/react-app/routes/game/retreat/route.tsx',
        'src/react-app/routes/game/sect/cultivation-room/route.tsx',
        'RetreatView',
      ],
    ] as const;

    for (const [normalRoute, sectRoute, component] of routePairs) {
      expect(readFileSync(normalRoute, 'utf8')).toContain(component);
      expect(readFileSync(sectRoute, 'utf8')).toContain(component);
    }
  });
});
