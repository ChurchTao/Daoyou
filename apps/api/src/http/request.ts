import type { RequestContext } from '@server/lib/http/context.js';
import type { Request } from 'express';

export type GameRequest = Request & { gameContext: RequestContext };
