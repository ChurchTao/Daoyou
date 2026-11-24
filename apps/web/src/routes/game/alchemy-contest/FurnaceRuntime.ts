import type { ContestHeat } from '@daoyou/game-domain/alchemy/contest';
import * as Phaser from 'phaser';

const fireColors = {
  gentle: [111, 168, 134],
  steady: [200, 128, 64],
  fierce: [205, 70, 41],
} as const;

export function mountContestFurnace(
  parent: HTMLElement,
  furnaceUrl?: string,
  onReady?: () => void,
) {
  let redraw: (() => void) | undefined;
  let heat: ContestHeat = 'steady';
  let firing = false;
  let reveal = false;
  const motion = window.matchMedia('(prefers-reduced-motion: reduce)');
  const light = { red: 200, green: 128, blue: 64, opacity: 0.22, scale: 1 };

  class FurnaceScene extends Phaser.Scene {
    private aura?: Phaser.GameObjects.Arc;
    private embers?: Phaser.GameObjects.Ellipse;
    private pulse?: Phaser.GameObjects.Ellipse;

    preload() {
      if (furnaceUrl) this.load.image('contest-furnace', furnaceUrl);
    }

    create() {
      this.add
        .graphics()
        .lineStyle(1, 0x9f8c71, 0.38)
        .strokeEllipse(200, 314, 248, 65)
        .strokeEllipse(200, 314, 215, 47);
      this.aura = this.add.circle(200, 247, 78, 0xc88040, 0.22);
      this.pulse = this.add.ellipse(200, 314, 190, 41).setAlpha(0);
      if (this.textures.exists('contest-furnace')) {
        this.add.image(200, 215, 'contest-furnace').setDisplaySize(258, 258);
        onReady?.();
      }
      this.embers = this.add.ellipse(200, 280, 76, 33);
      redraw = () => this.redraw();
      this.redraw();
    }

    private paint() {
      const color = Phaser.Display.Color.GetColor(
        light.red,
        light.green,
        light.blue,
      );
      this.aura
        ?.setFillStyle(color, light.opacity * 0.42)
        .setScale(light.scale);
      this.embers
        ?.setFillStyle(color, light.opacity * 0.32)
        .setScale(light.scale);
    }

    redraw() {
      const [red, green, blue] = fireColors[heat];
      const intensity =
        heat === 'gentle' ? 0.22 : heat === 'steady' ? 0.36 : 0.54;
      const target = {
        red,
        green,
        blue,
        opacity: firing ? 0.88 : intensity,
        scale: firing ? 1.35 : 1,
      };
      this.tweens.killTweensOf(light);
      if (motion.matches) {
        Object.assign(light, target);
        this.paint();
        reveal = false;
        return;
      }
      this.tweens.add({
        targets: light,
        ...target,
        duration: firing ? 320 : 240,
        ease: 'Sine.InOut',
        onUpdate: () => this.paint(),
        onComplete: () => {
          if (firing)
            this.tweens.add({
              targets: light,
              opacity: 0.61,
              scale: 1.18,
              duration: 530,
              yoyo: true,
              repeat: -1,
              ease: 'Sine.InOut',
              onUpdate: () => this.paint(),
            });
        },
      });
      if (reveal && this.pulse) {
        reveal = false;
        this.tweens.killTweensOf(this.pulse);
        this.pulse.setScale(0.72).setAlpha(1).setStrokeStyle(2, 0xc68643, 0.8);
        this.tweens.add({
          targets: this.pulse,
          scale: 1.62,
          alpha: 0,
          duration: 570,
          ease: 'Quad.Out',
        });
      }
    }
  }

  const game = new Phaser.Game({
    parent,
    type: Phaser.CANVAS,
    width: 400,
    height: 400,
    transparent: true,
    scale: { mode: Phaser.Scale.FIT, autoCenter: Phaser.Scale.CENTER_BOTH },
    audio: { noAudio: true },
    scene: FurnaceScene,
  });
  return {
    update(nextHeat: ContestHeat, nextFiring: boolean, nextReveal: boolean) {
      heat = nextHeat;
      firing = nextFiring;
      reveal ||= nextReveal;
      redraw?.();
    },
    destroy: () => game.destroy(true),
  };
}
