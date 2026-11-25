import * as Phaser from 'phaser';

export function mountInvasionScene(parent: HTMLElement, art: string) {
  const reduced = window.matchMedia('(prefers-reduced-motion: reduce)');
  let signal: (phase: string) => void = () => {};
  let latestPhase = 'assembling';
  class CampScene extends Phaser.Scene {
    preload() {
      this.load.image('tiannan-camp', art);
    }

    create() {
      if (this.textures.exists('tiannan-camp')) {
        const image = this.add.image(480, 320, 'tiannan-camp');
        image.setScale(Math.max(960 / image.width, 640 / image.height));
      }
      const light = this.add
        .ellipse(655, 355, 50, 170)
        .setBlendMode(Phaser.BlendModes.SCREEN);
      const sparks = Array.from({ length: 12 }, (_, index) => {
        const x = 575 + ((index * 53) % 190);
        const y = 275 + ((index * 37) % 180);
        return this.add.circle(x, y, (index % 3) + 1);
      });
      signal = (phase) => {
        const color = getComputedStyle(parent)
          .getPropertyValue(
            phase === 'rest' ? '--color-teal' : '--color-crimson',
          )
          .trim();
        const tint = Phaser.Display.Color.HexStringToColor(color).color;
        light.setFillStyle(tint, 0.25).setAlpha(0.4);
        this.tweens.killTweensOf([light, ...sparks]);
        for (const dot of sparks) dot.setFillStyle(tint).setAlpha(0.35);
        if (!reduced.matches) {
          this.tweens.add({
            targets: light,
            alpha: 0.72,
            duration: 1600,
            yoyo: true,
            repeat: -1,
            ease: 'Sine.InOut',
          });
          this.tweens.add({
            targets: sparks,
            alpha: 0,
            duration: 1300,
            yoyo: true,
            repeat: -1,
            delay: this.tweens.stagger(125),
          });
        }
      };
      signal(latestPhase);
    }
  }
  const game = new Phaser.Game({
    parent,
    width: 960,
    height: 640,
    transparent: true,
    type: Phaser.CANVAS,
    audio: { noAudio: true },
    input: { keyboard: false, touch: false, mouse: false },
    scale: { mode: Phaser.Scale.ENVELOP, autoCenter: Phaser.Scale.CENTER_BOTH },
    scene: CampScene,
  });
  return {
    setPhase(phase: string) {
      latestPhase = phase;
      signal(phase);
    },
    destroy: () => game.destroy(true),
  };
}
