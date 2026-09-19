import { GameIcon } from '@app/components/ui/GameIcon';
import {
  ATLAS_ANCHORS,
  ATLAS_REGIONS,
  getAtlasLocations,
  hasAtlasMap,
  type AtlasPoint,
} from '@shared/lib/game/mapAtlas';
import {
  getAtlasCategory,
  getAtlasShortName,
  type AtlasCategory,
} from '@shared/lib/game/mapAtlasCategories';
import * as Phaser from 'phaser';
import { ATLAS_CATEGORY_STYLE } from './atlasMarkerStyle';

export interface AtlasView {
  region: 'world' | keyof typeof ATLAS_ANCHORS;
  selectedId: string | null;
  blocked: boolean;
  categories: readonly AtlasCategory[];
  focusId: string | null;
  focusRequest: number;
  occlusions: { x: number; y: number; width: number; height: number }[];
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
  onClear: () => void;
  onOverlap: (ids: string[]) => void;
  onSelectionPosition: (right: boolean, bottom: boolean) => void;
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
  mulan: '/assets/maps/mulan-region-v1.webp',
  dajin: '/assets/maps/dajin-region-v1.webp',
  nanjiang: '/assets/maps/nanjiang-region-v1.webp',
  northland: '/assets/maps/northland-region-v1.webp',
} satisfies Record<AtlasView['region'], string>;
const INITIAL_FOCUS: Partial<Record<AtlasView['region'], AtlasPoint>> = {
  luanxinghai: ATLAS_ANCHORS.luanxinghai.LX_INNER_01,
  dajin: ATLAS_ANCHORS.dajin.DJ_CENTRAL_01,
  northland: ATLAS_ANCHORS.northland.DJ_NORTH_01,
};
const INK = 0x352f29;
const CINNABAR = 0x9d4033;
// Only camera snapshots survive page navigation; no textures or player state.
const cameraMemory = new Map<string, { x: number; y: number; zoom: number }>();

interface Marker {
  id: string;
  x: number;
  y: number;
  primary: boolean;
  enabled: boolean;
  category?: AtlasCategory;
  name: string;
  shortName: string;
  label: Phaser.GameObjects.Text;
  symbol: Phaser.GameObjects.Container;
  plate: Phaser.GameObjects.Arc | Phaser.GameObjects.Graphics;
  icon?: Phaser.GameObjects.Image;
  capsuleStyle?: string;
  hitBoxes: Phaser.Geom.Rectangle[];
  labelOffset?: { x: number; y: number };
}

export function attachAtlasPhaser(args: AtlasArguments): AtlasController {
  let view = args.view;
  const readPixelRatio = () => Math.min(window.devicePixelRatio || 1, 3);
  let pixelRatio = readPixelRatio();
  let destroyed = false;
  const runtime: { scene?: AtlasScene } = {};
  let gestureMoved = false;
  let pressedAt = { x: 0, y: 0 };
  const pointers = new Map<number, { x: number; y: number }>();

  class AtlasScene extends Phaser.Scene {
    private markers: Marker[] = [];
    private shownRegion?: AtlasView['region'];
    private selectedId: string | null = null;
    private focusedId: string | null = null;
    private searchFocusId: string | null = null;
    private focusRequest = -1;
    private minZoom = 1;
    private loadFailed = false;
    private background?: Phaser.GameObjects.Image;

    preload() {
      this.load.on(Phaser.Loader.Events.FILE_LOAD_ERROR, () => {
        this.loadFailed = true;
        args.onError('舆图加载未成，请重试。');
      });

      for (const style of Object.values(ATLAS_CATEGORY_STYLE)) {
        this.load.image(style.icon, GameIcon.resolveSource(style.icon)!);
      }
    }

    create() {
      runtime.scene = this;
      this.cameras.main.setBackgroundColor('#eee7d8');
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
        this.markers.forEach(({ label, symbol }) => {
          label.destroy();
          symbol.destroy();
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
              hasAtlasMap(region.id)
                ? `${region.name} ›`
                : `${region.name} · 未开放`,
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
            this.addMarker(
              location.id,
              location.name,
              point[0],
              point[1],
              primary,
              true,
              getAtlasCategory(location),
              getAtlasShortName(location),
            );
          }
        }
        this.shownRegion = view.region;
        this.selectedId = null;
        this.fitViewport();
        const saved = cameraMemory.get(view.region);
        if (saved) {
          camera
            .setZoom(Math.max(this.minZoom, saved.zoom * pixelRatio))
            .centerOn(saved.x, saved.y);
          this.clampCamera();
        } else {
          const focus = INITIAL_FOCUS[view.region];
          if (focus) {
            camera.centerOn(focus[0] * WIDTH, focus[1] * HEIGHT);
            this.clampCamera();
          }
        }
      }
      const target = this.markers.find(
        (marker) => marker.id === view.selectedId,
      );
      if (
        target &&
        view.focusId === target.id &&
        (this.searchFocusId !== view.focusId ||
          this.focusRequest !== view.focusRequest)
      ) {
        // Returning from gameplay restores the saved camera; explicit searches still locate.
        if (this.focusRequest !== -1 || !cameraMemory.has(view.region)) {
          camera.setZoom(Math.max(camera.zoom, this.minZoom * 2));
          camera.centerOn(target.x, target.y);
          this.clampCamera();
        }
      }
      this.searchFocusId = view.focusId;
      if (
        target &&
        (this.selectedId !== view.selectedId ||
          (view.focusId === target.id &&
            this.focusRequest !== view.focusRequest))
      ) {
        camera.preRender();
        let x =
          ((target.x - camera.midPoint.x) * camera.zoom) / pixelRatio +
          camera.width / pixelRatio / 2;
        let y =
          ((target.y - camera.midPoint.y) * camera.zoom) / pixelRatio +
          camera.height / pixelRatio / 2;
        if (
          x < 24 ||
          y <
            (view.occlusions[0]?.y ?? 0) + (view.occlusions[0]?.height ?? 88) ||
          x > camera.width / pixelRatio - 24 ||
          y > camera.height / pixelRatio - 72
        ) {
          camera.centerOn(target.x, target.y);
          this.clampCamera();
          x =
            ((target.x - camera.midPoint.x) * camera.zoom) / pixelRatio +
            camera.width / pixelRatio / 2;
          y =
            ((target.y - camera.midPoint.y) * camera.zoom) / pixelRatio +
            camera.height / pixelRatio / 2;
        }
        args.onSelectionPosition(
          x < camera.width / pixelRatio / 2,
          y < (camera.height / pixelRatio) * 0.55,
        );
      }
      this.focusRequest = view.focusRequest;
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
      enabled: boolean,
      category?: AtlasCategory,
      shortName = name,
    ) {
      const world = view.region === 'world';
      const plate = world ? this.add.circle(0, 0, 5, INK) : this.add.graphics();
      const symbol = this.add.container(x * WIDTH, y * HEIGHT, [plate]);
      let icon: Phaser.GameObjects.Image | undefined;
      if (!world) {
        const style = ATLAS_CATEGORY_STYLE[category!];
        const iconSize = style.shape === 'diamond' ? 32 : 40;
        icon = this.add
          .image(26, 26, style.icon)
          .setDisplaySize(iconSize, iconSize);
        symbol.add(icon);
      }
      const label = this.add
        .text(0, 0, shortName, {
          fontFamily: 'LXGWWenKai, serif',
          fontSize: world
            ? enabled
              ? '24px'
              : '18px'
            : primary
              ? '16px'
              : '14px',
          color: '#352f29',
          backgroundColor: world ? '#f6efdf' : undefined,
          padding: { x: world ? 12 : 0, y: world ? 8 : 0 },
        })
        .setResolution(pixelRatio);
      this.markers.push({
        id,
        x: x * WIDTH,
        y: y * HEIGHT,
        primary,
        enabled,
        category,
        name,
        shortName,
        symbol,
        plate,
        icon,
        label,
        hitBoxes: [],
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
          zoom: camera.zoom / pixelRatio,
        });
    }

    resize(center?: { x: number; y: number }, densityChange = 1) {
      const camera = this.cameras.main;
      const wasFit = Math.abs(camera.zoom - this.minZoom) < 0.001;
      camera.setZoom(camera.zoom * densityChange);
      for (const marker of this.markers) {
        if (marker.label.style.resolution !== pixelRatio)
          marker.label.setResolution(pixelRatio);
      }
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
      const before = camera.getWorldPoint(x * pixelRatio, y * pixelRatio);
      camera.setZoom(
        Phaser.Math.Clamp(
          camera.zoom * factor,
          this.minZoom,
          Math.max(2.5 * pixelRatio, this.minZoom * 5),
        ),
      );
      camera.preRender();
      const after = camera.getWorldPoint(x * pixelRatio, y * pixelRatio);
      camera.scrollX += before.x - after.x;
      camera.scrollY += before.y - after.y;
      this.clampCamera();
      this.layoutMarkers();
    }

    pan(dx: number, dy: number) {
      this.cameras.main.scrollX -= (dx * pixelRatio) / this.cameras.main.zoom;
      this.cameras.main.scrollY -= (dy * pixelRatio) / this.cameras.main.zoom;
      this.clampCamera();
      this.layoutMarkers();
    }

    private hits(x: number, y: number) {
      // Regional capsules have one hit box; world dots and names stay separate.
      return this.markers.filter((marker) =>
        marker.hitBoxes.some((box) => box.contains(x, y)),
      );
    }

    pick(x: number, y: number) {
      const hits = this.hits(x, y);
      if (!hits.length) {
        args.onClear();
        return;
      }
      if (view.region === 'world') {
        const marker = hits.find((item) => item.enabled);
        if (marker) args.onRegion(marker.id);
      } else if (hits.length > 1)
        args.onOverlap(hits.map((marker) => marker.id));
      else args.onNode(hits[0].id);
    }

    hover(x: number, y: number) {
      const next = this.hits(x, y)[0]?.id ?? null;
      if (this.focusedId !== next) {
        this.focusedId = next;
        this.layoutMarkers();
      }
      return !!next;
    }

    key(event: KeyboardEvent) {
      if (event.key === 'Escape') {
        args.onClear();
        return;
      }
      const visible = this.markers.filter(
        (marker) => marker.hitBoxes.length && marker.enabled,
      );
      if (!visible.length) return;
      if (
        ['ArrowRight', 'ArrowDown', 'ArrowLeft', 'ArrowUp'].includes(event.key)
      ) {
        event.preventDefault();
        const index = visible.findIndex(
          (marker) => marker.id === this.focusedId,
        );
        const delta =
          event.key === 'ArrowLeft' || event.key === 'ArrowUp' ? -1 : 1;
        this.focusedId =
          visible[
            index < 0
              ? delta > 0
                ? 0
                : visible.length - 1
              : (index + delta + visible.length) % visible.length
          ].id;
        this.sys.game.canvas.setAttribute(
          'aria-label',
          `${visible.find((marker) => marker.id === this.focusedId)?.name}，按回车选择，方向键切换地点`,
        );
        this.layoutMarkers();
      } else if (event.key === 'Enter' || event.key === ' ') {
        event.preventDefault();
        const marker = visible.find((item) => item.id === this.focusedId);
        if (marker) {
          if (view.region === 'world') args.onRegion(marker.id);
          else args.onNode(marker.id);
        }
      }
    }

    private drawCapsule(
      marker: Marker,
      width: number,
      height: number,
      expanded: boolean,
      selected: boolean,
      focused: boolean,
    ) {
      const key = `${width}:${height}:${expanded}:${selected}:${focused}`;
      if (marker.capsuleStyle === key) return;
      marker.capsuleStyle = key;
      const plate = marker.plate as Phaser.GameObjects.Graphics;
      const style = ATLAS_CATEGORY_STYLE[marker.category!];
      const edge = selected ? CINNABAR : style.color;
      const lineWidth = selected ? 2.5 : focused ? 2 : 1.25;
      const center = height / 2;
      plate.clear().lineStyle(lineWidth, edge, focused || selected ? 1 : 0.8);
      if (expanded) {
        // The narrow name capsule tucks beneath the larger category badge.
        const bodyHeight = height - 16;
        plate.fillStyle(focused ? 0xfffbf2 : style.paper);
        plate.fillRoundedRect(
          center,
          8,
          width - center,
          bodyHeight,
          bodyHeight / 2,
        );
        plate.strokeRoundedRect(
          center,
          8,
          width - center,
          bodyHeight,
          bodyHeight / 2,
        );
      }
      plate.fillStyle(style.badge);
      if (style.shape === 'round') {
        plate.fillCircle(center, center, center - 1.5);
        plate.strokeCircle(center, center, center - 1.5);
      } else if (style.shape === 'square') {
        plate.fillRoundedRect(2, 2, height - 4, height - 4, 10);
        plate.strokeRoundedRect(2, 2, height - 4, height - 4, 10);
      } else if (style.shape === 'arch') {
        const radius = { tl: center - 2, tr: center - 2, bl: 7, br: 7 };
        plate.fillRoundedRect(2, 2, height - 4, height - 4, radius);
        plate.strokeRoundedRect(2, 2, height - 4, height - 4, radius);
      } else {
        const vertices =
          style.shape === 'diamond'
            ? [
                [0.5, 0.02],
                [0.98, 0.5],
                [0.5, 0.98],
                [0.02, 0.5],
              ]
            : [
                [0.5, 0.02],
                [0.94, 0.24],
                [0.94, 0.76],
                [0.5, 0.98],
                [0.06, 0.76],
                [0.06, 0.24],
              ];
        const points = vertices.map(
          ([x, y]) => new Phaser.Math.Vector2(x * height, y * height),
        );
        plate.fillPoints(points, true);
        plate.strokePoints(points, true);
      }
    }

    // Layout and hit areas use CSS pixels; the camera renders in device pixels.
    // Snap text origins after projection so fractional camera pans don't blur glyphs.
    private labelWorldPoint(x: number, y: number) {
      return this.cameras.main.getWorldPoint(
        Math.round(x * pixelRatio),
        Math.round(y * pixelRatio),
      );
    }

    private layoutCapsule(
      marker: Marker,
      screen: { x: number; y: number },
      safeTop: number,
      occupied: Phaser.Geom.Rectangle[],
      obstacles: Phaser.Geom.Rectangle[],
    ) {
      const camera = this.cameras.main;
      const selected = marker.id === view.selectedId;
      const focused = marker.id === this.focusedId;
      const { label, symbol, icon } = marker;
      const text = selected || focused ? marker.name : marker.shortName;
      if (label.text !== text) label.setText(text);
      const wrapWidth = Math.max(
        40,
        Math.min(192, camera.width / pixelRatio - 104),
      );
      if (label.style.wordWrapWidth !== wrapWidth)
        label.setWordWrapWidth(wrapWidth, true);
      const height = Math.max(52, label.height + 28);
      const width = height + label.width + 18;
      const makeBox = (left: number, top: number, w: number, h: number) =>
        new Phaser.Geom.Rectangle(
          Phaser.Math.Clamp(
            left,
            4,
            Math.max(4, camera.width / pixelRatio - w - 4),
          ),
          Phaser.Math.Clamp(
            top,
            Math.min(safeTop, Math.max(4, camera.height / pixelRatio - h - 4)),
            Math.max(4, camera.height / pixelRatio - h - 4),
          ),
          w,
          h,
        );
      // Icons always lead on the left; only the whole capsule shifts to avoid collisions.
      const candidates = [
        ...(focused && marker.labelOffset
          ? [
              makeBox(
                screen.x + marker.labelOffset.x,
                screen.y + marker.labelOffset.y,
                width,
                height,
              ),
            ]
          : []),
        ...[0, -26, 26].map((offset) =>
          makeBox(
            screen.x - height / 2,
            screen.y - height / 2 + offset,
            width,
            height,
          ),
        ),
      ];
      const clearOf = (
        box: Phaser.Geom.Rectangle,
        others: Phaser.Geom.Rectangle[],
      ) =>
        !others.some((other) =>
          Phaser.Geom.Intersects.RectangleToRectangle(box, other),
        );
      let placement = candidates.find((box) => clearOf(box, occupied));
      if (!placement && (selected || focused))
        placement =
          candidates.find((box) => clearOf(box, obstacles)) ?? candidates[0];
      // Dense nodes retain the category's colour and silhouette as a compact badge.
      const box = placement ?? makeBox(screen.x - 26, screen.y - 26, 52, 52);
      marker.labelOffset = { x: box.x - screen.x, y: box.y - screen.y };
      const depth = selected ? 30 : focused ? 20 : 10;
      const position = this.labelWorldPoint(box.x, box.y);
      symbol
        .setPosition(position.x, position.y)
        .setScale(pixelRatio / camera.zoom)
        .setDepth(depth)
        .setVisible(true);
      this.drawCapsule(
        marker,
        box.width,
        box.height,
        !!placement,
        selected,
        focused,
      );
      icon!.setPosition(box.height / 2, box.height / 2);
      if (placement) {
        const textPosition = this.labelWorldPoint(
          box.x + box.height + 2,
          box.y + (box.height - label.height) / 2,
        );
        label
          .setPosition(textPosition.x, textPosition.y)
          .setScale(pixelRatio / camera.zoom)
          .setDepth(depth + 1)
          .setVisible(true);
        const textColor = selected ? '#9d4033' : '#352f29';
        if (label.style.color !== textColor) label.setColor(textColor);
      }
      occupied.push(box);
      marker.hitBoxes.push(box);
    }

    private layoutMarkers() {
      const camera = this.cameras.main;
      camera.preRender();
      const obstacles = view.occlusions.map(
        (rect) =>
          new Phaser.Geom.Rectangle(rect.x, rect.y, rect.width, rect.height),
      );
      const safeTop = Math.max(
        4,
        (view.occlusions[0]?.y ?? 0) + (view.occlusions[0]?.height ?? 88) + 4,
      );
      const occupied = [...obstacles];
      const shown = this.markers.filter(
        (marker) =>
          view.region === 'world' ||
          !view.categories.length ||
          (!!marker.category && view.categories.includes(marker.category)),
      );
      for (const marker of this.markers) {
        marker.hitBoxes = [];
        marker.label.setVisible(false);
        marker.symbol.setVisible(false);
      }
      const points = new Map<string, { x: number; y: number }>();
      const reservations = new Map<string, Phaser.Geom.Rectangle>();
      for (const marker of shown) {
        const point = {
          x:
            ((marker.x - camera.midPoint.x) * camera.zoom) / pixelRatio +
            camera.width / pixelRatio / 2,
          y:
            ((marker.y - camera.midPoint.y) * camera.zoom) / pixelRatio +
            camera.height / pixelRatio / 2,
        };
        if (
          point.x < -22 ||
          point.y < -22 ||
          point.x > camera.width / pixelRatio + 22 ||
          point.y > camera.height / pixelRatio + 22
        )
          continue;
        points.set(marker.id, point);
        // Labels must avoid every symbol, including symbols laid out later.
        const reservation = new Phaser.Geom.Rectangle(
          point.x - (view.region === 'world' ? 8 : 26),
          point.y - (view.region === 'world' ? 8 : 26),
          view.region === 'world' ? 16 : 52,
          view.region === 'world' ? 16 : 52,
        );
        reservations.set(marker.id, reservation);
        occupied.push(reservation);
      }
      const ordered = [...shown].sort((a, b) => {
        const priority = (m: Marker) =>
          (m.id === view.selectedId ? 100 : 0) +
          (m.id === this.focusedId ? 10 : 0) +
          (m.primary ? 1 : 0);
        return priority(b) - priority(a);
      });
      for (const marker of ordered) {
        const screen = points.get(marker.id);
        if (!screen) continue;
        const selected = marker.id === view.selectedId;
        const focused = marker.id === this.focusedId;
        const { label, symbol, plate } = marker;
        const world = view.region === 'world';
        if (!world) {
          occupied.splice(occupied.indexOf(reservations.get(marker.id)!), 1);
          this.layoutCapsule(marker, screen, safeTop, occupied, obstacles);
          continue;
        }
        const depth = selected ? 30 : focused ? 20 : 10;
        symbol
          .setVisible(true)
          .setScale(pixelRatio / camera.zoom)
          .setDepth(depth + 1);
        (plate as Phaser.GameObjects.Arc).setStrokeStyle(
          selected ? 2.5 : focused ? 1.5 : 0,
          selected ? CINNABAR : INK,
          selected || focused ? 1 : 0.35,
        );
        const iconBox = new Phaser.Geom.Rectangle(
          screen.x - 24,
          screen.y - 24,
          48,
          48,
        );
        marker.hitBoxes.push(iconBox);
        const text = selected ? marker.name : marker.shortName;
        if (label.text !== text) label.setText(text);
        const wrapWidth = Math.max(60, camera.width / pixelRatio - 40);
        if (label.style.wordWrapWidth !== wrapWidth)
          label.setWordWrapWidth(wrapWidth, true);
        const width = label.width;
        const height = label.height;
        const candidates = [
          ...(focused && marker.labelOffset
            ? [
                [
                  screen.x + marker.labelOffset.x,
                  screen.y + marker.labelOffset.y,
                ],
              ]
            : []),
          [screen.x + 12, screen.y - height / 2],
          [screen.x - width - 30, screen.y - height / 2],
          [screen.x - width / 2, screen.y + 30],
          [screen.x - width / 2, screen.y - height - 30],
        ];
        const boxes = candidates.map(
          ([left, top]) =>
            new Phaser.Geom.Rectangle(
              Phaser.Math.Clamp(
                left,
                4,
                Math.max(4, camera.width / pixelRatio - width - 4),
              ),
              Phaser.Math.Clamp(
                top,
                Math.min(
                  safeTop,
                  Math.max(4, camera.height / pixelRatio - height - 4),
                ),
                Math.max(4, camera.height / pixelRatio - height - 4),
              ),
              width,
              height,
            ),
        );
        const intersects = (
          a: Phaser.Geom.Rectangle,
          b: Phaser.Geom.Rectangle,
        ) => Phaser.Geom.Intersects.RectangleToRectangle(a, b);
        let box = boxes.find(
          (candidate) =>
            !occupied.some((other) => intersects(candidate, other)),
        );
        // Selected/focused names remain readable even in a dense cluster.
        if (!box && (selected || focused))
          box =
            boxes.find(
              (candidate) =>
                !obstacles.some((other) => intersects(candidate, other)),
            ) ?? boxes[0];
        if (!box) continue;
        occupied.push(box);
        marker.labelOffset = { x: box.x - screen.x, y: box.y - screen.y };
        const position = this.labelWorldPoint(box.x, box.y);
        label
          .setPosition(position.x, position.y)
          .setScale(pixelRatio / camera.zoom)
          .setDepth(depth + 2)
          .setVisible(true);
        const textColor = selected
          ? '#9d4033'
          : world && !marker.enabled
            ? '#756e63'
            : '#352f29';
        const backgroundColor = focused ? '#e9dfca' : '#f6efdf';
        if (label.style.color !== textColor) label.setColor(textColor);
        if (label.style.backgroundColor !== backgroundColor)
          label.setBackgroundColor(backgroundColor);
        marker.hitBoxes.push(box);
      }
    }
  }

  const game = new Phaser.Game({
    type: Phaser.AUTO,
    parent: args.root,
    width: Math.max(1, Math.round(args.root.clientWidth * pixelRatio)),
    height: Math.max(1, Math.round(args.root.clientHeight * pixelRatio)),
    scale: { zoom: 1 / pixelRatio },
    backgroundColor: '#eee7d8',
    banner: false,
    audio: { noAudio: true },
    input: { mouse: false, touch: false, keyboard: false },
    scene: AtlasScene,
  });
  const canvas = game.canvas;
  canvas.setAttribute(
    'aria-label',
    '山河舆图，方向键切换地点，回车选择，Escape 取消；也可使用查找地点列表',
  );
  canvas.tabIndex = 0;
  canvas.style.touchAction = 'none';
  canvas.style.cursor = 'grab';
  const point = (event: PointerEvent | WheelEvent) => {
    const rect = canvas.getBoundingClientRect();
    return {
      x:
        ((event.clientX - rect.left) * game.scale.width) /
        rect.width /
        pixelRatio,
      y:
        ((event.clientY - rect.top) * game.scale.height) /
        rect.height /
        pixelRatio,
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
    if (view.blocked) return;
    if (!pointers.has(event.pointerId)) {
      if (event.pointerType === 'mouse') {
        const p = point(event);
        canvas.style.cursor = runtime.scene?.hover(p.x, p.y)
          ? 'pointer'
          : 'grab';
      }
      return;
    }
    const before = [...pointers.values()];
    const old = pointers.get(event.pointerId)!;
    const next = point(event);
    pointers.set(event.pointerId, next);
    if (Math.hypot(next.x - pressedAt.x, next.y - pressedAt.y) > 6)
      gestureMoved = true;
    if (pointers.size === 1 && gestureMoved)
      runtime.scene?.pan(next.x - old.x, next.y - old.y);
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
  const keydown = (event: KeyboardEvent) => {
    if (!view.blocked) runtime.scene?.key(event);
  };
  const leave = () => {
    runtime.scene?.hover(-100, -100);
  };
  const contextLost = () => args.onError('画卷暂时无法显示，请重试。');
  canvas.addEventListener('keydown', keydown);
  canvas.addEventListener('pointerleave', leave);
  canvas.addEventListener('blur', leave);
  canvas.addEventListener('pointerdown', down);
  canvas.addEventListener('pointermove', move);
  canvas.addEventListener('pointerup', up);
  canvas.addEventListener('pointercancel', up);
  canvas.addEventListener('lostpointercapture', up);
  canvas.addEventListener('wheel', wheel, { passive: false });
  canvas.addEventListener('webglcontextlost', contextLost);
  const resizeCanvas = () => {
    const camera = runtime.scene?.cameras.main;
    const center = camera
      ? {
          x: camera.scrollX + camera.width / 2,
          y: camera.scrollY + camera.height / 2,
        }
      : undefined;
    const previousRatio = pixelRatio;
    pixelRatio = readPixelRatio();
    if (pixelRatio !== previousRatio) game.scale.setZoom(1 / pixelRatio);
    game.scale.resize(
      Math.max(1, Math.round(args.root.clientWidth * pixelRatio)),
      Math.max(1, Math.round(args.root.clientHeight * pixelRatio)),
    );
    runtime.scene?.resize(center, pixelRatio / previousRatio);
  };
  const resize = new ResizeObserver(resizeCanvas);
  resize.observe(args.root);
  window.addEventListener('resize', resizeCanvas);

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
      window.removeEventListener('resize', resizeCanvas);
      canvas.removeEventListener('keydown', keydown);
      canvas.removeEventListener('pointerleave', leave);
      canvas.removeEventListener('blur', leave);
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
