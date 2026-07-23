import { PRODUCTION_SECT_PRESENTATIONS } from '@shared/engine/sect/content';
import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { resolveClosestSectMapHotspot } from './components/sectMapHitTest';

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

  it('uses a focused map component with quiet, selectable hotspots', () => {
    const routeSource = readFileSync(
      'src/react-app/routes/game/sect/route.tsx',
      'utf8',
    );
    const mapSource = readFileSync(
      'src/react-app/routes/game/sect/components/SectMap.tsx',
      'utf8',
    );

    expect(routeSource).toContain('useNavigate');
    expect(routeSource).toContain('<SectMap');
    expect(routeSource).not.toContain('<a');
    expect(mapSource).toContain('TransformWrapper');
    expect(mapSource).toContain('TransformComponent');
    expect(mapSource).toContain('KeepScale');
    expect(mapSource).toContain('设施名录');
    expect(mapSource).toContain('aria-pressed={selected}');
    expect(mapSource).toContain('minScale={1}');
    expect(mapSource).not.toContain('centerZoomedOut');
    expect(mapSource).toContain('FacilityMarkerGlyph');
    expect(mapSource).not.toContain('rotate-45');
    expect(mapSource).toContain('size-[18px]');
    expect(mapSource).toContain('relative flex size-7');
    expect(mapSource).toContain('scale-[1.08]');
    expect(mapSource).toContain('AVAILABLE_MARKER_STYLE');
    expect(mapSource).not.toContain('rounded-full bg-current');
    expect(mapSource).not.toContain('opacity-0 group-hover:opacity-100');
    expect(mapSource).not.toContain('disabled={state.locked}');
  });

  it('resolves overlapping hotspot hit areas by pointer proximity', () => {
    const hotspots = PRODUCTION_SECT_PRESENTATIONS.tianyan.map.hotspots;
    const canvas = { width: 760, height: 427 };

    expect(
      resolveClosestSectMapHotspot(
        hotspots,
        { x: canvas.width * 0.5, y: canvas.height * 0.49 },
        canvas,
      )?.id,
    ).toBe('arena');
    expect(
      resolveClosestSectMapHotspot(
        hotspots,
        { x: canvas.width * 0.5, y: canvas.height * 0.53 },
        canvas,
      )?.id,
    ).toBe('formation');
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
