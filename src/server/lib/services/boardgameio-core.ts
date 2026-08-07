import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const boardgameCore = require('boardgame.io/dist/cjs/core.js') as {
  INVALID_MOVE: typeof import('boardgame.io/core').INVALID_MOVE;
};

export const INVALID_MOVE = boardgameCore.INVALID_MOVE;
