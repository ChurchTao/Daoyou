import { bodyFontStack } from '@app/lib/fonts';
import * as Phaser from 'phaser';

interface SectMapMarker {
  id: string;
  label: string;
  x: number;
  y: number;
  locked: boolean;
  selectable: boolean;
}

export interface SectMapView {
  markers: readonly SectMapMarker[];
  selectedId: string | null;
  opacity: number;
  blocked?: boolean;
}

export interface SectMapController {
  setView(view: SectMapView): void;
  focus(id: string): void;
  zoomIn(): void;
  zoomOut(): void;
  reset(): void;
  destroy(): void;
}

interface SectMapArguments {
  root: HTMLElement;
  image: string;
  aspectRatio: number;
  ariaLabel?: string;
  view: SectMapView;
  onSelect(id: string): void;
  onClear(): void;
  onInteract?(): void;
  onReady(): void;
  onError(message: string): void;
}

type Point = { x: number; y: number };
type MarkerDisplay = {
  marker: SectMapMarker;
  group: Phaser.GameObjects.Container;
  ring: Phaser.GameObjects.Arc;
  label: Phaser.GameObjects.Text;
};

const BACKGROUND = 'sect-map';
const PAPER = 0xfaf0db;
const CINNABAR = 0x983c32;
const LOCKED_INK = 0x655952;
const HIT_RADIUS = 22;
const DOT_CLEARANCE = 11;
const LABEL_GAP = 14;
const VIEWPORT_EDGE = 4;
const TOOLBAR_BOTTOM = 54;
const MAX_ZOOM = 3;
const ZOOM_STEP = 1.3;
const readPixelRatio = () => Math.min(window.devicePixelRatio || 1, 3);

export function attachSectPhaser(args: SectMapArguments): SectMapController {
  let view = args.view;
  let pixelRatio = readPixelRatio();
  let destroyed = false;
  let pendingFocus: string | undefined;
  const runtime: { scene?: SectMapScene } = {};
  const canvasLabel =
    args.ariaLabel ?? '宗门舆图，方向键切换设施，回车选择，Escape 取消';

  class SectMapScene extends Phaser.Scene {
    private background!: Phaser.GameObjects.Image;
    private displays: MarkerDisplay[] = [];
    private renderedMarkers?: SectMapView['markers'];
    private hoveredId?: string;
    private focusedId?: string;
    private mapWidth = 1;
    private mapHeight = 1;
    private minZoom = 1;
    private atEntrance = true;

    preload() {
      this.load.once(Phaser.Loader.Events.FILE_LOAD_ERROR, () => {
        if (!destroyed) args.onError('宗门舆图加载未成，请重试。');
      });
      this.load.image(BACKGROUND, args.image);
    }

    create() {
      if (destroyed || !this.textures.exists(BACKGROUND)) return;
      this.background = this.add.image(0, 0, BACKGROUND).setOrigin(0);
      this.mapWidth = this.background.width;
      this.mapHeight =
        this.background.height || this.mapWidth / args.aspectRatio;
      runtime.scene = this;
      this.resize(this.center());
      this.updateView();
      const initialFocus = pendingFocus ?? view.selectedId;
      if (initialFocus) this.focus(initialFocus);
      args.onReady();
    }

    updateView() {
      this.background.setAlpha(view.opacity);
      if (this.renderedMarkers !== view.markers) {
        for (const { group } of this.displays) group.destroy();
        this.displays = view.markers.map((marker) => this.addMarker(marker));
        this.renderedMarkers = view.markers;
      }
      if (view.blocked) this.hoveredId = undefined;
      this.layoutMarkers();
    }

    private addMarker(marker: SectMapMarker): MarkerDisplay {
      const color = marker.locked ? LOCKED_INK : CINNABAR;
      const dot = this.add.circle(0, 0, 8.5, color).setStrokeStyle(1.5, PAPER);
      const ring = this.add.circle(0, 0, 12, 0, 0).setStrokeStyle(1.5, color);
      const label = this.add
        .text(0, 0, marker.label, {
          fontFamily: bodyFontStack,
          fontSize: '12px',
          fontStyle: 'bold',
          color: marker.locked ? '#655952' : '#983c32',
          stroke: '#faf0db',
          strokeThickness: 3,
          padding: { x: 2, y: 1 },
        })
        .setResolution(pixelRatio);
      const group = this.add.container(
        marker.x * this.mapWidth,
        marker.y * this.mapHeight,
        [ring, dot, label],
      );
      if (marker.locked) {
        const lock = this.add.graphics();
        lock.lineStyle(1, PAPER).strokeRoundedRect(-2, -4.5, 4, 5, 2);
        lock.fillStyle(PAPER).fillRoundedRect(-3.5, -1.5, 7, 5, 1);
        group.add(lock);
      }
      group.setAlpha(marker.selectable ? 1 : 0.65);
      return { marker, group, ring, label };
    }

    private layoutMarkers() {
      const camera = this.cameras.main;
      const scale = pixelRatio / camera.zoom;
      const viewport = {
        width: camera.width / pixelRatio,
        height: camera.height / pixelRatio,
      };
      const priority = (id: string) =>
        id === view.selectedId
          ? 3
          : id === this.focusedId
            ? 2
            : id === this.hoveredId
              ? 1
              : 0;
      const projected = this.displays
        .map(({ marker, group, ring, label }) => {
          const depth = priority(marker.id);
          group.setScale(scale).setDepth(depth + 1);
          ring.setVisible(depth > 0);
          label.setVisible(false);
          if (label.style.resolution !== pixelRatio)
            label.setResolution(pixelRatio);
          return {
            x: (group.x - camera.midPoint.x) / scale + viewport.width / 2,
            y: (group.y - camera.midPoint.y) / scale + viewport.height / 2,
            label,
            depth,
            selectable: marker.selectable,
          };
        })
        .filter(
          ({ x, y }) =>
            x >= 0 && x <= viewport.width && y >= 0 && y <= viewport.height,
        );

      // Reserve every visible pin before placing labels, including lower-priority pins.
      const occupied = projected.map(
        ({ x, y }) =>
          new Phaser.Geom.Rectangle(
            x - DOT_CLEARANCE,
            y - DOT_CLEARANCE,
            2 * DOT_CLEARANCE,
            2 * DOT_CLEARANCE,
          ),
      );
      projected.sort(
        (a, b) =>
          b.depth - a.depth || Number(b.selectable) - Number(a.selectable),
      );
      for (const { x, y, label, depth } of projected) {
        const { width, height } = label;
        const candidates = [
          [x - width / 2, y + LABEL_GAP],
          [x + LABEL_GAP, y - height / 2],
          [x - width - LABEL_GAP, y - height / 2],
          [x - width / 2, y - height - LABEL_GAP],
        ]
          .map(
            ([left, top]) =>
              new Phaser.Geom.Rectangle(
                Phaser.Math.Clamp(
                  left,
                  VIEWPORT_EDGE,
                  Math.max(
                    VIEWPORT_EDGE,
                    viewport.width - width - VIEWPORT_EDGE,
                  ),
                ),
                top,
                width,
                height,
              ),
          )
          .filter(
            (box) =>
              box.top >= TOOLBAR_BOTTOM &&
              box.bottom <= viewport.height - VIEWPORT_EDGE,
          );
        const available = candidates.find(
          (box) =>
            !occupied.some((other) =>
              Phaser.Geom.Intersects.RectangleToRectangle(box, other),
            ),
        );
        const box = available ?? (depth > 0 ? candidates[0] : undefined);
        if (!box) continue;
        label.setPosition(box.x - x, box.y - y).setVisible(true);
        occupied.push(box);
      }
    }

    center(): Point {
      const camera = this.cameras.main;
      return {
        x: camera.scrollX + camera.width / 2,
        y: camera.scrollY + camera.height / 2,
      };
    }

    resize(center: Point, densityChange = 1) {
      const camera = this.cameras.main;
      this.minZoom = Math.max(
        camera.width / this.mapWidth,
        camera.height / this.mapHeight,
      );
      if (this.atEntrance) this.reset();
      else
        this.placeCamera(center, this.clampZoom(camera.zoom * densityChange));
    }

    reset() {
      this.atEntrance = true;
      const gate = view.markers.find(({ id }) => id === 'gate');
      this.placeCamera(
        {
          x: this.mapWidth * (gate?.x ?? 0.5),
          y: this.mapHeight * (gate?.y ?? 0.5),
        },
        this.minZoom,
      );
    }

    private placeCamera(center: Point, zoom: number) {
      this.cameras.main.setZoom(zoom).centerOn(center.x, center.y);
      this.clampCamera();
      this.layoutMarkers();
    }

    private clampZoom(zoom: number) {
      return Phaser.Math.Clamp(zoom, this.minZoom, this.minZoom * MAX_ZOOM);
    }

    private clampCamera() {
      const camera = this.cameras.main;
      const { x, y } = this.center();
      const halfWidth = camera.width / camera.zoom / 2;
      const halfHeight = camera.height / camera.zoom / 2;
      camera.centerOn(
        halfWidth >= this.mapWidth / 2
          ? this.mapWidth / 2
          : Phaser.Math.Clamp(x, halfWidth, this.mapWidth - halfWidth),
        halfHeight >= this.mapHeight / 2
          ? this.mapHeight / 2
          : Phaser.Math.Clamp(y, halfHeight, this.mapHeight - halfHeight),
      );
      camera.preRender();
    }

    zoomBy(factor: number, anchor?: Point) {
      const camera = this.cameras.main;
      const zoom = this.clampZoom(camera.zoom * factor);
      if (zoom === camera.zoom) return;
      this.atEntrance = false;
      const point = anchor ?? { x: camera.width / 2, y: camera.height / 2 };
      const before = camera.getWorldPoint(point.x, point.y);
      camera.setZoom(zoom).preRender();
      const after = camera.getWorldPoint(point.x, point.y);
      camera.scrollX += before.x - after.x;
      camera.scrollY += before.y - after.y;
      this.clampCamera();
      this.layoutMarkers();
    }

    pan(dx: number, dy: number) {
      const camera = this.cameras.main;
      const previous = this.center();
      camera.scrollX -= dx / camera.zoom;
      camera.scrollY -= dy / camera.zoom;
      this.clampCamera();
      const next = this.center();
      if (next.x !== previous.x || next.y !== previous.y)
        this.atEntrance = false;
      this.layoutMarkers();
    }

    focus(id: string, zoom = true) {
      const display = this.displays.find(
        ({ marker }) => marker.id === id && marker.selectable,
      );
      if (!display) return;
      this.atEntrance = false;
      const camera = this.cameras.main;
      const nextZoom = zoom
        ? Math.max(camera.zoom, this.minZoom * 1.35)
        : camera.zoom;
      this.placeCamera(display.group, nextZoom);
    }

    private hit(
      point: Point,
      includeLabels = false,
    ): SectMapMarker | undefined {
      const camera = this.cameras.main;
      const world = camera.getWorldPoint(point.x, point.y);
      const scale = pixelRatio / camera.zoom;
      const radius = HIT_RADIUS * scale;
      let distance = radius * radius;
      let nearest: SectMapMarker | undefined;
      let named: SectMapMarker | undefined;
      for (const { marker, group, label } of this.displays) {
        if (!marker.selectable) continue;
        if (includeLabels && label.visible) {
          const localX = (world.x - group.x) / scale - label.x;
          const localY = (world.y - group.y) / scale - label.y;
          if (
            localX >= 0 &&
            localX <= label.width &&
            localY >= 0 &&
            localY <= label.height
          )
            named = marker;
        }
        const squared = (group.x - world.x) ** 2 + (group.y - world.y) ** 2;
        if (squared > distance) continue;
        distance = squared;
        nearest = marker;
      }
      return distance <= (DOT_CLEARANCE * scale) ** 2
        ? nearest
        : (named ?? nearest);
    }

    pick(point: Point) {
      const marker = this.hit(point, true);
      if (marker) args.onSelect(marker.id);
      else args.onClear();
    }

    hover(point?: Point) {
      const next = point ? this.hit(point)?.id : undefined;
      if (this.hoveredId !== next) {
        this.hoveredId = next;
        this.layoutMarkers();
      }
      return next !== undefined;
    }

    blur() {
      this.focusedId = undefined;
      this.hoveredId = undefined;
      this.layoutMarkers();
      canvas.setAttribute('aria-label', canvasLabel);
    }

    key(event: KeyboardEvent) {
      if (event.key === 'Escape') {
        args.onClear();
        return;
      }
      const selectable = view.markers.filter((marker) => marker.selectable);
      if (!selectable.length) return;
      if (event.key === 'Enter' || event.key === ' ') {
        event.preventDefault();
        const marker = selectable.find(({ id }) => id === this.focusedId);
        if (marker) args.onSelect(marker.id);
        return;
      }
      if (
        !['ArrowLeft', 'ArrowUp', 'ArrowRight', 'ArrowDown'].includes(event.key)
      )
        return;
      event.preventDefault();
      const index = selectable.findIndex(
        (marker) => marker.id === this.focusedId,
      );
      const backward = event.key === 'ArrowLeft' || event.key === 'ArrowUp';
      const next =
        index === -1
          ? backward
            ? selectable.length - 1
            : 0
          : (index + (backward ? -1 : 1) + selectable.length) %
            selectable.length;
      const marker = selectable[next];
      this.focusedId = marker.id;
      canvas.setAttribute(
        'aria-label',
        `${marker.label}，按回车选择，方向键切换设施`,
      );
      this.focus(marker.id, false);
      args.onInteract?.();
    }
  }

  const game = new Phaser.Game({
    type: Phaser.AUTO,
    parent: args.root,
    width: Math.max(1, Math.round(args.root.clientWidth * pixelRatio)),
    height: Math.max(1, Math.round(args.root.clientHeight * pixelRatio)),
    scale: { zoom: 1 / pixelRatio },
    backgroundColor: '#e9e1cf',
    banner: false,
    audio: { noAudio: true },
    input: { mouse: false, touch: false, keyboard: false },
    scene: SectMapScene,
  });
  const canvas = game.canvas;
  canvas.tabIndex = 0;
  canvas.setAttribute('aria-label', canvasLabel);
  canvas.classList.add(
    'focus-visible:outline-crimson',
    'focus-visible:outline-2',
    'focus-visible:outline-offset-[-2px]',
  );
  canvas.style.touchAction = 'none';
  canvas.style.cursor = 'grab';

  const pointers = new Map<number, Point>();
  let pressedAt: Point | undefined;
  let tapPoint: Point | undefined;
  let gestureMoved = false;
  const events = new AbortController();
  const { signal } = events;
  const point = (event: PointerEvent | WheelEvent): Point => {
    const bounds = canvas.getBoundingClientRect();
    return {
      x: ((event.clientX - bounds.left) * game.scale.width) / bounds.width,
      y: ((event.clientY - bounds.top) * game.scale.height) / bounds.height,
    };
  };

  canvas.addEventListener(
    'pointerdown',
    (event) => {
      if (
        !runtime.scene ||
        view.blocked ||
        event.button !== 0 ||
        pointers.size >= 2
      )
        return;
      const next = point(event);
      if (!pointers.size) {
        pressedAt = next;
        tapPoint = undefined;
        gestureMoved = false;
      } else {
        gestureMoved = true;
        args.onInteract?.();
      }
      canvas.setPointerCapture(event.pointerId);
      pointers.set(event.pointerId, next);
      canvas.style.cursor = 'grabbing';
    },
    { signal },
  );

  canvas.addEventListener(
    'pointermove',
    (event) => {
      if (!runtime.scene || view.blocked) return;
      const previous = pointers.get(event.pointerId);
      const next = point(event);
      if (!previous) {
        if (event.pointerType === 'mouse' && !pointers.size)
          canvas.style.cursor = runtime.scene.hover(next) ? 'pointer' : 'grab';
        return;
      }
      pointers.set(event.pointerId, next);
      if (
        !gestureMoved &&
        pressedAt &&
        Math.hypot(next.x - pressedAt.x, next.y - pressedAt.y) > 6 * pixelRatio
      ) {
        gestureMoved = true;
        args.onInteract?.();
      }
      if (!gestureMoved) return;
      if (pointers.size === 1) {
        runtime.scene.pan(next.x - previous.x, next.y - previous.y);
        return;
      }
      const other = [...pointers].find(([id]) => id !== event.pointerId)?.[1];
      if (!other) return;
      const distance = Math.hypot(previous.x - other.x, previous.y - other.y);
      if (distance > 0) {
        runtime.scene.zoomBy(
          Math.hypot(next.x - other.x, next.y - other.y) / distance,
          {
            x: (previous.x + other.x) / 2,
            y: (previous.y + other.y) / 2,
          },
        );
      }
      runtime.scene.pan((next.x - previous.x) / 2, (next.y - previous.y) / 2);
    },
    { signal },
  );

  const releasePointer = (event: PointerEvent) => {
    if (!pointers.delete(event.pointerId)) return;
    if (canvas.hasPointerCapture(event.pointerId))
      canvas.releasePointerCapture(event.pointerId);
    if (event.type === 'pointerup' && !gestureMoved && !view.blocked)
      tapPoint = point(event);
    if (!pointers.size) canvas.style.cursor = 'grab';
  };
  canvas.addEventListener('pointerup', releasePointer, { signal });
  canvas.addEventListener('pointercancel', releasePointer, { signal });
  canvas.addEventListener('lostpointercapture', releasePointer, { signal });
  canvas.addEventListener(
    'click',
    () => {
      // Opening the drawer on pointerup lets the subsequent touch click close it.
      const selection = tapPoint;
      tapPoint = undefined;
      if (selection && !view.blocked) runtime.scene?.pick(selection);
    },
    { signal },
  );
  canvas.addEventListener('pointerleave', () => runtime.scene?.hover(), {
    signal,
  });
  canvas.addEventListener('blur', () => runtime.scene?.blur(), { signal });
  canvas.addEventListener(
    'keydown',
    (event) => {
      if (!view.blocked) runtime.scene?.key(event);
    },
    { signal },
  );
  canvas.addEventListener(
    'wheel',
    (event) => {
      event.preventDefault();
      if (!runtime.scene || view.blocked) return;
      args.onInteract?.();
      runtime.scene.zoomBy(
        Math.exp(-event.deltaY * (event.deltaMode === 1 ? 0.025 : 0.0015)),
        point(event),
      );
    },
    { signal, passive: false },
  );
  canvas.addEventListener(
    'webglcontextlost',
    () => {
      if (!destroyed) args.onError('宗门舆图暂时无法显示，请重试。');
    },
    { signal },
  );

  const resizeCanvas = () => {
    const center = runtime.scene?.center();
    const previousRatio = pixelRatio;
    pixelRatio = readPixelRatio();
    if (pixelRatio !== previousRatio) game.scale.setZoom(1 / pixelRatio);
    game.scale.resize(
      Math.max(1, Math.round(args.root.clientWidth * pixelRatio)),
      Math.max(1, Math.round(args.root.clientHeight * pixelRatio)),
    );
    if (center) runtime.scene?.resize(center, pixelRatio / previousRatio);
  };
  const observer = new ResizeObserver(resizeCanvas);
  observer.observe(args.root);
  window.addEventListener('resize', resizeCanvas, { signal });

  const zoom = (factor: number) => {
    if (view.blocked || !runtime.scene) return;
    runtime.scene.zoomBy(factor);
    args.onInteract?.();
  };
  const reset = () => {
    if (view.blocked || !runtime.scene) return;
    runtime.scene.reset();
    args.onInteract?.();
  };

  return {
    setView(next) {
      view = next;
      if (view.blocked) {
        const activePointers = [...pointers.keys()];
        pointers.clear();
        for (const id of activePointers) {
          if (canvas.hasPointerCapture(id)) canvas.releasePointerCapture(id);
        }
        canvas.style.cursor = 'grab';
      }
      runtime.scene?.updateView();
    },
    focus(id) {
      if (runtime.scene) runtime.scene.focus(id);
      else pendingFocus = id;
    },
    zoomIn: () => zoom(ZOOM_STEP),
    zoomOut: () => zoom(1 / ZOOM_STEP),
    reset,
    destroy() {
      if (destroyed) return;
      destroyed = true;
      observer.disconnect();
      events.abort();
      pointers.clear();
      runtime.scene = undefined;
      game.destroy(true);
    },
  };
}
