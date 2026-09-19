import {
  ATLAS_ANCHORS,
  ATLAS_REGIONS,
  getAtlasLocations,
  hasAtlasMap,
} from '@shared/lib/game/mapAtlas';
import * as Phaser from 'phaser';

export interface AtlasView {
  region: 'world' | keyof typeof ATLAS_ANCHORS;
  selectedId: string | null;
  blocked: boolean;
  intent: string;
}

export interface AtlasController {
  setView: (view: AtlasView) => void;
  destroy: () => void;
}

interface AtlasArguments {
  root: HTMLElement;
  view: AtlasView;
  onRegion: (id: string) => void;
  onNode: (id: string) => void;
  onLoading: () => void;
  onReady: () => void;
  onError: (message: string) => void;
}

const WIDTH = 1536;
const HEIGHT = 1024;
const TEXTURES = {
  world: '/assets/maps/world-overview-v1.webp',
  tiannan: '/assets/maps/tiannan-region-v1.webp',
  luanxinghai: '/assets/maps/luanxinghai-region-v1.webp',
} satisfies Record<AtlasView['region'], string>;
const INK = 0x352f29;
const CINNABAR = 0x9d4033;
// Only camera snapshots survive page navigation; no textures or player state.
const cameraMemory = new Map<string, { x: number; y: number; zoom: number }>();

interface Marker {
  id: string;
  x: number;
  y: number;
  primary: boolean;
  match: boolean;
  label: Phaser.GameObjects.Text;
  dot: Phaser.GameObjects.Arc;
  box?: Phaser.Geom.Rectangle;
}

export function attachAtlasPhaser(args: AtlasArguments): AtlasController {
  let view = args.view;
  let destroyed = false;
  const runtime: { scene?: AtlasScene } = {};
  let gestureMoved = false;
  let pressedAt = { x: 0, y: 0 };
  const pointers = new Map<number, { x: number; y: number }>();

  class AtlasScene extends Phaser.Scene {
    private markers: Marker[] = [];
    private shownRegion?: AtlasView['region'];
    private selectedId: string | null = null;
    private minZoom = 1;
    private loadFailed = false;
    private background?: Phaser.GameObjects.Image;

    create() {
      runtime.scene = this;
      this.cameras.main.setBackgroundColor('#eee7d8');
      this.load.on(Phaser.Loader.Events.FILE_LOAD_ERROR, () => {
        this.loadFailed = true;
        args.onError('舆图加载未成，请重试或使用旧版地图。');
      });
      this.load.on(Phaser.Loader.Events.COMPLETE, () => this.showView());
      this.showView();
    }

    showView() {
      if (destroyed || this.loadFailed) return;
      const camera = this.cameras.main;
      if (this.shownRegion !== view.region) {
        this.rememberCamera();
        if (!this.textures.exists(view.region)) {
          args.onLoading();
          if (!this.load.isLoading()) {
            this.load.image(view.region, TEXTURES[view.region]);
            this.load.start();
          }
          return;
        }
        this.background?.destroy();
        this.markers.forEach(({ label, dot }) => {
          label.destroy();
          dot.destroy();
        });
        this.background = this.add
          .image(0, 0, view.region)
          .setOrigin(0)
          .setDisplaySize(WIDTH, HEIGHT);
        this.markers = [];
        if (view.region === 'world') {
          for (const region of ATLAS_REGIONS) {
            this.addMarker(
              region.id,
              `${region.name} ›`,
              region.x,
              region.y,
              true,
              hasAtlasMap(region.id),
            );
          }
        } else {
          for (const location of getAtlasLocations()) {
            const point = ATLAS_ANCHORS[view.region][location.id];
            if (!point) continue;
            const primary = 'region' in location || 'sect_id' in location;
            const match =
              view.intent === 'sect'
                ? 'sect_id' in location
                : view.intent === 'market'
                  ? 'market_config' in location &&
                    !!location.market_config?.enabled
                  : view.intent === 'dungeon'
                    ? 'dungeon_config' in location && !!location.dungeon_config
                    : false;
            this.addMarker(
              location.id,
              location.name,
              point[0],
              point[1],
              primary,
              match,
            );
          }
        }
        this.shownRegion = view.region;
        this.selectedId = null;
        this.fitViewport();
        const saved = cameraMemory.get(view.region);
        if (saved) {
          camera
            .setZoom(Math.max(this.minZoom, saved.zoom))
            .centerOn(saved.x, saved.y);
          this.clampCamera();
        } else if (view.region === 'luanxinghai') {
          const [x, y] = ATLAS_ANCHORS.luanxinghai.LX_INNER_01;
          camera.centerOn(x * WIDTH, y * HEIGHT);
          this.clampCamera();
        }
      }
      // Intent can change without recreating the canvas or reloading a texture.
      for (const marker of this.markers) {
        if (view.region === 'world') continue;
        const location = getAtlasLocations().find(
          (item) => item.id === marker.id,
        );
        marker.match =
          !!location &&
          (view.intent === 'sect'
            ? 'sect_id' in location
            : view.intent === 'market'
              ? 'market_config' in location && !!location.market_config?.enabled
              : view.intent === 'dungeon'
                ? 'dungeon_config' in location && !!location.dungeon_config
                : false);
      }
      if (view.selectedId && this.selectedId !== view.selectedId) {
        const target = this.markers.find(
          (marker) => marker.id === view.selectedId,
        );
        if (target) {
          camera.setZoom(Math.max(camera.zoom, this.minZoom * 2));
          camera.centerOn(target.x, target.y);
          this.clampCamera();
        }
      }
      this.selectedId = view.selectedId;
      this.layoutMarkers();
      args.onReady();
    }

    private addMarker(
      id: string,
      name: string,
      x: number,
      y: number,
      primary: boolean,
      match: boolean,
    ) {
      const world = view.region === 'world';
      const dot = this.add.circle(x * WIDTH, y * HEIGHT, world ? 5 : 4, INK);
      const label = this.add
        .text(0, 0, name, {
          fontFamily: 'LXGWWenKai, serif',
          fontSize: world ? '24px' : primary ? '16px' : '14px',
          color: '#352f29',
          backgroundColor: '#f6efdf',
          padding: { x: world ? 12 : 7, y: world ? 8 : 5 },
        })
        .setResolution(Math.min(window.devicePixelRatio || 1, 2));
      this.markers.push({
        id,
        x: x * WIDTH,
        y: y * HEIGHT,
        primary,
        match,
        dot,
        label,
      });
    }

    private fitViewport() {
      const camera = this.cameras.main;
      // Cover the viewport at every zoom level; gestures reveal the cropped sides.
      this.minZoom = Math.max(camera.width / WIDTH, camera.height / HEIGHT);
      camera.setZoom(this.minZoom).centerOn(WIDTH / 2, HEIGHT / 2);
      this.layoutMarkers();
    }

    rememberCamera() {
      const camera = this.cameras.main;
      if (this.shownRegion)
        cameraMemory.set(this.shownRegion, {
          x: camera.scrollX + camera.width / 2,
          y: camera.scrollY + camera.height / 2,
          zoom: camera.zoom,
        });
    }

    resize(center?: { x: number; y: number }) {
      const camera = this.cameras.main;
      const wasFit = Math.abs(camera.zoom - this.minZoom) < 0.001;
      this.minZoom = Math.max(camera.width / WIDTH, camera.height / HEIGHT);
      camera.setZoom(
        wasFit ? this.minZoom : Math.max(this.minZoom, camera.zoom),
      );
      if (center) camera.centerOn(center.x, center.y);
      this.clampCamera();
      this.layoutMarkers();
    }

    clampCamera() {
      const camera = this.cameras.main;
      const halfWidth = camera.width / camera.zoom / 2;
      const halfHeight = camera.height / camera.zoom / 2;
      const x =
        halfWidth >= WIDTH / 2
          ? WIDTH / 2
          : Phaser.Math.Clamp(
              camera.scrollX + camera.width / 2,
              halfWidth,
              WIDTH - halfWidth,
            );
      const y =
        halfHeight >= HEIGHT / 2
          ? HEIGHT / 2
          : Phaser.Math.Clamp(
              camera.scrollY + camera.height / 2,
              halfHeight,
              HEIGHT - halfHeight,
            );
      camera.centerOn(x, y);
      camera.preRender();
    }

    zoomAt(factor: number, x: number, y: number) {
      const camera = this.cameras.main;
      camera.preRender();
      const before = camera.getWorldPoint(x, y);
      camera.setZoom(
        Phaser.Math.Clamp(
          camera.zoom * factor,
          this.minZoom,
          Math.max(2.5, this.minZoom * 5),
        ),
      );
      camera.preRender();
      const after = camera.getWorldPoint(x, y);
      camera.scrollX += before.x - after.x;
      camera.scrollY += before.y - after.y;
      this.clampCamera();
      this.layoutMarkers();
    }

    pan(dx: number, dy: number) {
      this.cameras.main.scrollX -= dx / this.cameras.main.zoom;
      this.cameras.main.scrollY -= dy / this.cameras.main.zoom;
      this.clampCamera();
      this.layoutMarkers();
    }

    pick(x: number, y: number) {
      const marker = [...this.markers]
        .reverse()
        .find((item) => item.box?.contains(x, y));
      if (!marker) return;
      if (view.region === 'world') args.onRegion(marker.id);
      else args.onNode(marker.id);
    }

    private layoutMarkers() {
      const camera = this.cameras.main;
      camera.preRender();
      const occupied: Phaser.Geom.Rectangle[] = [];
      const ordered = [...this.markers].sort((a, b) => {
        const priority = (m: Marker) =>
          (m.id === view.selectedId ? 100 : 0) +
          (m.match ? 10 : 0) +
          (m.primary ? 1 : 0);
        return priority(b) - priority(a);
      });
      for (const marker of ordered) {
        const { label, dot } = marker;
        const selected = marker.id === view.selectedId;
        const shown =
          marker.primary ||
          marker.match ||
          selected ||
          camera.zoom >= this.minZoom * 1.7;
        marker.box = undefined;
        label.setVisible(false);
        dot
          .setVisible(shown)
          .setScale(1 / camera.zoom)
          .setFillStyle(selected || marker.match ? CINNABAR : INK);
        if (!shown) continue;
        const screen = {
          x:
            (marker.x - camera.scrollX - camera.width / 2) * camera.zoom +
            camera.width / 2,
          y:
            (marker.y - camera.scrollY - camera.height / 2) * camera.zoom +
            camera.height / 2,
        };
        if (
          screen.x < -30 ||
          screen.y < -30 ||
          screen.x > camera.width + 30 ||
          screen.y > camera.height + 30
        )
          continue;
        const width = label.width;
        const height = Math.max(44, label.height);
        const candidates = [
          [screen.x + 10, screen.y - height / 2],
          [screen.x - width - 10, screen.y - height / 2],
          [screen.x - width / 2, screen.y + 10],
          [screen.x - width / 2, screen.y - height - 10],
        ];
        let box: Phaser.Geom.Rectangle | undefined;
        for (const [left, top] of candidates) {
          const candidate = new Phaser.Geom.Rectangle(
            Phaser.Math.Clamp(left, 4, Math.max(4, camera.width - width - 4)),
            Phaser.Math.Clamp(top, 4, Math.max(4, camera.height - height - 4)),
            width,
            height,
          );
          if (
            !occupied.some((other) =>
              Phaser.Geom.Intersects.RectangleToRectangle(candidate, other),
            )
          ) {
            box = candidate;
            break;
          }
        }
        if (!box) {
          marker.box = new Phaser.Geom.Rectangle(
            screen.x - 22,
            screen.y - 22,
            44,
            44,
          );
          continue;
        }
        occupied.push(box);
        const position = camera.getWorldPoint(
          box.x,
          box.y + (height - label.height) / 2,
        );
        label
          .setPosition(position.x, position.y)
          .setScale(1 / camera.zoom)
          .setColor(selected || marker.match ? '#9d4033' : '#352f29')
          .setVisible(true);
        marker.box = Phaser.Geom.Rectangle.Union(
          box,
          new Phaser.Geom.Rectangle(screen.x - 22, screen.y - 22, 44, 44),
        );
      }
    }
  }

  const game = new Phaser.Game({
    type: Phaser.AUTO,
    parent: args.root,
    width: Math.max(1, args.root.clientWidth),
    height: Math.max(1, args.root.clientHeight),
    backgroundColor: '#eee7d8',
    banner: false,
    audio: { noAudio: true },
    input: { mouse: false, touch: false, keyboard: false },
    scene: AtlasScene,
  });
  const canvas = game.canvas;
  canvas.setAttribute(
    'aria-label',
    '山河舆图，可使用查找地点列表选择区域与地点',
  );
  canvas.style.touchAction = 'none';
  canvas.style.cursor = 'grab';
  const point = (event: PointerEvent | WheelEvent) => {
    const rect = canvas.getBoundingClientRect();
    return {
      x: ((event.clientX - rect.left) * game.scale.width) / rect.width,
      y: ((event.clientY - rect.top) * game.scale.height) / rect.height,
    };
  };
  const down = (event: PointerEvent) => {
    if (view.blocked || event.button !== 0) return;
    canvas.setPointerCapture(event.pointerId);
    const p = point(event);
    if (pointers.size === 0) {
      pressedAt = p;
      gestureMoved = false;
    } else gestureMoved = true;
    pointers.set(event.pointerId, p);
    canvas.style.cursor = 'grabbing';
  };
  const move = (event: PointerEvent) => {
    if (!pointers.has(event.pointerId) || view.blocked) return;
    const before = [...pointers.values()];
    const old = pointers.get(event.pointerId)!;
    const next = point(event);
    pointers.set(event.pointerId, next);
    if (Math.hypot(next.x - pressedAt.x, next.y - pressedAt.y) > 6)
      gestureMoved = true;
    if (pointers.size === 1) runtime.scene?.pan(next.x - old.x, next.y - old.y);
    else if (pointers.size === 2) {
      const after = [...pointers.values()];
      const previousDistance = Math.hypot(
        before[0].x - before[1].x,
        before[0].y - before[1].y,
      );
      const distance = Math.hypot(
        after[0].x - after[1].x,
        after[0].y - after[1].y,
      );
      const center = {
        x: (before[0].x + before[1].x) / 2,
        y: (before[0].y + before[1].y) / 2,
      };
      if (previousDistance > 0)
        runtime.scene?.zoomAt(distance / previousDistance, center.x, center.y);
      runtime.scene?.pan(
        (after[0].x + after[1].x) / 2 - center.x,
        (after[0].y + after[1].y) / 2 - center.y,
      );
    }
  };
  const up = (event: PointerEvent) => {
    if (!pointers.has(event.pointerId)) return;
    pointers.delete(event.pointerId);
    if (canvas.hasPointerCapture(event.pointerId))
      canvas.releasePointerCapture(event.pointerId);
    if (event.type === 'pointerup' && !gestureMoved && !view.blocked) {
      const p = point(event);
      runtime.scene?.pick(p.x, p.y);
    }
    if (!pointers.size) canvas.style.cursor = 'grab';
  };
  const wheel = (event: WheelEvent) => {
    event.preventDefault();
    if (view.blocked) return;
    const p = point(event);
    runtime.scene?.zoomAt(
      Math.exp(-event.deltaY * (event.deltaMode === 1 ? 0.025 : 0.0015)),
      p.x,
      p.y,
    );
  };
  const contextLost = () =>
    args.onError('画卷暂时无法显示，请重试或使用旧版地图。');
  canvas.addEventListener('pointerdown', down);
  canvas.addEventListener('pointermove', move);
  canvas.addEventListener('pointerup', up);
  canvas.addEventListener('pointercancel', up);
  canvas.addEventListener('lostpointercapture', up);
  canvas.addEventListener('wheel', wheel, { passive: false });
  canvas.addEventListener('webglcontextlost', contextLost);
  const resize = new ResizeObserver(() => {
    const camera = runtime.scene?.cameras.main;
    const center = camera
      ? {
          x: camera.scrollX + camera.width / 2,
          y: camera.scrollY + camera.height / 2,
        }
      : undefined;
    game.scale.resize(
      Math.max(1, args.root.clientWidth),
      Math.max(1, args.root.clientHeight),
    );
    runtime.scene?.resize(center);
  });
  resize.observe(args.root);

  return {
    setView(next) {
      view = next;
      if (view.blocked) {
        pointers.clear();
        gestureMoved = true;
      }
      runtime.scene?.showView();
    },
    destroy() {
      destroyed = true;
      runtime.scene?.rememberCamera();
      resize.disconnect();
      canvas.removeEventListener('pointerdown', down);
      canvas.removeEventListener('pointermove', move);
      canvas.removeEventListener('pointerup', up);
      canvas.removeEventListener('pointercancel', up);
      canvas.removeEventListener('lostpointercapture', up);
      canvas.removeEventListener('wheel', wheel);
      canvas.removeEventListener('webglcontextlost', contextLost);
      pointers.clear();
      runtime.scene = undefined;
      game.destroy(true);
    },
  };
}
