import {
  createMiningField,
  MINING_CANVAS,
  MINING_CAST_SPEED,
  MINING_DURATION_MS,
  MINING_EMPTY_RETRACT_SPEED,
  MINING_EXPLOSION_RADIUS,
  MINING_HOOK_ORIGIN,
  MINING_ORE_KINDS,
  miningAimAngleAt,
  miningScoreTier,
  simulateMiningTranscript,
  type MiningCastInput,
  type MiningOreKind,
  type MiningScoreTier,
  type MiningTarget,
  type MiningTargetKind,
} from '@daoyou/shared/engine/sect';
import * as Phaser from 'phaser';

const TARGET_TEXTURES: Record<MiningTargetKind, string> = {
  spirit_crystal: 'mining-spirit-crystal',
  copper_ore: 'mining-copper-ore',
  dark_iron: 'mining-dark-iron',
  earth_essence: 'mining-earth-essence',
  explosive_barrel: 'mining-explosive-barrel',
};

export interface MiningGameProgress {
  score: number;
  maxScore: number;
  collected: number;
  destroyed: number;
  total: number;
  elapsedMs: number;
  remainingMs: number;
  casts: number;
  hookBusy: boolean;
  ores: Array<{
    kind: MiningOreKind;
    count: number;
    score: number;
  }>;
  tier?: MiningScoreTier;
}

export interface MiningPhaserController {
  drop: () => void;
  destroy: () => void;
}

interface MiningPhaserArguments {
  root: HTMLElement;
  seed: string;
  canvasLabel: string;
  onState: (progress: MiningGameProgress) => void;
  onComplete: (casts: MiningCastInput[], progress: MiningGameProgress) => void;
  onError: (message: string) => void;
}

interface ActiveHook {
  cast: MiningCastInput;
  direction: { x: number; y: number };
  distance: number;
  outboundMs: number;
  totalMs: number;
  caughtId?: string;
  caughtKind?: MiningTargetKind;
  caughtRadius?: number;
  destroyedOreIds: string[];
  detonated: boolean;
}

function direction(angleMilliDegrees: number) {
  const radians = (angleMilliDegrees / 1_000 / 180) * Math.PI;
  return { x: Math.sin(radians), y: Math.cos(radians) };
}

function emptyDistance(durationMs: number): number {
  return (
    durationMs /
    1_000 /
    (1 / MINING_CAST_SPEED + 1 / MINING_EMPTY_RETRACT_SPEED)
  );
}

function targetDisplaySize(target: MiningTarget): number {
  return Math.round(
    target.radius * (target.category === 'hazard' ? 2.35 : 2.2),
  );
}

function fitImageToDiameter(
  sprite: Phaser.GameObjects.Image,
  diameter: number,
) {
  const longestSide = Math.max(sprite.width, sprite.height);
  sprite.setScale(diameter / longestSide);
}

export function attachMiningPhaser(
  args: MiningPhaserArguments,
): MiningPhaserController {
  const renderScale = Math.min(Math.max(window.devicePixelRatio || 1, 1), 2);
  let sceneDrop: (() => void) | undefined;
  let destroyed = false;

  class MiningScene extends Phaser.Scene {
    private field = createMiningField(args.seed);
    private targetSprites = new Map<string, Phaser.GameObjects.Container>();
    private casts: MiningCastInput[] = [];
    private collected = new Set<string>();
    private destroyedOres = new Set<string>();
    private startedAt = 0;
    private activeHook?: ActiveHook;
    private rope?: Phaser.GameObjects.Graphics;
    private hook?: Phaser.GameObjects.Image;
    private caughtSprite?: Phaser.GameObjects.Container;
    private reportedComplete = false;
    private score = 0;

    preload() {
      this.load.once(
        Phaser.Loader.Events.FILE_LOAD_ERROR,
        (file: Phaser.Loader.File) =>
          args.onError(`美术资源加载失败：${file.key}`),
      );
      this.load.image(
        'mining-background',
        '/assets/sect/mining/spirit-vein-cavern.webp',
      );
      this.load.image(
        'mining-cultivator',
        '/assets/sect/mining/rope-cultivator.webp',
      );
      this.load.image('mining-hook', '/assets/sect/mining/spirit-hook.webp');
      this.load.image(
        'mining-spirit-crystal',
        '/assets/sect/mining/spirit-crystal.webp',
      );
      this.load.image(
        'mining-copper-ore',
        '/assets/sect/mining/copper-ore.webp',
      );
      this.load.image('mining-dark-iron', '/assets/sect/mining/dark-iron.webp');
      this.load.image(
        'mining-earth-essence',
        '/assets/sect/mining/earth-essence.webp',
      );
      this.load.image(
        'mining-explosive-barrel',
        '/assets/sect/mining/explosive-barrel.webp',
      );
    }

    create() {
      sceneDrop = () => this.dropHook();
      this.cameras.main
        .setZoom(renderScale)
        .centerOn(MINING_CANVAS.width / 2, MINING_CANVAS.height / 2);
      this.add
        .image(
          MINING_CANVAS.width / 2,
          MINING_CANVAS.height / 2,
          'mining-background',
        )
        .setDisplaySize(MINING_CANVAS.width, MINING_CANVAS.height)
        .setDepth(0);
      this.add
        .rectangle(
          MINING_CANVAS.width / 2,
          MINING_CANVAS.height / 2,
          MINING_CANVAS.width,
          MINING_CANVAS.height,
          0x07100f,
          0.18,
        )
        .setDepth(0.2);
      this.createTargets();
      this.add
        .image(MINING_HOOK_ORIGIN.x, 126, 'mining-cultivator')
        .setDisplaySize(180, 180)
        .setDepth(5);
      this.rope = this.add.graphics().setDepth(3.5);
      this.hook = this.add
        .image(MINING_HOOK_ORIGIN.x, MINING_HOOK_ORIGIN.y, 'mining-hook')
        .setDisplaySize(42, 54)
        .setOrigin(0.5, 0.06)
        .setDepth(4);
      this.startedAt = performance.now();
      this.bindInput();
      this.reportState(0);
      const canvas = this.game.canvas;
      canvas.setAttribute('aria-label', args.canvasLabel);
      canvas.setAttribute('role', 'application');
    }

    update() {
      if (this.reportedComplete) return;
      const elapsed = Math.max(0, performance.now() - this.startedAt);
      if (this.activeHook) this.updateHook(elapsed);
      else this.updateAim(elapsed);
      this.reportState(elapsed);
      if (
        (elapsed >= MINING_DURATION_MS ||
          this.collected.size + this.destroyedOres.size ===
            this.oreTargets.length) &&
        !this.activeHook
      )
        this.finish(elapsed);
    }

    private get oreTargets() {
      return this.field.filter((target) => target.category === 'ore');
    }

    private createTargets() {
      for (const target of this.field) {
        const aura = this.createTargetAura(target);
        const size = targetDisplaySize(target);
        const sprite = this.add.image(0, 0, TARGET_TEXTURES[target.kind]);
        fitImageToDiameter(sprite, size);
        const container = this.add
          .container(
            Math.round(target.x),
            Math.round(target.y),
            [aura, sprite],
          )
          .setAngle(((target.x * 7 + target.y * 11) % 22) - 11)
          .setDepth(2 + target.y / 10_000);
        this.targetSprites.set(target.id, container);
      }
    }

    private createTargetAura(target: MiningTarget) {
      const aura = this.add.graphics();
      const value =
        target.category === 'hazard'
          ? { color: 0xff5a36, alpha: 0.7, rings: 2 }
          : target.score >= 500
            ? { color: 0xffd86b, alpha: 0.75, rings: 3 }
            : target.score >= 300
              ? { color: 0xcf8cff, alpha: 0.62, rings: 2 }
              : target.score >= 180
                ? { color: 0x70dfff, alpha: 0.48, rings: 2 }
                : { color: 0x64d7bd, alpha: 0.26, rings: 1 };
      for (let ring = 0; ring < value.rings; ring += 1) {
        aura
          .lineStyle(2 - ring * 0.35, value.color, value.alpha / (ring + 1))
          .strokeCircle(0, 0, target.radius * (1.08 + ring * 0.13));
      }
      aura.setBlendMode(Phaser.BlendModes.ADD);
      this.tweens.add({
        targets: aura,
        alpha: Math.max(0.3, value.alpha - 0.22),
        scale: 1.08,
        duration: 900 + (target.id.length % 4) * 170,
        ease: 'Sine.InOut',
        yoyo: true,
        repeat: -1,
      });
      return aura;
    }

    private bindInput() {
      this.input.on('pointerdown', this.dropHook, this);
      const keyboard = this.input.keyboard;
      if (!keyboard) return;
      const onKeyDown = (event: KeyboardEvent) => {
        if (!['Space', 'ArrowDown', 'KeyS'].includes(event.code)) return;
        event.preventDefault();
        if (!event.repeat) this.dropHook();
      };
      keyboard.on('keydown', onKeyDown);
      this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => {
        this.input.off('pointerdown', this.dropHook, this);
        keyboard.off('keydown', onKeyDown);
      });
    }

    private dropHook() {
      if (this.activeHook || this.reportedComplete) return;
      const elapsed = Math.floor(performance.now() - this.startedAt);
      if (elapsed < 0 || elapsed >= MINING_DURATION_MS) return;
      const cast: MiningCastInput = {
        atMs: elapsed,
        angleMilliDegrees: Math.round(miningAimAngleAt(elapsed)),
      };
      const nextCasts = [...this.casts, cast];
      const simulation = simulateMiningTranscript(args.seed, nextCasts);
      if (!simulation.valid) {
        args.onError('灵索轨迹无法记录，请重新进入矿脉。');
        return;
      }
      this.casts = nextCasts;
      const caught = simulation.catches.find(
        (entry) => entry.castIndex === this.casts.length - 1,
      );
      const totalMs = simulation.availableAtMs - cast.atMs;
      const distance = caught?.distance ?? emptyDistance(totalMs);
      const outboundMs = (distance / MINING_CAST_SPEED) * 1_000;
      this.activeHook = {
        cast,
        direction: direction(cast.angleMilliDegrees),
        distance,
        outboundMs,
        totalMs,
        ...(caught
          ? {
              caughtId: caught.targetId,
              caughtKind: caught.kind,
              caughtRadius: caught.radius,
            }
          : {}),
        destroyedOreIds: caught?.destroyedOreIds ?? [],
        detonated: false,
      };
    }

    private updateAim(elapsed: number) {
      const angle = miningAimAngleAt(elapsed);
      const aimDirection = direction(angle);
      this.drawHook(
        MINING_HOOK_ORIGIN.x + aimDirection.x * 58,
        MINING_HOOK_ORIGIN.y + aimDirection.y * 58,
        angle,
      );
    }

    private updateHook(elapsed: number) {
      const active = this.activeHook;
      if (!active) return;
      const hookElapsed = elapsed - active.cast.atMs;
      const retractMs = active.totalMs - active.outboundMs;
      const distance =
        hookElapsed <= active.outboundMs
          ? active.distance * (hookElapsed / active.outboundMs)
          : active.distance *
            Math.max(0, 1 - (hookElapsed - active.outboundMs) / retractMs);
      const x = MINING_HOOK_ORIGIN.x + active.direction.x * distance;
      const y = MINING_HOOK_ORIGIN.y + active.direction.y * distance;
      this.drawHook(x, y, active.cast.angleMilliDegrees);

      if (
        active.caughtKind === 'explosive_barrel' &&
        hookElapsed >= active.outboundMs &&
        !active.detonated
      ) {
        this.detonate(active);
      } else if (
        active.caughtId &&
        active.caughtKind !== 'explosive_barrel' &&
        hookElapsed >= active.outboundMs
      ) {
        const sprite = this.targetSprites.get(active.caughtId);
        if (sprite) {
          this.caughtSprite = sprite;
          sprite.setDepth(3.8);
          this.positionCaughtTarget(sprite, x, y, active);
        }
      }
      if (hookElapsed < active.totalMs) return;

      if (active.caughtId && active.caughtKind !== 'explosive_barrel') {
        const target = this.field.find(
          (candidate) => candidate.id === active.caughtId,
        );
        if (
          target?.category === 'ore' &&
          !this.collected.has(target.id)
        ) {
          this.collected.add(target.id);
          this.score += target.score;
        }
        this.destroyTargetVisual(active.caughtId);
      }
      this.caughtSprite = undefined;
      this.activeHook = undefined;
    }

    private drawHook(x: number, y: number, angleMilliDegrees: number) {
      this.rope
        ?.clear()
        .lineStyle(3.5, 0xd6c394, 0.92)
        .lineBetween(MINING_HOOK_ORIGIN.x, MINING_HOOK_ORIGIN.y, x, y);
      this.hook?.setPosition(x, y).setAngle(-angleMilliDegrees / 1_000);
      if (this.caughtSprite && this.activeHook)
        this.positionCaughtTarget(
          this.caughtSprite,
          x,
          y,
          this.activeHook,
        );
    }

    private positionCaughtTarget(
      sprite: Phaser.GameObjects.Container,
      hookX: number,
      hookY: number,
      active: ActiveHook,
    ) {
      const offset = 30 + (active.caughtRadius ?? 0) * 0.65;
      sprite.setPosition(
        hookX + active.direction.x * offset,
        hookY + active.direction.y * offset,
      );
    }

    private detonate(active: ActiveHook) {
      active.detonated = true;
      const target = active.caughtId
        ? this.field.find((candidate) => candidate.id === active.caughtId)
        : undefined;
      if (!target) return;
      this.destroyTargetVisual(target.id);
      for (const id of active.destroyedOreIds) {
        this.destroyedOres.add(id);
        this.destroyTargetVisual(id);
      }
      this.createExplosion(target.x, target.y);
    }

    private destroyTargetVisual(id: string) {
      this.targetSprites.get(id)?.destroy();
      this.targetSprites.delete(id);
    }

    private createExplosion(x: number, y: number) {
      const glow = this.add
        .circle(x, y, 24, 0xffb33f, 0.8)
        .setBlendMode(Phaser.BlendModes.ADD)
        .setDepth(6);
      const ring = this.add
        .circle(x, y, 18, 0xff5a36, 0)
        .setStrokeStyle(7, 0xffd273, 0.95)
        .setBlendMode(Phaser.BlendModes.ADD)
        .setDepth(6);
      this.cameras.main.shake(220, 0.006);
      this.tweens.add({
        targets: glow,
        scale: MINING_EXPLOSION_RADIUS / 24,
        alpha: 0,
        duration: 420,
        ease: 'Quad.Out',
        onComplete: () => glow.destroy(),
      });
      this.tweens.add({
        targets: ring,
        scale: MINING_EXPLOSION_RADIUS / 18,
        alpha: 0,
        duration: 560,
        ease: 'Cubic.Out',
        onComplete: () => ring.destroy(),
      });
    }

    private progress(elapsed: number): MiningGameProgress {
      const simulation = simulateMiningTranscript(args.seed, this.casts);
      const ores = MINING_ORE_KINDS.flatMap((kind) => {
        const collected = this.field.filter(
          (ore) => ore.kind === kind && this.collected.has(ore.id),
        );
        return collected.length
          ? [
              {
                kind,
                count: collected.length,
                score: collected.reduce((sum, ore) => sum + ore.score, 0),
              },
            ]
          : [];
      });
      return {
        score: this.score,
        maxScore: simulation.maxScore,
        collected: this.collected.size,
        destroyed: this.destroyedOres.size,
        total: this.oreTargets.length,
        elapsedMs: Math.floor(elapsed),
        remainingMs: Math.max(0, Math.ceil(MINING_DURATION_MS - elapsed)),
        casts: this.casts.length,
        hookBusy: Boolean(this.activeHook),
        ores,
        ...(miningScoreTier(this.score, simulation.maxScore)
          ? { tier: miningScoreTier(this.score, simulation.maxScore) }
          : {}),
      };
    }

    private reportState(elapsed: number) {
      args.onState(this.progress(elapsed));
    }

    private finish(elapsed: number) {
      if (this.reportedComplete) return;
      this.reportedComplete = true;
      const progress = this.progress(elapsed);
      args.onState(progress);
      args.onComplete([...this.casts], progress);
    }
  }

  const game = new Phaser.Game({
    type: Phaser.AUTO,
    parent: args.root,
    width: Math.round(MINING_CANVAS.width * renderScale),
    height: Math.round(MINING_CANVAS.height * renderScale),
    backgroundColor: '#091312',
    transparent: false,
    antialias: true,
    antialiasGL: true,
    pixelArt: false,
    roundPixels: false,
    scale: {
      mode: Phaser.Scale.FIT,
      autoCenter: Phaser.Scale.CENTER_BOTH,
      width: Math.round(MINING_CANVAS.width * renderScale),
      height: Math.round(MINING_CANVAS.height * renderScale),
    },
    scene: MiningScene,
  });

  return {
    drop: () => sceneDrop?.(),
    destroy: () => {
      if (destroyed) return;
      destroyed = true;
      sceneDrop = undefined;
      game.destroy(true);
    },
  };
}
