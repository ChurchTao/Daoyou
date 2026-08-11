import { createRequire } from 'node:module';
import type * as BoardgameServerModule from 'boardgame.io/server';

/**
 * boardgame.io 0.50 exposes `server` as a directory proxy. Node ESM does not
 * resolve that proxy, so keep the compatibility boundary in one place and
 * load its explicit CommonJS entry point.
 */
const require = createRequire(import.meta.url);
const boardgameServer = require(
  'boardgame.io/dist/cjs/server.js',
) as typeof BoardgameServerModule;

export const Server = boardgameServer.Server;
export const SocketIO = boardgameServer.SocketIO;
