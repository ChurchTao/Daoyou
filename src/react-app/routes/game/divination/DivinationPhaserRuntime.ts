import type { DivinationDice } from '@shared/lib/divination';
import * as Phaser from 'phaser';

export interface DivinationController {
  show(dice: DivinationDice | null): void;
  roll(dice: DivinationDice): Promise<void>;
  destroy(): void;
}

const PIPS = [
  [],
  [[0, 0]],
  [
    [-1, -1],
    [1, 1],
  ],
  [
    [-1, -1],
    [0, 0],
    [1, 1],
  ],
  [
    [-1, -1],
    [-1, 1],
    [1, -1],
    [1, 1],
  ],
  [
    [-1, -1],
    [-1, 1],
    [0, 0],
    [1, -1],
    [1, 1],
  ],
  [
    [-1, -1],
    [-1, 0],
    [-1, 1],
    [1, -1],
    [1, 0],
    [1, 1],
  ],
];

export function createDivinationGame(
  root: HTMLElement,
  callbacks: { onReady(): void; onError(): void },
): DivinationController {
  let current: DivinationDice | null = null;
  let scene: DivinationScene | null = null;
  let finishRoll: (() => void) | null = null;
  class DivinationScene extends Phaser.Scene {
    dice: Phaser.GameObjects.Image[] = [];
    background!: Phaser.GameObjects.Image;
    diceRoot!: Phaser.GameObjects.Container;
    preload() {
      this.load.image('divination-table', '/assets/divination/qiantai-v1.jpg');
      this.load.image(
        'divination-table-mobile',
        '/assets/divination/qiantai-mobile-v1.jpg',
      );
      this.load.on('loaderror', callbacks.onError);
    }
    create() {
      // Controller follows the scene instance owned by Phaser.
      // eslint-disable-next-line @typescript-eslint/no-this-alias
      scene = this;
      this.background = this.add.image(0, 0, 'divination-table').setOrigin(0);
      for (let face = 0; face <= 6; face++) {
        const graphics = this.make.graphics({ x: 0, y: 0 });
        graphics.fillStyle(0x17150f, 0.28).fillRoundedRect(7, 11, 88, 88, 15);
        graphics.fillStyle(0xbda780).fillRoundedRect(3, 6, 88, 88, 13);
        graphics.fillStyle(0xf8edcf).fillRoundedRect(3, 0, 88, 86, 13);
        graphics.lineStyle(2, 0xd3bd97).strokeRoundedRect(6, 3, 82, 80, 11);
        graphics.fillStyle(face === 1 || face === 4 ? 0xa03f31 : 0x353932);
        for (const [x, y] of PIPS[face])
          graphics.fillCircle(47 + x * 23, 43 + y * 23, 7);
        graphics.generateTexture(`die-${face}`, 100, 106);
        graphics.destroy();
      }
      this.dice = [0, 1, 2].map((index) =>
        this.add
          .image((index - 1) * 120, 0, `die-${current?.[index] ?? 0}`)
          .setRotation((index - 1) * 0.13),
      );
      this.diceRoot = this.add.container(0, 0, this.dice);
      this.layout();
      callbacks.onReady();
    }
    layout() {
      const portrait = this.scale.height > this.scale.width;
      this.background
        .setTexture(portrait ? 'divination-table-mobile' : 'divination-table')
        .setDisplaySize(960, portrait ? 1440 : 640);
      this.diceRoot
        .setPosition(480, portrait ? 930 : 395)
        .setScale(portrait ? 1.6 : 1);
    }
  }
  const game = new Phaser.Game({
    type: Phaser.AUTO,
    parent: root,
    width: 960,
    height: root.clientHeight > root.clientWidth ? 1440 : 640,
    backgroundColor: '#e9dfcd',
    scene: DivinationScene,
    scale: { mode: Phaser.Scale.FIT, autoCenter: Phaser.Scale.CENTER_BOTH },
    render: { antialias: true },
    audio: { noAudio: true },
  });
  const resizeObserver = new ResizeObserver(() => {
    if (!scene) return;
    // refresh uses cached parentSize; layout changes must update it first.
    if (game.scale.getParentBounds()) {
      const height = root.clientHeight > root.clientWidth ? 1440 : 640;
      if (game.scale.height !== height) game.scale.setGameSize(960, height);
      else game.scale.refresh();
      scene.layout();
    }
  });
  resizeObserver.observe(root);
  return {
    show(dice) {
      current = dice;
      scene?.dice.forEach((die, index) =>
        die.setTexture(`die-${dice?.[index] ?? 0}`),
      );
    },
    roll(dice) {
      current = dice;
      if (
        !scene ||
        window.matchMedia('(prefers-reduced-motion: reduce)').matches
      ) {
        scene?.dice.forEach((die, index) =>
          die.setTexture(`die-${dice[index]}`),
        );
        return Promise.resolve();
      }
      const active = scene;
      return new Promise<void>((resolve) => {
        finishRoll = resolve;
        const spin = active.time.addEvent({
          delay: 70,
          repeat: 14,
          callback: () =>
            active.dice.forEach((die) =>
              die.setTexture(`die-${Phaser.Math.Between(1, 6)}`),
            ),
        });
        active.dice.forEach((die, index) => {
          die.setPosition((index - 1) * 70, -155).setScale(0.8);
          active.tweens.add({
            targets: die,
            x: (index - 1) * 120,
            y: 0,
            rotation: Math.PI * (4 + index) + (index - 1) * 0.13,
            scale: 1,
            duration: 1100 + index * 100,
            ease: 'Bounce.Out',
            onComplete: () => {
              die.setTexture(`die-${dice[index]}`);
              if (index === 2) {
                spin.remove();
                active.dice.forEach((item, i) =>
                  item.setTexture(`die-${dice[i]}`),
                );
                finishRoll = null;
                resolve();
              }
            },
          });
        });
      });
    },
    destroy() {
      resizeObserver.disconnect();
      finishRoll?.();
      scene = null;
      game.destroy(true);
    },
  };
}
